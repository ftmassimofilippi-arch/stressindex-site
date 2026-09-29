// Validazione "pura" del form di registrazione e mappa degli errori di
// Supabase Auth. Nessun testo visibile qui: le funzioni restituiscono CHIAVI
// che il componente traduce con next-intl (`registration.validation.*` e
// `errors.supabase.*`). Il file non importa next-intl né next/headers, così
// resta usabile sia da client component sia da route API.

import type { Tr } from '@/i18n/types'

/** Chiavi di `registration.validation.*`. */
export type ValidationErrorKey =
  | 'firstNameRequired'
  | 'firstNameTooShort'
  | 'lastNameRequired'
  | 'lastNameTooShort'
  | 'emailRequired'
  | 'emailInvalid'
  | 'passwordRequired'
  | 'passwordTooShort'
  | 'confirmPasswordRequired'
  | 'passwordMismatch'
  | 'professionRequired'

export type RegistrationField = 'nome' | 'cognome' | 'email' | 'password' | 'confermaPassword' | 'professione'

/** Errori per campo, come chiavi di traduzione. */
export type FormErrorKeys = Partial<Record<RegistrationField, ValidationErrorKey>>

/** Errori per campo già tradotti, più l'eventuale errore generale (testo). */
export interface FormErrors extends Partial<Record<RegistrationField, string>> {
  general?: string
}

export const PASSWORD_MIN_LENGTH = 8

export function validateRegistrationForm(data: {
  nome: string
  cognome: string
  email: string
  password: string
  confermaPassword: string
  professione: string
}): FormErrorKeys {
  const errors: FormErrorKeys = {}

  if (!data.nome.trim()) {
    errors.nome = 'firstNameRequired'
  } else if (data.nome.trim().length < 2) {
    errors.nome = 'firstNameTooShort'
  }

  if (!data.cognome.trim()) {
    errors.cognome = 'lastNameRequired'
  } else if (data.cognome.trim().length < 2) {
    errors.cognome = 'lastNameTooShort'
  }

  if (!data.email.trim()) {
    errors.email = 'emailRequired'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'emailInvalid'
  }

  if (!data.password) {
    errors.password = 'passwordRequired'
  } else if (data.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = 'passwordTooShort'
  }

  if (!data.confermaPassword) {
    errors.confermaPassword = 'confirmPasswordRequired'
  } else if (data.password !== data.confermaPassword) {
    errors.confermaPassword = 'passwordMismatch'
  }

  if (!data.professione) {
    errors.professione = 'professionRequired'
  }

  return errors
}

/** Traduce le chiavi per campo con `t = useTranslations('registration.validation')`. */
export function translateFormErrors(errors: FormErrorKeys, t: Tr): FormErrors {
  const out: FormErrors = {}
  for (const [field, key] of Object.entries(errors) as [RegistrationField, ValidationErrorKey][]) {
    out[field] = t(key, { min: PASSWORD_MIN_LENGTH })
  }
  return out
}

export function hasErrors(errors: FormErrorKeys | FormErrors): boolean {
  return Object.keys(errors).length > 0
}

// -----------------------------------------------------------------------------
// Errori di Supabase Auth → chiavi di `errors.supabase.*`
// -----------------------------------------------------------------------------

/** Chiavi di `errors.supabase.*`. */
export type SupabaseAuthErrorKey =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'rateLimit'
  | 'alreadyRegistered'
  | 'weakPassword'
  | 'otpExpired'
  | 'banned'
  | 'sessionMissing'
  | 'generic'

/**
 * Riconosce i messaggi (in inglese) restituiti da Supabase Auth e li riporta a
 * una chiave stabile. Accetta sia l'oggetto errore (`code` + `message`) sia il
 * solo messaggio. Tutto ciò che non è riconosciuto diventa `generic`: il testo
 * grezzo di Supabase non va mai mostrato all'utente.
 */
export function supabaseAuthErrorKey(error: { code?: string | null; message?: string | null } | string | null | undefined): SupabaseAuthErrorKey {
  const code = (typeof error === 'string' ? '' : error?.code ?? '').toLowerCase()
  const message = (typeof error === 'string' ? error : error?.message ?? '').toLowerCase()

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) return 'invalidCredentials'
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) return 'emailNotConfirmed'
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || message.includes('rate limit') || message.includes('too many requests'))
    return 'rateLimit'
  if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered') || message.includes('already exists'))
    return 'alreadyRegistered'
  if (code === 'weak_password' || message.includes('password should') || message.includes('password is too') || message.includes('weak password'))
    return 'weakPassword'
  if (code === 'otp_expired' || message.includes('otp_expired') || message.includes('token has expired') || message.includes('is invalid or has expired'))
    return 'otpExpired'
  if (code === 'user_banned' || /\bbanned\b/.test(message)) return 'banned'
  if (code === 'session_not_found' || code === 'session_expired' || message.includes('auth session missing') || message.includes('session'))
    return 'sessionMissing'
  return 'generic'
}
