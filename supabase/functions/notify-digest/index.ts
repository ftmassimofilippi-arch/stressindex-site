// =============================================================================
// Edge Function: notify-digest
// =============================================================================
//
// Riepilogo giornaliero. La chiama pg_cron ogni ora a :05 (migration 026).
//
// FLUSSO
//   1. segreto condiviso (x-notify-secret), come notify-measurement;
//   2. notifiche_digest_da_inviare() risponde con i professionisti in modalità
//      'riepilogo' la cui digest_hour è l'ora corrente NEL LORO FUSO e che
//      hanno almeno un evento in coda. Chi non ha niente non compare, quindi
//      non parte nessuna email vuota;
//   3. per ognuno: si legge la coda non ancora comunicata, si raggruppa per
//      cliente e si manda UNA sola email;
//   4. a invio riuscito le righe usate escono dalla coda (sent_at). Se l'invio
//      fallisce restano lì e ci riprova il riepilogo del giorno dopo;
//   5. ogni esito finisce in notification_log con kind='digest'.
//
// L'anti-ripetizione oraria non si applica qui: il riepilogo è per definizione
// una email al giorno.
//
// Deploy:
//   supabase functions deploy notify-digest --no-verify-jwt --project-ref ivwmjwukpeldbqkxgvvf

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { asLang, t, type Lang } from '../_shared/notify-strings.ts'
import {
  adminClient, bloccoEvento, checkSecret, esc, formatGiorno, formatQuando, inviaEmail,
  json, layout, scriviLog, testo, urlDettaglio, type NotifyEvent,
} from '../_shared/notify-core.ts'

type DaInviare = {
  professional_id: string
  recipient_email: string
  lingua: string
  fuso: string
  eventi: number
}

type RigaCoda = {
  id: string
  client_user_id: string
  client_id: string | null
  source_id: string
  occurred_at: string
  payload: (NotifyEvent & { nomeCliente?: string }) | null
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405)
  const negato = checkSecret(req)
  if (negato) return negato

  const admin = adminClient()

  const { data: listaRaw, error: listaErr } = await admin.rpc('notifiche_digest_da_inviare')
  if (listaErr) {
    console.error('[notify-digest] notifiche_digest_da_inviare fallita', listaErr.message)
    return json({ ok: false, code: 'digest_list_failed', message: listaErr.message }, 500)
  }
  const lista = (listaRaw ?? []) as DaInviare[]
  if (lista.length === 0) return json({ ok: true, inviati: 0, nota: 'nessun riepilogo da mandare in questa ora' })

  const esiti: Array<Record<string, unknown>> = []
  for (const d of lista) {
    esiti.push(await riepilogoPer(admin, d))
  }

  return json({ ok: true, inviati: esiti.filter((e) => e.esito === 'inviata').length, dettaglio: esiti })
})

async function riepilogoPer(admin: SupabaseClient, d: DaInviare): Promise<Record<string, unknown>> {
  const lang = asLang(d.lingua)
  const tz = d.fuso || 'Europe/Rome'

  const { data: codaRaw, error: codaErr } = await admin
    .from('notification_queue')
    .select('id, client_user_id, client_id, source_id, occurred_at, payload')
    .eq('professional_id', d.professional_id)
    .is('sent_at', null)
    .order('occurred_at', { ascending: true })
    .limit(200)
  if (codaErr) {
    console.error('[notify-digest] lettura coda fallita', codaErr.message)
    return { professional_id: d.professional_id, esito: 'coda_illeggibile', errore: codaErr.message }
  }
  const coda = (codaRaw ?? []) as RigaCoda[]
  if (coda.length === 0) return { professional_id: d.professional_id, esito: 'coda_vuota' }

  // Raggruppamento per cliente, nell'ordine in cui si sono fatti vivi.
  const gruppi = new Map<string, { nome: string; clientId: string | null; eventi: NotifyEvent[] }>()
  for (const r of coda) {
    const ev = r.payload
    if (!ev?.sourceId) continue
    const g = gruppi.get(r.client_user_id) ?? {
      nome: ev.nomeCliente?.trim() || '—',
      clientId: r.client_id,
      eventi: [],
    }
    if (!g.clientId && r.client_id) g.clientId = r.client_id
    g.eventi.push(ev)
    gruppi.set(r.client_user_id, g)
  }
  if (gruppi.size === 0) return { professional_id: d.professional_id, esito: 'coda_senza_payload' }

  const totale = [...gruppi.values()].reduce((n, g) => n + g.eventi.length, 0)
  const { subject, html, text } = componiRiepilogo(gruppi, totale, lang, tz)

  const esito = await inviaEmail(d.recipient_email, subject, html, text)
  await scriviLog(admin, {
    professional_id: d.professional_id,
    recipient_email: d.recipient_email,
    kind: 'digest',
    status: esito.ok ? 'sent' : 'failed',
    reason: esito.ok ? null : esito.error,
    event_count: totale,
    payload: { subject, clienti: gruppi.size },
  })

  if (!esito.ok) {
    // La coda NON si svuota: il riepilogo di domani riproverà con questi eventi.
    return { professional_id: d.professional_id, esito: 'fallita', errore: esito.error, eventi: totale }
  }

  const { error: updErr } = await admin
    .from('notification_queue')
    .update({ sent_at: new Date().toISOString() })
    .in('id', coda.map((r) => r.id))
  if (updErr) console.error('[notify-digest] chiusura coda fallita', updErr.message)

  return { professional_id: d.professional_id, esito: 'inviata', clienti: gruppi.size, eventi: totale }
}

function componiRiepilogo(
  gruppi: Map<string, { nome: string; clientId: string | null; eventi: NotifyEvent[] }>,
  totale: number,
  lang: Lang,
  tz: string,
): { subject: string; html: string; text: string } {
  const subject = totale === 1
    ? t(lang, 'subject_digest_one')
    : t(lang, 'subject_digest', { n: totale })

  const intro = gruppi.size === 1
    ? t(lang, 'intro_digest')
    : t(lang, 'intro_digest_clients', { m: gruppi.size })

  const oggi = formatGiorno(new Date(), lang, tz)

  const sezioni = [...gruppi.values()].map((g) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">
      <tr><td style="padding:10px 4px 8px;">
        <span style="font-size:16px;font-weight:700;color:#2F343A;">${esc(g.nome)}</span>
        <span style="font-size:13px;color:#6B7280;"> · ${g.eventi.length}</span>
      </td></tr>
    </table>
    ${g.eventi.map((e) => bloccoEvento(e, lang, tz, g.clientId)).join('')}`).join('')

  const corpo = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:#FFFFFF;border:1px solid #E2E6EA;border-radius:16px;">
      <tr><td style="padding:24px 20px 4px;">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6B7280;">${esc(oggi)}</p>
        <p style="margin:0 0 18px;font-size:17px;line-height:1.5;color:#2F343A;font-weight:600;">${esc(intro)}</p>
      </td></tr>
      <tr><td style="padding:0 16px 20px;">${sezioni}</td></tr>
    </table>`

  const righe: string[] = [intro, '']
  for (const g of gruppi.values()) {
    righe.push(`${g.nome} (${g.eventi.length})`)
    for (const e of g.eventi) {
      const s = e.scores ?? {}
      const scoreTxt = ['stress', 'recupero', 'equilibrio', 'energia', 'composito']
        .filter((k) => typeof s[k] === 'number')
        .map((k) => `${t(lang, 'score_' + k)} ${s[k]}`)
        .join(' · ')
      righe.push(`  • ${t(lang, e.typeKey)} — ${formatQuando(new Date(e.occurredAt), lang, tz, e.dateOnly)}`)
      if (scoreTxt) righe.push(`    ${scoreTxt}`)
      righe.push(`    ${urlDettaglio(e, g.clientId)}`)
    }
    righe.push('')
  }

  return {
    subject,
    html: layout(lang, subject, corpo, 'digest'),
    text: testo(righe, lang, 'digest'),
  }
}
