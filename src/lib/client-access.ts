import type { SupabaseClient } from '@supabase/supabase-js'
import { emailLayout, escapeHtml, sendMail, type EsitoEmail } from './mailer'
import type { ClientScope } from './professional-guard'
import { RATE_LIMIT_24H, type AccessAction, type ClientAccessState } from './access-password'
import { getTranslator } from './i18n-server'
import type { Locale } from '@/i18n/routing'

// Ri-esportati per comodità delle route, che importano solo da qui.
export { PASSWORD_MIN, RATE_LIMIT_24H, generaPasswordTemporanea, passwordProblema } from './access-password'
export type { AccessAction, ClientAccessState } from './access-password'

// =============================================================================
// Accesso app del cliente: stato, rate limit, registro, avvisi
// =============================================================================
//
// Il professionista non è l'amministratore del cliente: può rimettere in piedi
// un accesso, non prendere il controllo di un account già in uso. Da qui in giù
// tutto ruota intorno a una sola distinzione:
//
//   • account MAI USATO (last_sign_in_at nullo) → è ancora una consegna di
//     credenziali: si può impostare una password temporanea, che il cliente
//     dovrà cambiare al primo accesso (must_change_password);
//   • account ATTIVO → la password è del cliente. Il professionista non la
//     imposta e non la vede: può solo far ripartire il recupero, che passa
//     dall'email del cliente.
//
// Ogni azione è registrata, limitata a 5 per cliente ogni 24 ore, e il cliente
// riceve un avviso: così un intervento sul suo accesso non è mai invisibile.

/**
 * La tabella non esiste ancora (migration 027 da applicare).
 *
 * PostgREST non restituisce il 42P01 di Postgres: la tabella non è nella cache
 * dello schema e l'errore è PGRST205 (o PGRST204 per una colonna). Controllare
 * solo 42P01 avrebbe riempito i log di errori senza motivo.
 */
function tabellaAssente(error: { code?: string | null; message?: string } | null): boolean {
  const code = error?.code ?? ''
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST204'
}

// ── Stato ────────────────────────────────────────────────────────────────────

export async function readClientAccessState(
  admin: SupabaseClient,
  professionalId: string,
  scope: ClientScope,
): Promise<ClientAccessState> {
  const { count, recent } = await readLog(admin, professionalId, scope.clientId)

  if (!scope.clientUserId) {
    return {
      hasAccount: false,
      email: scope.email,
      lastSignInAt: null,
      neverUsed: true,
      mustChangePassword: false,
      linkActive: false,
      actionsLast24h: count,
      actionsLeft: Math.max(0, RATE_LIMIT_24H - count),
      recent,
    }
  }

  const { data, error } = await admin.auth.admin.getUserById(scope.clientUserId)
  if (error) console.error('[client-access] getUserById fallita', error.message)
  const authUser = data?.user ?? null

  // must_change_password esiste solo dopo la migration 027: se manca, la select
  // fallisce con 42703 e si prosegue come se il flag fosse falso.
  let mustChange = false
  const { data: prof, error: profErr } = await admin
    .from('profiles')
    .select('must_change_password')
    .eq('id', scope.clientUserId)
    .maybeSingle()
  if (profErr) {
    // 42703 da Postgres, PGRST204 dalla cache dello schema di PostgREST: in
    // entrambi i casi la colonna non c'è ancora e il flag conta come falso.
    if (!tabellaAssente(profErr) && profErr.code !== '42703') {
      console.error('[client-access] lettura must_change_password fallita', profErr.message)
    }
  } else {
    mustChange = !!(prof as { must_change_password?: boolean } | null)?.must_change_password
  }

  const lastSignInAt = authUser?.last_sign_in_at ?? null
  return {
    hasAccount: true,
    email: authUser?.email ?? scope.email,
    lastSignInAt,
    neverUsed: !lastSignInAt,
    mustChangePassword: mustChange,
    linkActive: scope.linkActive,
    actionsLast24h: count,
    actionsLeft: Math.max(0, RATE_LIMIT_24H - count),
    recent,
  }
}

async function readLog(
  admin: SupabaseClient,
  professionalId: string,
  clientId: string,
): Promise<{ count: number; recent: Array<{ action: AccessAction; created_at: string }> }> {
  const da = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from('professional_access_log')
    .select('action, created_at')
    .eq('professional_id', professionalId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) {
    // Tabella assente (migration 027 non applicata): nessuno storico, ma non si
    // blocca la pagina. Il rate limit però non è calcolabile, quindi si parte da
    // zero e la route lo dirà se la scrittura del registro fallisce.
    if (!tabellaAssente(error)) console.error('[client-access] lettura registro fallita', error.message)
    return { count: 0, recent: [] }
  }
  const righe = (data ?? []) as Array<{ action: AccessAction; created_at: string }>
  return { count: righe.filter((r) => r.created_at >= da).length, recent: righe.slice(0, 5) }
}

// ── Rate limit ───────────────────────────────────────────────────────────────

export type RateCheck = { ok: true; used: number } | { ok: false; used: number; retryAfter: string | null }

/**
 * Massimo RATE_LIMIT_24H azioni per cliente in 24 ore, contate sul registro.
 * Se il registro non è leggibile la porta resta aperta: il limite è una
 * protezione dall'abuso, non un meccanismo di sicurezza, e non deve diventare
 * un blocco permanente per una migration non applicata.
 */
export async function checkRateLimit(
  admin: SupabaseClient,
  professionalId: string,
  clientId: string,
): Promise<RateCheck> {
  const da = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from('professional_access_log')
    .select('created_at')
    .eq('professional_id', professionalId)
    .eq('client_id', clientId)
    .gte('created_at', da)
    .order('created_at', { ascending: true })
  if (error) {
    if (!tabellaAssente(error)) console.error('[client-access] rate limit non verificabile', error.message)
    return { ok: true, used: 0 }
  }
  const righe = (data ?? []) as Array<{ created_at: string }>
  if (righe.length < RATE_LIMIT_24H) return { ok: true, used: righe.length }
  // La più vecchia dentro la finestra decide quando si libera uno slot.
  const prima = righe[0]?.created_at ?? null
  const retryAfter = prima ? new Date(new Date(prima).getTime() + 24 * 60 * 60 * 1000).toISOString() : null
  return { ok: false, used: righe.length, retryAfter }
}

// ── Registro ─────────────────────────────────────────────────────────────────

export async function logAccessAction(
  admin: SupabaseClient,
  riga: {
    professionalId: string
    clientId: string
    clientUserId: string | null
    action: AccessAction
    details?: Record<string, unknown>
  },
): Promise<{ logged: boolean; reason?: string }> {
  const { error } = await admin.from('professional_access_log').insert({
    professional_id: riga.professionalId,
    client_id: riga.clientId,
    client_user_id: riga.clientUserId,
    action: riga.action,
    details: riga.details ?? {},
  })
  if (error) {
    console.error('[client-access] scrittura registro fallita', error.message)
    return { logged: false, reason: error.message }
  }
  return { logged: true }
}

// ── Avviso al cliente ────────────────────────────────────────────────────────

/**
 * Nome con cui il professionista si presenta al cliente. Senza nome si resta
 * sul generico (`fallback`, es. "Il tuo professionista" tradotto): meglio di
 * una email firmata da nessuno.
 */
export function nomeProfessionista(
  p: { titolo?: string | null; nome?: string | null; cognome?: string | null } | null,
  fallback: string,
): string {
  const pieno = [p?.titolo, p?.nome, p?.cognome].map((v) => (v ?? '').trim()).filter(Boolean).join(' ')
  return pieno || fallback
}

/**
 * Avvisa il cliente di ciò che è stato fatto sul suo accesso, nella lingua del
 * professionista che ha agito (`locale`; i testi stanno in `emails.access.*`).
 * Best effort: se non parte, l'azione resta valida e il motivo (un codice
 * stabile, tradotto dalla UI) finisce nel registro.
 */
export async function notifyClientOfAccessAction(opts: {
  to: string | null
  action: Exclude<AccessAction, 'create_access'>
  professionalName: string
  professionalEmail?: string | null
  locale: Locale
}): Promise<EsitoEmail> {
  if (!opts.to) return { sent: false, reason: 'no_email' }
  const t = await getTranslator(opts.locale, 'emails.access')
  const subject = t(`${opts.action}.subject`)
  const titolo = t(`${opts.action}.title`)
  const azione = t(`${opts.action}.action`)
  const isTemp = opts.action === 'set_temp_password'

  const paragrafi = [
    t('intro', { who: `<strong>${escapeHtml(opts.professionalName)}</strong>`, action: escapeHtml(azione) }),
    escapeHtml(isTemp ? t('tempPasswordHtml') : t('resetHtml')),
    // Contiene <strong> voluto: la chiave è HTML per costruzione, si legge
    // grezza per non farla interpretare come tag ICU.
    String(t.raw('warningHtml')),
  ]

  const text = [
    titolo,
    '',
    t('intro', { who: opts.professionalName, action: azione }),
    '',
    isTemp ? t('tempPasswordText') : t('resetText'),
    '',
    t('warningText'),
    '',
    t('signature'),
  ].join('\n')

  return sendMail({
    to: opts.to,
    replyTo: opts.professionalEmail ?? undefined,
    subject,
    html: emailLayout(titolo, paragrafi, t('footer'), opts.locale),
    text,
  })
}

