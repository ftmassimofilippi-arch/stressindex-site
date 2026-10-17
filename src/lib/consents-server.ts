import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase-server'
import { loadMessages } from '@/i18n/messages'
import { LEGAL_VERSION } from '@/config/company'
import type { Locale } from '@/i18n/routing'
import {
  PRO_OPTIONAL,
  PRO_REQUIRED,
  hasAllRequired,
  type PendingConsents,
  type ProConsentType,
  type ProConsents,
} from '@/lib/consents'

// Registrazione e verifica dei consensi 2.1 (sito-048). Ogni consenso è una
// riga a sé in `gdpr_consents`, mai aggiornata: una revoca è una riga nuova.
// L'impronta SHA-256 è calcolata sui testi pubblicati nella lingua in cui
// l'utente accetta, quindi insieme al tag git prova quale testo ha visto.

const HASHED_NAMESPACES: Record<ProConsentType, string[]> = {
  terms_privacy: ['privacy', 'legal.terms', 'legal.privacyApp'],
  dpa: ['legal.dpa', 'legal.subprocessors'],
  wellness_ack: ['consents.wellness_ack', 'legal.terms.sections.s05Disclaimer'],
  marketing: ['consents.marketing'],
}

function pick(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
}

const hashCache = new Map<string, string>()

export async function textHash(type: ProConsentType, lang: Locale): Promise<string> {
  const key = `${type}:${lang}`
  const cached = hashCache.get(key)
  if (cached) return cached
  const messages = await loadMessages(lang)
  const payload = HASHED_NAMESPACES[type].map((p) => JSON.stringify(pick(messages, p) ?? null)).join('\n')
  const h = createHash('sha256').update(`${LEGAL_VERSION}\n${payload}`).digest('hex')
  hashCache.set(key, h)
  return h
}

export type ConsentStatus = 'ok' | 'missing' | 'unavailable'

/**
 * Lo stato dei consensi obbligatori 2.1 dell'utente loggato. Se la vista non
 * esiste ancora (sito-048 non applicata) risponde 'unavailable': il layout non
 * blocca nessuno finché la migrazione non è in produzione.
 */
export async function proConsentStatus(userId: string): Promise<ConsentStatus> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gdpr_consents_current')
    .select('consent_type, granted, text_version')
    .eq('user_id', userId)
    .in('consent_type', [...PRO_REQUIRED])
  if (error) {
    console.error('[consents] gdpr_consents_current', error.message)
    return 'unavailable'
  }
  const ok = PRO_REQUIRED.every((t) =>
    (data ?? []).some((r) => r.consent_type === t && r.granted === true && r.text_version === LEGAL_VERSION),
  )
  return ok ? 'ok' : 'missing'
}

type RecordInput = {
  userId: string
  consents: ProConsents
  lang: Locale
  ip: string | null
  userAgent: string | null
  grantedAt?: string
}

/** Una riga per ogni consenso, obbligatori e facoltativi (anche quelli non dati). */
export async function recordProConsents(input: RecordInput): Promise<{ ok: boolean; error?: string }> {
  if (!hasAllRequired(input.consents)) return { ok: false, error: 'required_missing' }
  const supabase = await createClient()
  const grantedAt = input.grantedAt ?? new Date().toISOString()
  const types = [...PRO_REQUIRED, ...PRO_OPTIONAL] as ProConsentType[]
  const rows = await Promise.all(
    types.map(async (t) => ({
      professionista_id: input.userId,
      consent_type: t,
      granted: input.consents[t] === true,
      text_version: LEGAL_VERSION,
      text_sha256: await textHash(t, input.lang),
      text_lang: input.lang,
      granted_at: grantedAt,
      ip_address: input.ip,
      user_agent: input.userAgent?.slice(0, 500) ?? null,
      source: 'site',
      // colonne 1.0, tenute coerenti per le versioni dell'app che le leggono
      privacy_accepted: input.consents.terms_privacy,
      service_accepted: input.consents.terms_privacy,
      marketing_accepted: input.consents.marketing,
      accepted_at: grantedAt,
      version: LEGAL_VERSION,
    })),
  )
  const { error } = await supabase.from('gdpr_consents').insert(rows)
  if (error) {
    console.error('[consents] insert', error.message)
    return { ok: false, error: 'insert_failed' }
  }
  return { ok: true }
}

/** Consensi dati in registrazione (metadata del signUp) e non ancora registrati. */
export function pendingFromMetadata(meta: Record<string, unknown> | undefined): PendingConsents | null {
  const p = meta?.pending_consents as PendingConsents | undefined
  if (!p || p.version !== LEGAL_VERSION || !hasAllRequired(p)) return null
  return p
}
