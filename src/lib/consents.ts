// Consensi del pacchetto legale 2.1 (sito-048). Modulo "puro": niente
// next/headers, così lo importano anche i client component.

export const PRO_REQUIRED = ['terms_privacy', 'dpa', 'wellness_ack'] as const
export const PRO_OPTIONAL = ['marketing'] as const
export type ProConsentType = (typeof PRO_REQUIRED)[number] | (typeof PRO_OPTIONAL)[number]
export type ProConsents = Record<ProConsentType, boolean>

export const EMPTY_PRO_CONSENTS: ProConsents = {
  terms_privacy: false,
  dpa: false,
  wellness_ack: false,
  marketing: false,
}

/** Consensi salvati nei metadata dell'utente al signUp, registrati al primo accesso. */
export type PendingConsents = ProConsents & { version: string; lang: string; at: string; ua?: string }

export function hasAllRequired(c: Partial<ProConsents>): boolean {
  return PRO_REQUIRED.every((k) => c[k] === true)
}
