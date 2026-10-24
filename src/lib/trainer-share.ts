// =============================================================================
// Condivisione con il formatore (Master HRV): tipi e regole "pure"
// =============================================================================
//
// Un professionista condivide con il formatore (il superadmin
// info@massimofilippi.it, ricavato dal database con `trainer_user_id()`) le
// proprie misurazioni o quelle di un suo cliente, in forma pseudonimizzata e
// per 90 giorni. Tutta la logica di accesso sta nel database (sito-051): qui
// solo tipi, costanti e il flag del banner. Niente `next/headers`: questo
// modulo è importato anche dai client component.

/** Versione del testo di consenso: cambia se cambia il testo mostrato. */
export const TRAINER_SHARE_TEXT_VERSION = 'trainer_share_v1'

/** Giorni di validità di una condivisione (default della colonna expires_at). */
export const TRAINER_SHARE_DAYS = 90

/** Percorso della pagina del professionista (slug italiano in tutte le lingue). */
export const TRAINER_SHARE_PATH = '/area-professionisti/condividi-formatore'

/** Chiave localStorage della chiusura del banner. */
export const TRAINER_SHARE_BANNER_KEY = 'sx-trainer-share-banner-dismissed'

/**
 * Interruttore del banner e della voce di menu. Si spegne con
 * `NEXT_PUBLIC_TRAINER_SHARE_BANNER=0` (o `false`, `off`); senza variabile è acceso.
 * Letto a build time perché ha il prefisso NEXT_PUBLIC_.
 */
export const TRAINER_SHARE_BANNER_ENABLED = !/^(0|false|off|no)$/i.test(
  (process.env.NEXT_PUBLIC_TRAINER_SHARE_BANNER ?? '').trim(),
)

/** Una riga di `trainer_share_candidates()`: "Le mie misurazioni" (client_id null) o un cliente. */
export type TrainerShareCandidate = {
  client_id: string | null
  nome: string | null
  cognome: string | null
  /** Codice caso che vedrà il formatore ("M.R. 1978 F", "Sé stesso 1975"); null se manca tutto. */
  case_code: string | null
  n_misurazioni: number
  /** Condivisione attiva (non revocata, non scaduta), se c'è. */
  share_id: string | null
  share_granted_at: string | null
  share_expires_at: string | null
}

/** Riga di `trainer_shares` come la restituiscono grant e revoke. */
export type TrainerShare = {
  id: string
  professional_id: string
  client_id: string | null
  scope: string
  granted_at: string
  expires_at: string
  revoked_at: string | null
  consent_record_id: string | null
}

/** Una riga di `trainer_shared_measurements()` (vista del formatore). */
export type TrainerSharedRow = {
  share_id: string
  professional_id: string
  professional_name: string | null
  /** `clients.id` oppure `self:<uid>`: raggruppa, non identifica. */
  case_key: string
  case_code: string | null
  is_self: boolean
  granted_at: string
  expires_at: string
  /** Dati di misura e di analisi, senza user_id, client_id e colonne libere. */
  measurement: Record<string, unknown>
}

/** Chiavi che NON devono mai comparire nel payload del formatore. */
export const TRAINER_SHARE_FORBIDDEN_KEYS = [
  'user_id', 'client_id', 'rr_raw', 'live_tags', 'tag_comparison',
  'nome', 'cognome', 'email', 'telefono', 'note', 'notes', 'patologie', 'farmaci', 'anamnesi',
  'obiettivi', 'ricerca', 'data_nascita', 'notes_professionista', 'indicazioni',
] as const

/** Vero se il payload contiene una chiave vietata (controllo di sicurezza lato client e nei test). */
export function trainerPayloadHasForbiddenKeys(rows: ReadonlyArray<Pick<TrainerSharedRow, 'measurement'>>): string | null {
  const forbidden = new Set<string>(TRAINER_SHARE_FORBIDDEN_KEYS)
  for (const r of rows) {
    for (const k of Object.keys(r.measurement ?? {})) if (forbidden.has(k)) return k
  }
  return null
}

/** Soggetti scelti nella pagina: la stringa vuota non è un id valido. */
export function normalizeClientIds(input: unknown): Array<string | null> | null {
  if (!Array.isArray(input)) return null
  const out: Array<string | null> = []
  for (const v of input) {
    if (v === null) out.push(null)
    else if (typeof v === 'string' && v.trim()) out.push(v.trim())
    else return null
  }
  return Array.from(new Set(out.map((v) => v ?? '__self__'))).map((v) => (v === '__self__' ? null : v))
}
