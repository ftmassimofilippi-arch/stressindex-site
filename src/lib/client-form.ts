// =============================================================================
// Anagrafica cliente: campi e validazioni, identiche all'app Flutter
// =============================================================================
//
// Le regole vivono qui, in un modulo senza dipendenze, e le usano DUE volte: il
// form nel browser (per dire subito al professionista cosa manca) e la route
// server-side (perché una validazione che sta solo nel browser non è una
// validazione). Qualsiasi divergenza fra i due lati sarebbe un bug, quindi il
// codice è uno.
//
// Riferimento: hrv_app/lib/screens/client_form_screen.dart (validator dei
// campi) e lib/models/client.dart (valori ammessi degli elenchi). I messaggi
// d'errore sono chiavi del namespace `clients.form.validation` (le stesse
// frasi degli ARB dell'app, così il professionista legge le parole che
// conosce già): questo modulo non traduce, perché gira anche nella route.

import type { Tr } from '@/i18n/types'

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Solo M e F: nell'app il menu "Sesso" ha esattamente questi due valori.
 *  `labelKey` è relativa al namespace `clients.form`. */
export const SESSI = [
  { value: 'M', labelKey: 'sex.M' },
  { value: 'F', labelKey: 'sex.F' },
] as const

/** Client.livelliAttivita */
export const LIVELLI_ATTIVITA = [
  { value: 'sedentario', labelKey: 'activity.sedentario' },
  { value: 'moderato', labelKey: 'activity.moderato' },
  { value: 'attivo', labelKey: 'activity.attivo' },
  { value: 'atleta', labelKey: 'activity.atleta' },
] as const

/** Client.competitiveLevels */
export const LIVELLI_COMPETITIVI = [
  { value: 'amateur', labelKey: 'competitive.amateur' },
  { value: 'semi_pro', labelKey: 'competitive.semi_pro' },
  { value: 'professional', labelKey: 'competitive.professional' },
  { value: 'elite', labelKey: 'competitive.elite' },
] as const

/** Come il cliente riceverà l'accesso all'app, se lo riceve. */
export type AccessMode = 'nessuno' | 'invito' | 'password'

export type ClientFormData = {
  nome: string
  cognome: string
  data_nascita: string
  sesso: string
  peso: string
  altezza: string
  fumatore: boolean | null
  atleta: boolean | null
  livello_attivita: string
  email: string
  telefono: string
  note: string
  // Sport: nell'app questa sezione compare solo col piano pro.
  sport: string
  competitive_level: string
  current_goal: string
  hr_max: string
  ftp_estimated: string
  accessMode: AccessMode
  password: string
}

export const FORM_VUOTO: ClientFormData = {
  nome: '', cognome: '', data_nascita: '', sesso: '', peso: '', altezza: '',
  fumatore: null, atleta: null, livello_attivita: '', email: '', telefono: '', note: '',
  sport: '', competitive_level: '', current_goal: '', hr_max: '', ftp_estimated: '',
  accessMode: 'invito', password: '',
}

/** Numero decimale "all'italiana": la virgola vale come il punto, come nell'app. */
export function parseDecimale(v: string): number | null {
  const s = v.trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function parseIntero(v: string): number | null {
  const s = v.trim()
  if (!s) return null
  const n = Number(s)
  return Number.isInteger(n) ? n : null
}

/** Errore di un campo: chiave in `clients.form.validation` più i valori da
 *  interpolare (es. `{ key: 'range', values: { min: 20, max: 300 } }`). */
export type ErroreCampo = { key: string; values?: Record<string, number> }

/** Un errore per campo, con la chiave del campo. Vuoto = si può salvare. */
export type ErroriForm = Partial<Record<keyof ClientFormData, ErroreCampo>>

/** Testo tradotto di un errore di campo (`t = useTranslations('clients.form')`). */
export function testoErroreCampo(e: ErroreCampo | undefined, t: Tr): string | undefined {
  if (!e) return undefined
  return t(`validation.${e.key}`, e.values)
}

function range(v: string, min: number, max: number, intero: boolean): ErroreCampo | null {
  if (!v.trim()) return null
  const n = intero ? parseIntero(v) : parseDecimale(v)
  if (n === null || n < min || n > max) return { key: 'range', values: { min, max } }
  return null
}

const NON_AMMESSO: ErroreCampo = { key: 'notAllowed' }

/**
 * Le stesse condizioni dei validator Flutter, nello stesso ordine.
 * Nome, cognome ed email sono obbligatori anche nell'app: l'email perché senza
 * di essa il cliente non potrà mai collegare le proprie misurazioni.
 */
export function validaClientForm(d: ClientFormData): ErroriForm {
  const e: ErroriForm = {}

  if (!d.nome.trim()) e.nome = { key: 'firstNameRequired' }
  if (!d.cognome.trim()) e.cognome = { key: 'lastNameRequired' }

  const peso = range(d.peso, 20, 300, false)
  if (peso) e.peso = peso
  const altezza = range(d.altezza, 50, 250, false)
  if (altezza) e.altezza = altezza

  const email = d.email.trim()
  if (!email) e.email = { key: 'emailRequired' }
  else if (!EMAIL_RE.test(email)) e.email = { key: 'emailInvalid' }

  const hr = range(d.hr_max, 80, 230, true)
  if (hr) e.hr_max = hr
  const ftp = range(d.ftp_estimated, 50, 600, true)
  if (ftp) e.ftp_estimated = ftp

  if (d.sesso && !SESSI.some((s) => s.value === d.sesso)) e.sesso = NON_AMMESSO
  if (d.livello_attivita && !LIVELLI_ATTIVITA.some((s) => s.value === d.livello_attivita)) {
    e.livello_attivita = NON_AMMESSO
  }
  if (d.competitive_level && !LIVELLI_COMPETITIVI.some((s) => s.value === d.competitive_level)) {
    e.competitive_level = NON_AMMESSO
  }

  if (d.accessMode === 'password' && d.password.length < 8) {
    e.password = { key: 'passwordMin', values: { min: 8 } }
  }

  return e
}

/**
 * Riga `clients` da salvare — gli stessi campi che l'app manda in
 * SyncService._clientToRow, niente di più.
 *
 * Fuori restano `obiettivi`, `patologie`, `farmaci`, `anamnesi` e
 * `data_inizio_percorso`: l'app li mostra nel form ma NON li sincronizza, vivono
 * solo nella cache cifrata del telefono. Scriverli da qui creerebbe dati che
 * l'app non sa di avere e che sparirebbero alla prima modifica dal telefono.
 *
 * `data_nascita` resta la stringa 'YYYY-MM-DD' dell'input date: convertirla in
 * un istante la sposterebbe di un giorno a seconda del fuso, che è esattamente
 * il motivo per cui l'app la formatta a mano.
 */
export function rigaClients(d: ClientFormData, id: string, professionistaId: string): Record<string, unknown> {
  const riga: Record<string, unknown> = {
    id,
    professionista_id: professionistaId,
    nome: d.nome.trim() || null,
    cognome: d.cognome.trim() || null,
    email: d.email.trim().toLowerCase() || null,
    created_at: new Date().toISOString(),
  }
  const testo = (v: string) => (v.trim() ? v.trim() : null)
  if (d.data_nascita) riga.data_nascita = d.data_nascita
  if (d.sesso) riga.sesso = d.sesso
  if (testo(d.telefono)) riga.telefono = testo(d.telefono)
  if (testo(d.note)) riga.note = testo(d.note)
  if (d.peso.trim()) riga.peso = parseDecimale(d.peso)
  if (d.altezza.trim()) riga.altezza = parseDecimale(d.altezza)
  if (d.fumatore !== null) riga.fumatore = d.fumatore
  if (d.atleta !== null) riga.atleta = d.atleta
  if (d.livello_attivita) riga.livello_attivita = d.livello_attivita
  if (testo(d.sport)) riga.sport = testo(d.sport)
  if (d.competitive_level) riga.competitive_level = d.competitive_level
  if (testo(d.current_goal)) riga.current_goal = testo(d.current_goal)
  if (d.hr_max.trim()) riga.hr_max = parseIntero(d.hr_max)
  if (d.ftp_estimated.trim()) riga.ftp_estimated = parseIntero(d.ftp_estimated)
  return riga
}
