// =============================================================================
// Nucleo condiviso delle notifiche — SMTP, istanti, rendering, log
// =============================================================================
//
// Lo usano notify-measurement (email immediata sul webhook) e notify-digest
// (riepilogo orario da pg_cron). Qui NON c'è nessuna decisione di prodotto:
// chi notificare e quando lo decidono le due function, questo file sa solo
// come si costruisce e si manda una email e come si scrive il log.
//
// SMTP: le credenziali sono secret della function (SMTP_HOST, SMTP_PORT,
// SMTP_USER, SMTP_PASS, SMTP_FROM). Quelle configurate in Supabase → Auth
// servono SOLO alle email di autenticazione e non sono leggibili da qui.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import { LOCALE, t, type Lang } from './notify-strings.ts'

// ── Ambiente ─────────────────────────────────────────────────────────────────

export function env(name: string, fallback?: string): string {
  const v = Deno.env.get(name) ?? fallback
  if (v === undefined) throw new Error(`Secret mancante: ${name}`)
  return v
}

export const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://stressindex.io').replace(/\/+$/, '')

export function adminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Chi chiama deve dimostrare di essere il webhook o il cron.
 *
 * Le due function sono deployate con --no-verify-jwt (il Database Webhook e
 * pg_net non portano un JWT utente), quindi il filtro è questo segreto
 * condiviso. Non dà accesso a niente: dice solo "questa chiamata viene da noi".
 */
export function checkSecret(req: Request): Response | null {
  const atteso = Deno.env.get('NOTIFY_SECRET') ?? ''
  if (!atteso) {
    return json({ ok: false, code: 'server_misconfigured', message: 'NOTIFY_SECRET non impostato.' }, 500)
  }
  const dato = req.headers.get('x-notify-secret') ?? ''
  // Confronto a tempo costante: la lunghezza trapela comunque, il contenuto no.
  if (dato.length !== atteso.length) return json({ ok: false, code: 'forbidden' }, 401)
  let diff = 0
  for (let i = 0; i < atteso.length; i++) diff |= dato.charCodeAt(i) ^ atteso.charCodeAt(i)
  if (diff !== 0) return json({ ok: false, code: 'forbidden' }, 401)
  return null
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── Istante reale di una misurazione ─────────────────────────────────────────
//
// Stessa convenzione di src/lib/format.ts (measuredInstant): l'app Flutter ha
// scritto per mesi l'orologio da parete italiano dentro un timestamptz UTC.
// Le righe nuove portano tz_offset_minutes e sono già l'istante corretto.
// Sbagliare qui significa mandare email con l'orario spostato di due ore.

const FUSO_STORICO = 'Europe/Rome'

function partiNelFuso(instant: Date, tz: string) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant)
  const n = (tipo: string) => Number(p.find((x) => x.type === tipo)?.value ?? 0)
  return { y: n('year'), mo: n('month'), d: n('day'), h: n('hour') % 24, mi: n('minute'), s: n('second') }
}

function offsetFuso(instant: Date, tz: string): number {
  const p = partiNelFuso(instant, tz)
  return (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - instant.getTime()) / 60000
}

// Da orologio da parete italiano a istante reale. Due passate perché l'offset
// dipende dall'istante che stiamo cercando (confini dell'ora legale).
function daOraItaliana(wallUtcMs: number): Date {
  let off = offsetFuso(new Date(wallUtcMs), FUSO_STORICO)
  off = offsetFuso(new Date(wallUtcMs - off * 60000), FUSO_STORICO)
  return new Date(wallUtcMs - off * 60000)
}

export type RigaConIstante = {
  measured_at?: string | null
  measured_at_utc?: string | null
  started_at?: string | null
  started_at_utc?: string | null
  start_time?: string | null
  start_time_utc?: string | null
  tz_offset_minutes?: number | null
}

export function istanteReale(row: RigaConIstante | null | undefined): Date | null {
  if (!row) return null
  const gia = row.measured_at_utc ?? row.started_at_utc ?? row.start_time_utc
  if (gia) {
    const d = new Date(gia)
    if (!Number.isNaN(d.getTime())) return d
  }
  const grezzo = row.measured_at ?? row.started_at ?? row.start_time
  if (!grezzo) return null
  const d = new Date(grezzo)
  if (Number.isNaN(d.getTime())) return null
  if (row.tz_offset_minutes != null) return d
  return daOraItaliana(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()),
  )
}

/**
 * "16 set 2026, 08:30" nel fuso e nella lingua del professionista.
 * Con `soloData` (le notti) resta "16 set 2026", letto in UTC.
 */
export function formatQuando(instant: Date, lang: Lang, tz: string, soloData = false): string {
  const opzioni: Intl.DateTimeFormatOptions = soloData
    ? { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }
    : { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
  try {
    return new Intl.DateTimeFormat(LOCALE[lang], opzioni).format(instant)
  } catch {
    return new Intl.DateTimeFormat(LOCALE[lang], { ...opzioni, timeZone: FUSO_STORICO }).format(instant)
  }
}

export function formatOra(instant: Date, lang: Lang, tz: string): string {
  try {
    return new Intl.DateTimeFormat(LOCALE[lang], { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(instant)
  } catch {
    return new Intl.DateTimeFormat(LOCALE[lang], { timeZone: FUSO_STORICO, hour: '2-digit', minute: '2-digit' }).format(instant)
  }
}

export function formatGiorno(instant: Date, lang: Lang, tz: string): string {
  try {
    return new Intl.DateTimeFormat(LOCALE[lang], { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(instant)
  } catch {
    return new Intl.DateTimeFormat(LOCALE[lang], { timeZone: FUSO_STORICO, weekday: 'long', day: 'numeric', month: 'long' }).format(instant)
  }
}

// ── Evento normalizzato ──────────────────────────────────────────────────────
//
// Le tre tabelle sorgente hanno forme molto diverse; da qui in poi il resto
// del codice vede solo questa.

export type EventKind = 'measurement' | 'monitoring' | 'night'

export type NotifyEvent = {
  kind: EventKind
  sourceTable: string
  sourceId: string
  occurredAt: string          // ISO dell'istante reale
  typeKey: string             // chiave di traduzione (type_standard, type_night, …)
  durationMinutes?: number | null
  scores?: Record<string, number | null>   // stress | recupero | equilibrio | energia | composito
  extra?: Array<{ labelKey: string; value: string }>
  /** Percorso del dettaglio sul sito, già completo tranne l'host. */
  path?: string | null
  /**
   * Evento senza un'ora vera (una notte è un giorno di calendario, non un
   * istante): si mostra solo la data e la si legge in UTC, altrimenti il fuso
   * del destinatario la sposterebbe al giorno prima o dopo.
   */
  dateOnly?: boolean
}

/** test_type grezzo dell'app → chiave di traduzione. */
export function tipoMisurazione(testType: string | null | undefined): string {
  const v = (testType ?? '').toLowerCase().replace(/[\s_-]/g, '')
  if (v.includes('ortho') || v.includes('ortost')) return 'type_orthostatic'
  if (v.includes('coheren') || v.includes('coeren') || v.includes('breath')) return 'type_coherence'
  if (v.includes('incremental') || v.includes('rampa')) return 'type_incremental'
  if (v.includes('threshold') || v.includes('soglia')) return 'type_threshold'
  if (v.includes('standard') || v === '' || v === 'null') return 'type_standard'
  return 'type_measurement'
}

export function tipoMonitoraggio(monitoringType: string | null | undefined): string {
  switch ((monitoringType ?? '').toLowerCase()) {
    case 'sleep': return 'type_monitoring_sleep'
    case 'custom': return 'type_monitoring_custom'
    default: return 'type_monitoring_24h'
  }
}

/** Numeri di punteggio arrotondati, senza le chiavi vuote. */
export function puliziaScores(raw: Record<string, unknown> | null | undefined): Record<string, number> | undefined {
  if (!raw) return undefined
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) {
    const n = typeof v === 'number' ? v : Number(v)
    if (v !== null && v !== undefined && Number.isFinite(n)) out[k] = Math.round(n)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

// ── URL ──────────────────────────────────────────────────────────────────────

/**
 * Link diretto al dettaglio.
 *
 * Il percorso di una misurazione dipende dalla scheda CRM, che cambia da
 * professionista a professionista: si compone qui, non alla costruzione
 * dell'evento. Monitoraggi e notti hanno invece un percorso fisso, già in
 * `ev.path`. Senza scheda si ripiega sulla lista clienti: un link che porta
 * comunque in un posto sensato è meglio di nessun link.
 */
export function urlDettaglio(ev: NotifyEvent, clientId: string | null): string {
  if (ev.path) return `${SITE_URL}${ev.path}`
  if (ev.kind === 'measurement' && clientId) {
    return `${SITE_URL}/area-professionisti/clienti/${encodeURIComponent(clientId)}/misurazione/${encodeURIComponent(ev.sourceId)}`
  }
  if (clientId) return `${SITE_URL}/area-professionisti/clienti/${encodeURIComponent(clientId)}`
  return `${SITE_URL}/area-professionisti/clienti`
}

/** true se il link porta davvero alla singola registrazione, non alla scheda. */
export function haDettaglio(ev: NotifyEvent, clientId: string | null): boolean {
  return !!ev.path || (ev.kind === 'measurement' && !!clientId)
}

export const urlPreferenze = `${SITE_URL}/area-professionisti/impostazioni?tab=notifiche`

// ── Rendering ────────────────────────────────────────────────────────────────

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const C = {
  teal: '#4FA39A',
  tealDark: '#2E746C',
  tealLight: '#E8F4F3',
  ink: '#2F343A',
  inkLight: '#4A5058',
  muted: '#6B7280',
  border: '#E2E6EA',
  surface: '#F6F7F8',
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/** Una "card" evento: tipo, quando, punteggi, link. */
export function bloccoEvento(
  ev: NotifyEvent,
  lang: Lang,
  tz: string,
  clientId: string | null,
  opts: { titolo?: string } = {},
): string {
  const quando = formatQuando(new Date(ev.occurredAt), lang, tz, ev.dateOnly)
  const righe: string[] = []

  righe.push(riga(t(lang, 'label_when'), esc(quando)))
  if (ev.durationMinutes != null && ev.durationMinutes > 0) {
    righe.push(riga(t(lang, 'label_duration'), esc(t(lang, 'duration_minutes', { n: ev.durationMinutes }))))
  }
  for (const x of ev.extra ?? []) righe.push(riga(t(lang, x.labelKey), esc(x.value)))

  const scores = ev.scores ?? {}
  const chiaviScore = ['stress', 'recupero', 'equilibrio', 'energia', 'composito']
    .filter((k) => typeof scores[k] === 'number')
  const bloccoScore = chiaviScore.length > 0
    ? `<tr><td style="padding:14px 0 0;">
         <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};margin-bottom:8px;">${esc(t(lang, 'label_scores'))}</div>
         <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:6px 0;">
           <tr>${chiaviScore.map((k) => `
             <td style="background:${C.tealLight};border-radius:10px;padding:8px 12px;text-align:center;">
               <div style="font-size:19px;font-weight:600;color:${C.tealDark};line-height:1.2;">${scores[k]}</div>
               <div style="font-size:11px;color:${C.muted};margin-top:2px;white-space:nowrap;">${esc(t(lang, 'score_' + k))}</div>
             </td>`).join('')}
           </tr>
         </table>
       </td></tr>`
    : `<tr><td style="padding:12px 0 0;font-size:13px;color:${C.muted};">${esc(t(lang, 'no_scores'))}</td></tr>`

  const link = urlDettaglio(ev, clientId)
  const etichettaLink = haDettaglio(ev, clientId) ? t(lang, 'cta_detail') : t(lang, 'cta_client')

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="border:1px solid ${C.border};border-radius:14px;background:#FFFFFF;margin:0 0 12px;">
    <tr><td style="padding:18px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:0 0 10px;">
          <span style="font-size:15px;font-weight:600;color:${C.ink};">${esc(opts.titolo ?? t(lang, ev.typeKey))}</span>
          ${opts.titolo ? `<span style="font-size:13px;color:${C.muted};"> · ${esc(t(lang, ev.typeKey))}</span>` : ''}
        </td></tr>
        ${righe.join('')}
        ${bloccoScore}
        <tr><td style="padding:16px 0 0;">
          <a href="${esc(link)}" style="display:inline-block;background:${C.teal};color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px;">${esc(etichettaLink)}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>`
}

function riga(label: string, valore: string): string {
  return `<tr><td style="padding:2px 0;font-size:14px;color:${C.inkLight};">
    <span style="color:${C.muted};">${esc(label)}:</span> ${valore}
  </td></tr>`
}

/** Scheletro della email: intestazione, corpo, piè di pagina con la disiscrizione. */
export function layout(lang: Lang, titolo: string, corpo: string, motivo: 'now' | 'digest'): string {
  const perche = motivo === 'now' ? t(lang, 'footer_why_now') : t(lang, 'footer_why_digest')
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titolo)}</title></head>
<body style="margin:0;padding:0;background:${C.surface};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(titolo)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:${FONT};">
        <tr><td style="padding:0 4px 16px;">
          <span style="font-size:15px;font-weight:700;color:${C.tealDark};letter-spacing:.02em;">Stress Index</span>
        </td></tr>
        <tr><td>${corpo}</td></tr>
        <tr><td style="padding:20px 4px 0;border-top:1px solid ${C.border};margin-top:8px;">
          <p style="margin:12px 0 4px;font-size:12px;line-height:1.6;color:${C.muted};">${esc(perche)}</p>
          <p style="margin:0;font-size:12px;">
            <a href="${esc(urlPreferenze)}" style="color:${C.tealDark};">${esc(t(lang, 'footer_change'))}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

/** Versione testuale: stessi contenuti, per i client che non mostrano HTML. */
export function testo(righe: string[], lang: Lang, motivo: 'now' | 'digest'): string {
  const perche = motivo === 'now' ? t(lang, 'footer_why_now') : t(lang, 'footer_why_digest')
  return [...righe, '', '—', perche, `${t(lang, 'footer_change')}: ${urlPreferenze}`, 'Stress Index'].join('\n')
}

// ── Invio ────────────────────────────────────────────────────────────────────

export type Esito = { ok: true } | { ok: false; error: string }

export async function inviaEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<Esito> {
  let client: SMTPClient | null = null
  try {
    const porta = Number(env('SMTP_PORT', '587'))
    client = new SMTPClient({
      connection: {
        hostname: env('SMTP_HOST'),
        port: porta,
        // 465 = TLS diretto; 587 = STARTTLS, che denomailer negozia da solo.
        tls: porta === 465,
        auth: { username: env('SMTP_USER'), password: env('SMTP_PASS') },
      },
    })
    await client.send({
      from: env('SMTP_FROM'),
      to,
      subject,
      content: text,
      html,
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    try { await client?.close() } catch { /* la connessione era già caduta */ }
  }
}

// ── Log ──────────────────────────────────────────────────────────────────────

export type LogRiga = {
  professional_id: string | null
  recipient_email: string | null
  client_user_id?: string | null
  client_id?: string | null
  kind: string
  status: 'sent' | 'failed' | 'skipped'
  reason?: string | null
  source_table?: string | null
  source_id?: string | null
  event_count?: number
  payload?: Record<string, unknown>
}

/**
 * Il log non deve mai far fallire la notifica: se la scrittura salta, l'errore
 * finisce nei log della function e si va avanti.
 */
export async function scriviLog(admin: SupabaseClient, riga: LogRiga): Promise<void> {
  const { error } = await admin.from('notification_log').insert({
    professional_id: riga.professional_id,
    recipient_email: riga.recipient_email,
    client_user_id: riga.client_user_id ?? null,
    client_id: riga.client_id ?? null,
    kind: riga.kind,
    status: riga.status,
    reason: riga.reason ?? null,
    source_table: riga.source_table ?? null,
    source_id: riga.source_id ?? null,
    event_count: riga.event_count ?? 1,
    payload: riga.payload ?? {},
  })
  if (error) console.error('[notify] scrittura notification_log fallita', error.message, riga)
}

/**
 * Anti-ripetizione: è già partita una email per QUESTO cliente verso QUESTO
 * professionista nell'ultima ora? Contano solo gli invii riusciti, così un
 * errore SMTP non blocca il tentativo successivo.
 */
export async function emailRecente(
  admin: SupabaseClient,
  professionalId: string,
  clientUserId: string,
  minuti = 60,
): Promise<boolean> {
  const da = new Date(Date.now() - minuti * 60_000).toISOString()
  const { data, error } = await admin
    .from('notification_log')
    .select('id')
    .eq('professional_id', professionalId)
    .eq('client_user_id', clientUserId)
    .eq('status', 'sent')
    .gte('created_at', da)
    .limit(1)
  if (error) {
    // Senza memoria è più prudente NON mandare: meglio una notifica persa che
    // una raffica di email uguali.
    console.error('[notify] lettura anti-ripetizione fallita', error.message)
    return true
  }
  return (data ?? []).length > 0
}
