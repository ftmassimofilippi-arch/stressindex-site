import { NextResponse } from 'next/server'
import type { Tr } from '@/i18n/types'

// =============================================================================
// Errori delle route API in forma traducibile.
// =============================================================================
//
// Una route non restituisce più un testo italiano ma un CODICE stabile
// (`{ error: 'client_not_found', code: 'client_not_found' }`). Il componente che
// mostra l'errore lo traduce con `apiErrorMessage(payload, t)` dove
// `t = useTranslations('errors.api')`: se il codice ha una chiave, si mostra
// la traduzione; altrimenti il testo così com'è (compatibilità con codici
// non ancora mappati e con i messaggi di Supabase).
//
// Ogni codice usato dalle route deve avere la chiave `errors.api.<codice>`
// nei tre file messaggi.

export function apiError(code: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, code, ...extra }, { status })
}

type ErrorPayload = { error?: unknown; code?: unknown; message?: unknown } | string | null | undefined

/** Traduce il payload di errore di una route API (o un testo libero) nella lingua corrente. */
export function apiErrorMessage(payload: ErrorPayload, t: Tr & { has?: (key: string) => boolean }, fallback?: string): string {
  const code = typeof payload === 'string' ? payload : String(payload?.code ?? payload?.error ?? payload?.message ?? '')
  if (!code) return fallback ?? t('generic')
  if (/^[a-z0-9_]+$/.test(code) && t.has?.(code)) return t(code)
  return code
}
