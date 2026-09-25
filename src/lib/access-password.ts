// =============================================================================
// Accesso cliente: tipi e helper puri, usabili anche nel browser
// =============================================================================
//
// Sta separato da client-access.ts perché quello importa nodemailer e la
// service_role: tirarlo in un componente client farebbe finire il mailer (e la
// chiave) nel bundle del browser. Qui dentro non ci sono dipendenze, solo
// costanti, tipi e due funzioni che girano identiche da entrambi i lati.

/** Azioni tracciate in professional_access_log. */
export type AccessAction = 'set_temp_password' | 'send_reset_email' | 'copy_reset_link' | 'create_access'

/** Tetto di azioni sull'accesso, per cliente, in 24 ore. */
export const RATE_LIMIT_24H = 5

/** Minimo richiesto per una password impostata dal professionista. */
export const PASSWORD_MIN = 8

export type ClientAccessState = {
  hasAccount: boolean
  email: string | null
  /** null = mai entrato nell'app. */
  lastSignInAt: string | null
  neverUsed: boolean
  mustChangePassword: boolean
  linkActive: boolean
  actionsLast24h: number
  actionsLeft: number
  recent: Array<{ action: AccessAction; created_at: string }>
}

export function passwordProblema(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `La password deve avere almeno ${PASSWORD_MIN} caratteri.`
  return null
}

/**
 * Password temporanea leggibile ad alta voce: niente caratteri ambigui
 * (0/O, 1/l/I) perché di solito viene dettata al telefono o scritta a mano.
 */
export function generaPasswordTemporanea(lunghezza = 12): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const valori = new Uint32Array(lunghezza)
  crypto.getRandomValues(valori)
  return Array.from(valori, (v) => alfabeto[v % alfabeto.length]).join('')
}

export const AZIONE_LABEL: Record<AccessAction, string> = {
  create_access: 'Accesso creato',
  set_temp_password: 'Password temporanea impostata',
  send_reset_email: 'Email di ripristino inviata',
  copy_reset_link: 'Link di ripristino generato',
}
