import { cache } from 'react'
import { createHash } from 'node:crypto'
import { createClient } from './supabase-server'
import { loadMessages } from '@/i18n/messages'
import type { Locale } from '@/i18n/routing'
import { TRAINER_SHARE_TEXT_VERSION, type TrainerShareCandidate } from './trainer-share'

// Lato server della condivisione con il formatore (sito-051). Usa la sessione
// dell'utente: le funzioni del database decidono che cosa può fare.

function pick(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
}

const hashCache = new Map<string, string>()

/**
 * Impronta SHA-256 del testo di consenso mostrato nella lingua data
 * (`dashboard.trainerShare.consentText`), con la versione davanti: insieme al
 * tag git prova quale testo ha visto chi ha condiviso.
 */
export async function trainerConsentHash(lang: Locale): Promise<string> {
  const cached = hashCache.get(lang)
  if (cached) return cached
  const messages = await loadMessages(lang)
  const text = pick(messages, 'dashboard.trainerShare.consentText')
  const h = createHash('sha256').update(`${TRAINER_SHARE_TEXT_VERSION}\n${typeof text === 'string' ? text : ''}`).digest('hex')
  hashCache.set(lang, h)
  return h
}

/** Soggetti condivisibili dal professionista loggato, con la condivisione attiva se c'è. */
export const trainerShareCandidates = cache(async (): Promise<{ rows: TrainerShareCandidate[]; error: string | null }> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('trainer_share_candidates')
  if (error) {
    console.error('[trainer-share] trainer_share_candidates', error.message)
    return { rows: [], error: error.message }
  }
  return { rows: (data ?? []) as TrainerShareCandidate[], error: null }
})

/**
 * Vero se il professionista ha almeno una condivisione attiva: il banner della
 * home si mostra solo a chi non ne ha. Se la tabella non risponde (sito-051 non
 * applicata) si risponde `true`, così il banner resta nascosto.
 */
export async function hasActiveTrainerShares(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('trainer_shares')
    .select('id', { count: 'exact', head: true })
    .eq('professional_id', userId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
  if (error) {
    console.error('[trainer-share] trainer_shares count', error.message)
    return true
  }
  return (count ?? 0) > 0
}
