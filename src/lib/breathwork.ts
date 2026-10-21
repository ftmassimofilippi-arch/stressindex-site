// Breathwork (app, migrazioni app-062…064): tipi delle tabelle
// `programma_attivita`, `programma_completamenti`, `breathwork_sessions`,
// `breathwork_exercises` con la coercizione al confine, e il calendario
// delle attività (porting di
// lib/features/breathwork/domain/calendario_attivita.dart: se cambia uno
// cambia l'altro): occorrenze previste in un giorno, aderenza fatte/previste
// per settimana e sulle ultime quattro.
//
// Il sito legge: nessun indice viene ricalcolato qui. Modulo puro (niente
// next/headers): lo importano anche i client component e `node --test`.
import { PERCORSI, faseAllaSettimana, giorniFra, lunediDi, piuGiorni, settimanaDelPercorso, type TipoPercorso } from './biofeedback.ts'

function toNum(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function toStr(value: unknown): string | null {
  if (value == null) return null
  return typeof value === 'string' ? value : String(value)
}

function n0(v: unknown): number {
  return toNum(v) ?? 0
}

type Raw = Record<string, unknown>

// ── Tipi ────────────────────────────────────────────────────────────────────

export type TipoAttivita = 'biofeedback_percorso' | 'esercizio_respiro' | 'test_hrv'
export type StatoAttivita = 'attivo' | 'sospeso' | 'completato' | 'chiuso'

export type CalendarioAttivita = {
  /** 1 = lunedì … 7 = domenica. */
  giorni: number[]
  /** Null per il percorso Biofeedback: le volte le decide il percorso. */
  volte_giorno: number | null
  /** "HH:MM", in ordine. */
  orari: string[]
}

export type AttivitaProgramma = {
  id: string
  professional_id: string
  client_user_id: string
  client_id: string | null
  tipo: TipoAttivita
  riferimento: string | null
  parametri: Record<string, unknown>
  calendario: CalendarioAttivita
  /** Data (YYYY-MM-DD), mai convertita. */
  inizio: string
  fine: string | null
  settimane: number | null
  stato: StatoAttivita
  nota_cliente: string | null
  created_at: string | null
}

export type Completamento = {
  id: string
  attivita_id: string
  user_id: string
  /** YYYY-MM-DD */
  giorno: string
  fascia: number
  fatto_il: string
  modo: 'automatico' | 'manuale'
  sessione_tipo: 'breathwork' | 'biofeedback' | 'hrv' | null
  sessione_id: string | null
  nota: string | null
}

export type PuntoFc = { s: number; bpm: number }

export type BreathworkSession = {
  id: string
  user_id: string
  client_id: string | null
  professional_id: string | null
  attivita_id: string | null
  esercizio_id: string | null
  esercizio_nome: string
  iniziata_il: string
  tz_offset_minutes: number
  durata_s: number
  /** Null = pratica libera a durata aperta. */
  durata_prevista_s: number | null
  cicli_completati: number
  cicli_previsti: number | null
  con_sensore: boolean
  fc_media: number | null
  fc_inizio: number | null
  fc_fine: number | null
  rmssd_ms: number | null
  rmssd_inizio: number | null
  rmssd_fine: number | null
  serie_fc: PuntoFc[]
  battiti: number
  artefatti: number
  umore_dopo: number | null
  completata: boolean
}

export type TestiEsercizio = { nome: string; descrizione: string; info: string; avvertenze: string }

export type Esercizio = {
  id: string
  owner_id: string | null
  categoria: string
  lingua: string
  testi: Record<string, TestiEsercizio>
  durata_modo: 'cicli' | 'minuti'
  durata_valore: number
  attivo: boolean
}

export function parseAttivita(r: Raw): AttivitaProgramma | null {
  const id = toStr(r.id)
  const pro = toStr(r.professional_id)
  const cli = toStr(r.client_user_id)
  const inizio = toStr(r.inizio)
  const tipo = toStr(r.tipo)
  if (!id || !pro || !cli || !inizio) return null
  if (tipo !== 'biofeedback_percorso' && tipo !== 'esercizio_respiro' && tipo !== 'test_hrv') return null
  const cal = (r.calendario ?? {}) as Raw
  const giorniRaw = Array.isArray(cal.giorni) ? cal.giorni : [1, 2, 3, 4, 5, 6, 7]
  const giorni = giorniRaw.map((g) => toNum(g)).filter((g): g is number => g != null && g >= 1 && g <= 7)
  const orari = (Array.isArray(cal.orari) ? cal.orari : []).map((o) => toStr(o)).filter((o): o is string => !!o && /^\d{2}:\d{2}/.test(o)).map((o) => o.slice(0, 5)).sort()
  const stato = toStr(r.stato)
  const fine = toStr(r.fine)
  return {
    id,
    professional_id: pro,
    client_user_id: cli,
    client_id: toStr(r.client_id),
    tipo,
    riferimento: toStr(r.riferimento),
    parametri: (r.parametri && typeof r.parametri === 'object' ? (r.parametri as Record<string, unknown>) : {}),
    calendario: { giorni: giorni.length === 0 ? [1, 2, 3, 4, 5, 6, 7] : giorni, volte_giorno: toNum(cal.volte_giorno), orari },
    inizio: inizio.slice(0, 10),
    fine: fine ? fine.slice(0, 10) : null,
    settimane: toNum(r.settimane),
    stato: (stato === 'sospeso' || stato === 'completato' || stato === 'chiuso' ? stato : 'attivo') as StatoAttivita,
    nota_cliente: toStr(r.nota_cliente),
    created_at: toStr(r.created_at),
  }
}

export function parseCompletamento(r: Raw): Completamento | null {
  const id = toStr(r.id)
  const att = toStr(r.attivita_id)
  const user = toStr(r.user_id)
  const giorno = toStr(r.giorno)
  const fatto = toStr(r.fatto_il)
  if (!id || !att || !user || !giorno || !fatto) return null
  const tipo = toStr(r.sessione_tipo)
  return {
    id,
    attivita_id: att,
    user_id: user,
    giorno: giorno.slice(0, 10),
    fascia: n0(r.fascia),
    fatto_il: fatto,
    modo: toStr(r.modo) === 'manuale' ? 'manuale' : 'automatico',
    sessione_tipo: tipo === 'breathwork' || tipo === 'biofeedback' || tipo === 'hrv' ? tipo : null,
    sessione_id: toStr(r.sessione_id),
    nota: toStr(r.nota),
  }
}

export function parseBreathworkSession(r: Raw): BreathworkSession | null {
  const id = toStr(r.id)
  const user = toStr(r.user_id)
  const inizio = toStr(r.iniziata_il)
  if (!id || !user || !inizio) return null
  const serie = Array.isArray(r.serie_fc) ? (r.serie_fc as Raw[]) : []
  return {
    id,
    user_id: user,
    client_id: toStr(r.client_id),
    professional_id: toStr(r.professional_id),
    attivita_id: toStr(r.attivita_id),
    esercizio_id: toStr(r.esercizio_id),
    esercizio_nome: toStr(r.esercizio_nome) ?? '',
    iniziata_il: inizio,
    tz_offset_minutes: n0(r.tz_offset_minutes),
    durata_s: n0(r.durata_s),
    durata_prevista_s: toNum(r.durata_prevista_s),
    cicli_completati: n0(r.cicli_completati),
    cicli_previsti: toNum(r.cicli_previsti),
    con_sensore: r.con_sensore === true,
    fc_media: toNum(r.fc_media),
    fc_inizio: toNum(r.fc_inizio),
    fc_fine: toNum(r.fc_fine),
    rmssd_ms: toNum(r.rmssd_ms),
    rmssd_inizio: toNum(r.rmssd_inizio),
    rmssd_fine: toNum(r.rmssd_fine),
    serie_fc: serie.map((p) => ({ s: n0(p.s), bpm: n0(p.bpm) })),
    battiti: n0(r.battiti),
    artefatti: n0(r.artefatti),
    umore_dopo: toNum(r.umore_dopo),
    completata: typeof r.completata === 'boolean' ? r.completata : true,
  }
}

export function parseEsercizio(r: Raw): Esercizio | null {
  const id = toStr(r.id)
  if (!id) return null
  const testiRaw = (r.testi && typeof r.testi === 'object' ? (r.testi as Raw) : {}) as Raw
  const testi: Record<string, TestiEsercizio> = {}
  for (const [lingua, t] of Object.entries(testiRaw)) {
    if (!t || typeof t !== 'object') continue
    const x = t as Raw
    testi[lingua] = { nome: toStr(x.nome) ?? '', descrizione: toStr(x.descrizione) ?? '', info: toStr(x.info) ?? '', avvertenze: toStr(x.avvertenze) ?? '' }
  }
  return {
    id,
    owner_id: toStr(r.owner_id),
    categoria: toStr(r.categoria) ?? 'calma',
    lingua: toStr(r.lingua) ?? 'it',
    testi,
    durata_modo: toStr(r.durata_modo) === 'cicli' ? 'cicli' : 'minuti',
    durata_valore: n0(r.durata_valore),
    attivo: typeof r.attivo === 'boolean' ? r.attivo : true,
  }
}

/** Il nome dell'esercizio nella lingua, con ripiego sulla sua lingua di riferimento, poi italiano, poi la prima. */
export function nomeEsercizio(e: Esercizio, lingua: string): string {
  const t = e.testi[lingua] ?? e.testi[e.lingua] ?? e.testi.it ?? Object.values(e.testi)[0]
  return t?.nome ?? ''
}

// ── Calendario (identico a calendario_attivita.dart) ────────────────────────

/** Ultimo giorno compreso: `fine`, oppure dalle settimane; null = senza fine. */
export function fineEffettiva(a: AttivitaProgramma): string | null {
  if (a.fine) return a.fine
  if (a.settimane != null) return piuGiorni(a.inizio, a.settimane * 7 - 1)
  return null
}

export function nelPeriodo(a: AttivitaProgramma, giorno: string): boolean {
  if (giorno < a.inizio) return false
  const f = fineEffettiva(a)
  return f == null || giorno <= f
}

/** 1 = lunedì … 7 = domenica della chiave YYYY-MM-DD. */
export function giornoSettimana(giorno: string): number {
  const d = new Date(Date.UTC(+giorno.slice(0, 4), +giorno.slice(5, 7) - 1, +giorno.slice(8, 10)))
  return ((d.getUTCDay() + 6) % 7) + 1
}

function previsteNelGiorno(a: AttivitaProgramma, giorno: string): number {
  if (!nelPeriodo(a, giorno) || !a.calendario.giorni.includes(giornoSettimana(giorno))) return 0
  if (a.tipo === 'biofeedback_percorso') {
    const tipo = (a.riferimento === 'fondamenti' || a.riferimento === 'ripresa_veloce' ? a.riferimento : 'pratica_libera') as TipoPercorso
    const p = PERCORSI[tipo]
    const s = settimanaDelPercorso(a.inizio, giorno)
    if (s < 1) return 0
    if (p.settimane > 0 && s > p.settimane) return 0
    const f = faseAllaSettimana(p, s) ?? p.fasi[p.fasi.length - 1]
    return f.sessioniGiorno
  }
  return a.calendario.volte_giorno ?? 1
}

/** Occorrenze previste da un'attività attiva nel giorno (0 se sospesa o fuori periodo). */
export function occorrenzePreviste(a: AttivitaProgramma, giorno: string): number {
  if (a.stato !== 'attivo') return 0
  return previsteNelGiorno(a, giorno)
}

export type Aderenza = { fatte: number; previste: number; quota: number }

/**
 * Aderenza fra [da] e [a_] compresi, con le previste contate solo fino a
 * [oggi]; i completamenti fuori calendario contano come fatti, mai oltre il
 * previsto del giorno quando c'è un previsto. Lo stato di oggi non cambia il
 * passato (una sospesa ieri aveva le sue occorrenze).
 */
export function aderenzaNelPeriodo(a: AttivitaProgramma, completamenti: Completamento[], da: string, a_: string, oggi: string): Aderenza {
  const limite = oggi < a_ ? oggi : a_
  if (limite < da) return { fatte: 0, previste: 0, quota: 0 }
  const n = giorniFra(da, limite) + 1
  let fatte = 0
  let previste = 0
  for (let i = 0; i < n; i++) {
    const g = piuGiorni(da, i)
    const p = previsteNelGiorno(a, g)
    const f = completamenti.filter((c) => c.attivita_id === a.id && c.giorno === g).length
    previste += p
    fatte += p === 0 ? f : Math.min(f, p)
  }
  return { fatte, previste, quota: previste === 0 ? 0 : Math.min(1, fatte / previste) }
}

export function aderenzaSettimana(a: AttivitaProgramma, c: Completamento[], oggi: string): Aderenza {
  const lun = lunediDi(oggi)
  return aderenzaNelPeriodo(a, c, lun, piuGiorni(lun, 6), oggi)
}

export function aderenza4Settimane(a: AttivitaProgramma, c: Completamento[], oggi: string): Aderenza {
  const lun = lunediDi(oggi)
  return aderenzaNelPeriodo(a, c, piuGiorni(lun, -21), piuGiorni(lun, 6), oggi)
}

/** Aderenza settimana per settimana, dal lunedì di [settimane - 1] settimane fa a oggi. */
export function aderenzaPerSettimane(a: AttivitaProgramma, c: Completamento[], oggi: string, settimane = 4): { lunedi: string; aderenza: Aderenza }[] {
  const out: { lunedi: string; aderenza: Aderenza }[] = []
  const lun = lunediDi(oggi)
  for (let w = settimane - 1; w >= 0; w--) {
    const da = piuGiorni(lun, -7 * w)
    out.push({ lunedi: da, aderenza: aderenzaNelPeriodo(a, c, da, piuGiorni(da, 6), oggi) })
  }
  return out
}

// ── Quello che la scheda cliente riceve dal server ──────────────────────────

export type BreathworkScheda = {
  attivita: AttivitaProgramma[]
  completamenti: Completamento[]
  sessioni: BreathworkSession[]
  esercizi: Esercizio[]
  /** Vero se le tabelle non esistono ancora in produzione. */
  tabelleAssenti: boolean
}

export const BREATHWORK_VUOTO: BreathworkScheda = { attivita: [], completamenti: [], sessioni: [], esercizi: [], tabelleAssenti: false }
