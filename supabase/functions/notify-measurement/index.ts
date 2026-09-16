// =============================================================================
// Edge Function: notify-measurement
// =============================================================================
//
// Riceve il Database Webhook di Supabase sull'INSERT di `sessions`,
// `monitoring_sessions` e `night_metrics` e avvisa il professionista collegato
// che un suo cliente si è misurato da solo.
//
// FLUSSO
//   1. segreto condiviso (x-notify-secret): la function è deployata con
//      --no-verify-jwt perché il webhook non porta un JWT utente;
//   2. SOLO sessioni REMOTE: client_id NULL e professionista_id che è un
//      profilo con role='client'. Una misurazione fatta in studio dal
//      professionista ha client_id valorizzato (o un professionista come
//      autore) e non genera niente;
//   3. professionisti collegati via notifica_destinatari() → link `active`,
//      preferenze già risolte sui default, email di destinazione scelta;
//   4. per ognuno: 'mai' → esce. Altrimenti l'evento entra SEMPRE in
//      notification_queue (idempotente sulla coppia evento+destinatario), poi
//      'riepilogo' → esce, 'subito' → manda;
//   5. ANTI-RIPETIZIONE: se una email per quel cliente è già partita
//      nell'ultima ora non se ne manda un'altra. L'evento resta in coda e lo
//      raccoglie la prima email utile, così non va perso;
//   6. ogni esito — inviata, fallita, soppressa — finisce in notification_log.
//
// Il webhook di Supabase è at-least-once: può arrivare due volte. La UNIQUE su
// notification_queue e il log rendono la doppia consegna innocua.
//
// Deploy:
//   supabase functions deploy notify-measurement --no-verify-jwt --project-ref ivwmjwukpeldbqkxgvvf

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { asLang, t, type Lang } from '../_shared/notify-strings.ts'
import {
  adminClient, bloccoEvento, checkSecret, emailRecente, esc, formatQuando, inviaEmail,
  istanteReale, json, layout, puliziaScores, scriviLog, testo, tipoMisurazione, tipoMonitoraggio,
  urlDettaglio, type NotifyEvent,
} from '../_shared/notify-core.ts'

type WebhookBody = {
  type?: string
  table?: string
  schema?: string
  record?: Record<string, unknown> | null
}

type Destinatario = {
  professional_id: string
  recipient_email: string
  on_client_measurement: 'subito' | 'riepilogo' | 'mai'
  digest_hour: number
  lingua: string
  fuso: string
  client_id: string | null
  client_nome: string | null
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v)
  return v !== null && v !== undefined && Number.isFinite(n) ? n : null
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405)
  const negato = checkSecret(req)
  if (negato) return negato

  let body: WebhookBody
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, code: 'bad_request', message: 'Body non valido.' }, 400)
  }

  if ((body.type ?? '').toUpperCase() !== 'INSERT') {
    return json({ ok: true, skipped: 'non_insert', type: body.type })
  }
  const table = body.table ?? ''
  const record = body.record ?? null
  if (!record) return json({ ok: true, skipped: 'record_mancante' })

  const admin = adminClient()

  // ── 2. Solo misurazioni REMOTE ────────────────────────────────────────────
  // Il cliente che si misura dalla propria app scrive la riga a nome suo:
  // professionista_id = il SUO uid, client_id = NULL (nessuna scheda CRM).
  const autore = str(record.professionista_id) ?? str(record.user_id)
  if (!autore) return json({ ok: true, skipped: 'autore_mancante', table })
  if (record.client_id !== null && record.client_id !== undefined) {
    return json({ ok: true, skipped: 'misurazione_in_studio', table })
  }

  const { data: profilo, error: profErr } = await admin
    .from('profiles')
    .select('id, role, nome, cognome')
    .eq('id', autore)
    .maybeSingle()
  if (profErr) {
    console.error('[notify-measurement] lettura profiles fallita', profErr.message)
    return json({ ok: false, code: 'profile_read_failed', message: profErr.message }, 500)
  }
  if (!profilo || profilo.role !== 'client') {
    return json({ ok: true, skipped: 'autore_non_cliente', role: profilo?.role ?? null })
  }
  const clientUserId = autore
  const nomeProfilo = [profilo.nome, profilo.cognome].filter(Boolean).join(' ').trim()

  // ── Evento normalizzato ───────────────────────────────────────────────────
  const evento = await costruisciEvento(admin, table, record)
  if (!evento) return json({ ok: true, skipped: 'tabella_non_gestita', table })

  // ── 3. Destinatari ────────────────────────────────────────────────────────
  const { data: destRaw, error: destErr } = await admin.rpc('notifica_destinatari', {
    p_client_user_id: clientUserId,
  })
  if (destErr) {
    console.error('[notify-measurement] notifica_destinatari fallita', destErr.message)
    return json({ ok: false, code: 'recipients_failed', message: destErr.message }, 500)
  }
  const destinatari = (destRaw ?? []) as Destinatario[]
  if (destinatari.length === 0) {
    return json({ ok: true, skipped: 'nessun_professionista_collegato', clientUserId })
  }

  const esiti: Array<Record<string, unknown>> = []

  for (const d of destinatari) {
    const lang = asLang(d.lingua)
    const nomeCliente = d.client_nome ?? nomeProfilo ?? '—'

    // 4a. "mai": niente email e niente coda.
    if (d.on_client_measurement === 'mai') {
      esiti.push({ professional_id: d.professional_id, esito: 'preferenza_mai' })
      continue
    }

    // 4b. In coda comunque: è il registro di tutto ciò che va comunicato.
    const { error: codaErr } = await admin.from('notification_queue').upsert(
      {
        professional_id: d.professional_id,
        client_user_id: clientUserId,
        client_id: d.client_id,
        kind: evento.kind,
        source_table: evento.sourceTable,
        source_id: evento.sourceId,
        occurred_at: evento.occurredAt,
        payload: { ...evento, nomeCliente },
      },
      { onConflict: 'source_table,source_id,professional_id', ignoreDuplicates: true },
    )
    if (codaErr) console.error('[notify-measurement] scrittura coda fallita', codaErr.message)

    if (d.on_client_measurement === 'riepilogo') {
      esiti.push({ professional_id: d.professional_id, esito: 'in_coda_per_riepilogo' })
      continue
    }

    // 5. Anti-ripetizione.
    if (await emailRecente(admin, d.professional_id, clientUserId)) {
      await scriviLog(admin, {
        professional_id: d.professional_id,
        recipient_email: d.recipient_email,
        client_user_id: clientUserId,
        client_id: d.client_id,
        kind: evento.kind,
        status: 'skipped',
        reason: 'email già inviata per questo cliente nell\'ultima ora; l\'evento resta in coda',
        source_table: evento.sourceTable,
        source_id: evento.sourceId,
      })
      esiti.push({ professional_id: d.professional_id, esito: 'soppressa_anti_ripetizione' })
      continue
    }

    // 6. Invio: comprende anche gli eventi rimasti in coda per questo cliente.
    const arretrati = await codaPendente(admin, d.professional_id, clientUserId)
    const eventi = unisciEventi(arretrati, evento)
    const { subject, html, text } = componiEmailImmediata(eventi, nomeCliente, d, lang)

    const esito = await inviaEmail(d.recipient_email, subject, html, text)
    await scriviLog(admin, {
      professional_id: d.professional_id,
      recipient_email: d.recipient_email,
      client_user_id: clientUserId,
      client_id: d.client_id,
      kind: evento.kind,
      status: esito.ok ? 'sent' : 'failed',
      reason: esito.ok ? null : esito.error,
      source_table: evento.sourceTable,
      source_id: evento.sourceId,
      event_count: eventi.length,
      payload: { subject, eventi: eventi.map((e) => ({ kind: e.kind, id: e.sourceId })) },
    })

    if (esito.ok) {
      // Tutto ciò che l'email conteneva è comunicato: via dalla coda del digest.
      const ids = eventi.map((e) => e.sourceId)
      const { error: updErr } = await admin
        .from('notification_queue')
        .update({ sent_at: new Date().toISOString() })
        .eq('professional_id', d.professional_id)
        .eq('client_user_id', clientUserId)
        .is('sent_at', null)
        .in('source_id', ids)
      if (updErr) console.error('[notify-measurement] chiusura coda fallita', updErr.message)
    }
    esiti.push({ professional_id: d.professional_id, esito: esito.ok ? 'inviata' : 'fallita', eventi: eventi.length })
  }

  return json({ ok: true, table, clientUserId, destinatari: esiti })
})

// ── Costruzione dell'evento ──────────────────────────────────────────────────

async function costruisciEvento(
  admin: SupabaseClient,
  table: string,
  r: Record<string, unknown>,
): Promise<NotifyEvent | null> {
  const id = str(r.id)
  if (!id) return null

  if (table === 'sessions') {
    const istante = istanteReale({
      started_at: str(r.started_at),
      started_at_utc: str(r.started_at_utc),
      tz_offset_minutes: num(r.tz_offset_minutes),
    }) ?? new Date()
    const durata = num(r.duration_seconds)
    return {
      kind: 'measurement',
      sourceTable: 'sessions',
      sourceId: id,
      occurredAt: istante.toISOString(),
      typeKey: tipoMisurazione(str(r.test_type)),
      durationMinutes: durata != null ? Math.max(1, Math.round(durata / 60)) : null,
      scores: await scoresDellaSessione(admin, id),
      // Nessun path fisso: il percorso passa dalla scheda CRM, che cambia da
      // professionista a professionista. Lo compone urlDettaglio().
      path: null,
    }
  }

  if (table === 'monitoring_sessions') {
    const istante = istanteReale({
      start_time: str(r.start_time),
      tz_offset_minutes: num(r.tz_offset_minutes),
    }) ?? new Date()
    const scores = puliziaScores(rinominaScores(r.scores_night as Record<string, unknown> | null))
    return {
      kind: 'monitoring',
      sourceTable: 'monitoring_sessions',
      sourceId: id,
      occurredAt: istante.toISOString(),
      typeKey: tipoMonitoraggio(str(r.monitoring_type)),
      durationMinutes: num(r.duration_minutes),
      scores,
      path: `/area-professionisti/monitoraggio/${encodeURIComponent(id)}`,
    }
  }

  if (table === 'night_metrics') {
    // Una notte è un giorno di calendario, non un istante: si tiene solo
    // night_date, ancorata a mezzogiorno UTC perché nessun fuso la sposti al
    // giorno prima o dopo, e si mostra senza orario (dateOnly).
    const giorno = str(r.night_date) ?? new Date().toISOString().slice(0, 10)
    const istante = new Date(`${giorno}T12:00:00Z`)
    const extra: Array<{ labelKey: string; value: string }> = []
    const battito = num(r.rhr_night)
    if (battito != null) extra.push({ labelKey: 'label_night_hr', value: `${Math.round(battito)} bpm` })
    const sonno = num(r.sleep_duration_min)
    if (sonno != null && sonno > 0) {
      const h = Math.floor(sonno / 60)
      const m = Math.round(sonno % 60)
      extra.push({ labelKey: 'label_sleep_duration', value: h > 0 ? `${h} h ${m} min` : `${m} min` })
    }
    const sorgente = str(r.source_session_id)
    return {
      kind: 'night',
      sourceTable: 'night_metrics',
      sourceId: id,
      occurredAt: (Number.isNaN(istante.getTime()) ? new Date() : istante).toISOString(),
      typeKey: 'type_night',
      extra,
      dateOnly: true,
      path: sorgente ? `/area-professionisti/monitoraggio/${encodeURIComponent(sorgente)}` : null,
    }
  }

  return null
}

/** scores_night dell'app (inglese) → chiavi delle etichette delle email. */
function rinominaScores(raw: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!raw) return null
  return {
    stress: raw.stress,
    recupero: raw.recovery,
    equilibrio: raw.balance,
    energia: raw.energy,
    composito: raw.composite,
  }
}

/**
 * I punteggi proprietari li scrive l'app in measurement_analytics subito dopo
 * la sessione, con una chiamata separata: il webhook può arrivare prima. Si
 * riprova una volta a distanza di qualche secondo; se ancora non c'è, l'email
 * parte lo stesso e lo dice ("i punteggi compaiono tra poco nella scheda").
 */
async function scoresDellaSessione(admin: SupabaseClient, sessionId: string): Promise<Record<string, number> | undefined> {
  for (let tentativo = 0; tentativo < 2; tentativo++) {
    if (tentativo > 0) await new Promise((r) => setTimeout(r, 3000))
    const { data, error } = await admin
      .from('measurement_analytics')
      .select('score_stress, score_recupero, score_equilibrio, score_energia, score_composito')
      .eq('session_id', sessionId)
      .maybeSingle()
    if (error) {
      console.error('[notify-measurement] lettura measurement_analytics fallita', error.message)
      return undefined
    }
    if (data) {
      const puliti = puliziaScores({
        stress: data.score_stress,
        recupero: data.score_recupero,
        equilibrio: data.score_equilibrio,
        energia: data.score_energia,
        composito: data.score_composito,
      })
      if (puliti) return puliti
    }
  }
  return undefined
}

// ── Coda arretrata ───────────────────────────────────────────────────────────

async function codaPendente(
  admin: SupabaseClient,
  professionalId: string,
  clientUserId: string,
): Promise<NotifyEvent[]> {
  const { data, error } = await admin
    .from('notification_queue')
    .select('payload, source_id, source_table, kind, occurred_at')
    .eq('professional_id', professionalId)
    .eq('client_user_id', clientUserId)
    .is('sent_at', null)
    .order('occurred_at', { ascending: true })
    .limit(20)
  if (error) {
    console.error('[notify-measurement] lettura coda fallita', error.message)
    return []
  }
  return (data ?? []).map((r) => (r.payload ?? {}) as NotifyEvent).filter((e) => !!e.sourceId)
}

function unisciEventi(arretrati: NotifyEvent[], corrente: NotifyEvent): NotifyEvent[] {
  const perId = new Map<string, NotifyEvent>()
  for (const e of arretrati) perId.set(e.sourceId, e)
  perId.set(corrente.sourceId, corrente)   // quello appena arrivato è il più fresco
  return [...perId.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
}

// ── Composizione dell'email immediata ────────────────────────────────────────

function componiEmailImmediata(
  eventi: NotifyEvent[],
  nomeCliente: string,
  d: Destinatario,
  lang: Lang,
): { subject: string; html: string; text: string } {
  const tz = d.fuso || 'Europe/Rome'
  const uno = eventi.length === 1
  const ultimo = eventi[eventi.length - 1]

  const subject = uno
    ? t(lang, ultimo.kind === 'monitoring' ? 'subject_monitoring' : ultimo.kind === 'night' ? 'subject_night' : 'subject_measurement', { cliente: nomeCliente })
    : t(lang, 'subject_multi', { cliente: nomeCliente, n: eventi.length })

  const intro = uno
    ? t(lang, 'intro_single', { cliente: nomeCliente })
    : t(lang, 'intro_multi', { cliente: nomeCliente, n: eventi.length })

  const corpo = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:#FFFFFF;border:1px solid #E2E6EA;border-radius:16px;">
      <tr><td style="padding:24px 20px 4px;">
        <p style="margin:0 0 6px;font-size:15px;color:#4A5058;">${esc(t(lang, 'greeting'))}</p>
        <p style="margin:0 0 18px;font-size:17px;line-height:1.5;color:#2F343A;font-weight:600;">${esc(intro)}</p>
      </td></tr>
      <tr><td style="padding:0 16px 20px;">
        ${eventi.map((e) => bloccoEvento(e, lang, tz, d.client_id)).join('')}
      </td></tr>
    </table>`

  const righe = [
    t(lang, 'greeting'),
    '',
    intro,
    '',
    ...eventi.map((e) => {
      const parti = [
        `• ${t(lang, e.typeKey)} — ${formatQuando(new Date(e.occurredAt), lang, tz, e.dateOnly)}`,
        `  ${urlDettaglio(e, d.client_id)}`,
      ]
      const s = e.scores ?? {}
      const scoreTxt = ['stress', 'recupero', 'equilibrio', 'energia', 'composito']
        .filter((k) => typeof s[k] === 'number')
        .map((k) => `${t(lang, 'score_' + k)} ${s[k]}`)
        .join(' · ')
      if (scoreTxt) parti.splice(1, 0, `  ${scoreTxt}`)
      return parti.join('\n')
    }),
  ]

  return {
    subject,
    html: layout(lang, subject, corpo, 'now'),
    text: testo(righe, lang, 'now'),
  }
}
