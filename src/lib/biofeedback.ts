// Biofeedback (app 3.1.0, migrazione app-060): tipi delle tre tabelle con la
// coercizione al confine, il calendario dei percorsi (porting di
// lib/features/biofeedback/domain/percorsi.dart, versione percorsi-1.0.0:
// se cambia uno cambia l'altro) e le letture pure per il tab della scheda
// cliente: aderenza per settimana, celle del calendario, media mobile,
// confronto fra periodi, asse adattivo, avviso "guida contro un limite".
//
// Il sito legge: nessun indice viene ricalcolato qui. Modulo puro (niente
// next/headers): lo importano anche i client component.
// Coercizione locale, come `toNum`/`toStr` di format.ts, senza importarlo:
// questo modulo gira anche in `node --test`, senza date-fns né React.
function toNum(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function toStr(value: unknown): string | null {
  if (value == null) return null
  return typeof value === 'string' ? value : String(value)
}

// ── Tipi ────────────────────────────────────────────────────────────────────

export type SeriePunto = {
  s: number
  stato: 'attesa' | 'attivo' | 'pausa'
  livello: number | null
  score: number | null
  picco_hz: number | null
  artefatti_pct: number
}

export type CambioRitmo = { s: number; da: number; a: number; motivo: string }

export type BiofeedbackSession = {
  id: string
  user_id: string
  client_id: string | null
  professional_id: string | null
  assegnazione_id: string | null
  iniziata_il: string
  tz_offset_minutes: number
  durata_s: number
  durata_prevista_s: number
  ritmo_assegnato: number
  ritmo_finale: number
  ritmo_migliore: number
  inspira_frazione: number
  sfida: number
  secondi_livello: { 1: number; 2: number; 3: number }
  secondi_pausa: number
  secondi_attesa: number
  aggancio_s: number | null
  serie: SeriePunto[]
  cambi_ritmo: CambioRitmo[]
  umore_dopo: number | null
  battiti: number
  artefatti: number
  algorithm_version: string
  completata: boolean
}

export type TipoPercorso = 'fondamenti' | 'ripresa_veloce' | 'pratica_libera'

export type BiofeedbackAssignment = {
  id: string
  professional_id: string
  client_user_id: string
  client_id: string | null
  percorso: TipoPercorso
  ritmo: number
  inspira_frazione: number
  promemoria_ora: string | null
  /** Data (YYYY-MM-DD), mai convertita. */
  inizio: string
  stato: 'attivo' | 'sospeso' | 'completato' | 'chiuso'
  versione_percorsi: string
  created_at: string | null
}

export type StepMeasures = {
  ritmo: number
  battiti: number
  artefatti_pct: number
  fase_gradi: number | null
  fase_coerenza: number | null
  ampiezza_bpm: number | null
  picco_hz: number | null
  picco_rapporto: number | null
  picco_potenza: number | null
  sdnn: number | null
  rmssd: number | null
}

export type ResonanceAssessment = {
  id: string
  user_id: string
  client_id: string | null
  professional_id: string | null
  iniziata_il: string
  tz_offset_minutes: number
  durata_s: number
  ritmi: StepMeasures[]
  voti: Record<string, number | null>
  voti_validi: number
  ritmo_suggerito: number | null
  confidenza: number | null
  ritmo_confermato: number | null
  completata: boolean
}

type Raw = Record<string, unknown>

function n0(v: unknown): number {
  return toNum(v) ?? 0
}

function bool(v: unknown, dflt: boolean): boolean {
  return typeof v === 'boolean' ? v : dflt
}

export function parseBiofeedbackSession(r: Raw): BiofeedbackSession | null {
  const id = toStr(r.id)
  const user = toStr(r.user_id)
  const inizio = toStr(r.iniziata_il)
  if (!id || !user || !inizio) return null
  const liv = (r.secondi_livello ?? {}) as Raw
  const serie = Array.isArray(r.serie) ? (r.serie as Raw[]) : []
  const cambi = Array.isArray(r.cambi_ritmo) ? (r.cambi_ritmo as Raw[]) : []
  return {
    id,
    user_id: user,
    client_id: toStr(r.client_id),
    professional_id: toStr(r.professional_id),
    assegnazione_id: toStr(r.assegnazione_id),
    iniziata_il: inizio,
    tz_offset_minutes: n0(r.tz_offset_minutes),
    durata_s: n0(r.durata_s),
    durata_prevista_s: n0(r.durata_prevista_s),
    ritmo_assegnato: n0(r.ritmo_assegnato),
    ritmo_finale: n0(r.ritmo_finale),
    ritmo_migliore: n0(r.ritmo_migliore),
    inspira_frazione: toNum(r.inspira_frazione) ?? 0.5,
    sfida: toNum(r.sfida) ?? 1,
    secondi_livello: { 1: n0(liv['1']), 2: n0(liv['2']), 3: n0(liv['3']) },
    secondi_pausa: n0(r.secondi_pausa),
    secondi_attesa: n0(r.secondi_attesa),
    aggancio_s: toNum(r.aggancio_s),
    serie: serie.map((p) => ({
      s: n0(p.s),
      stato: (toStr(p.stato) === 'attivo' ? 'attivo' : toStr(p.stato) === 'pausa' ? 'pausa' : 'attesa') as SeriePunto['stato'],
      livello: toNum(p.livello),
      score: toNum(p.score),
      picco_hz: toNum(p.picco_hz),
      artefatti_pct: n0(p.artefatti_pct),
    })),
    cambi_ritmo: cambi.map((c) => ({ s: n0(c.s), da: n0(c.da), a: n0(c.a), motivo: toStr(c.motivo) ?? '' })),
    umore_dopo: toNum(r.umore_dopo),
    battiti: n0(r.battiti),
    artefatti: n0(r.artefatti),
    algorithm_version: toStr(r.algorithm_version) ?? '',
    completata: bool(r.completata, true),
  }
}

/**
 * Un'assegnazione dalla riga di `programma_attivita` (tipo
 * `biofeedback_percorso`, app-064: `riferimento`, `parametri.ritmo`,
 * `calendario.orari[0]`) o, per compatibilità, dalla vecchia riga di
 * `biofeedback_assignments` (`percorso`, `ritmo`, `promemoria_ora`).
 */
export function parseBiofeedbackAssignment(r: Raw): BiofeedbackAssignment | null {
  const id = toStr(r.id)
  const pro = toStr(r.professional_id)
  const cli = toStr(r.client_user_id)
  const inizio = toStr(r.inizio)
  if (!id || !pro || !cli || !inizio) return null
  const tipo = toStr(r.tipo)
  if (tipo != null && tipo !== 'biofeedback_percorso') return null
  const parametri = (r.parametri ?? {}) as Raw
  const calendario = (r.calendario ?? {}) as Raw
  const orari = Array.isArray(calendario.orari) ? calendario.orari : []
  const percorso = toStr(r.riferimento) ?? toStr(r.percorso)
  const stato = toStr(r.stato)
  const promemoria = 'promemoria_ora' in r ? toStr(r.promemoria_ora) : (orari.length > 0 ? toStr(orari[0]) : null)
  return {
    id,
    professional_id: pro,
    client_user_id: cli,
    client_id: toStr(r.client_id),
    percorso: (percorso === 'fondamenti' || percorso === 'ripresa_veloce' ? percorso : 'pratica_libera') as TipoPercorso,
    ritmo: toNum(r.ritmo) ?? n0(parametri.ritmo),
    inspira_frazione: toNum(r.inspira_frazione) ?? toNum(parametri.inspira_frazione) ?? 0.5,
    promemoria_ora: promemoria,
    inizio: inizio.slice(0, 10),
    stato: (stato === 'sospeso' || stato === 'completato' || stato === 'chiuso' ? stato : 'attivo') as BiofeedbackAssignment['stato'],
    versione_percorsi: toStr(r.versione_percorsi) ?? toStr(parametri.versione_percorsi) ?? '',
    created_at: toStr(r.created_at),
  }
}

export function parseResonanceAssessment(r: Raw): ResonanceAssessment | null {
  const id = toStr(r.id)
  const user = toStr(r.user_id)
  const inizio = toStr(r.iniziata_il)
  if (!id || !user || !inizio) return null
  const esito = (r.esito ?? {}) as Raw
  const ritmi = Array.isArray(esito.ritmi) ? (esito.ritmi as Raw[]) : []
  const votiRaw = (esito.voti ?? {}) as Raw
  const voti: Record<string, number | null> = {}
  for (const [k, v] of Object.entries(votiRaw)) voti[k] = toNum(v)
  return {
    id,
    user_id: user,
    client_id: toStr(r.client_id),
    professional_id: toStr(r.professional_id),
    iniziata_il: inizio,
    tz_offset_minutes: n0(r.tz_offset_minutes),
    durata_s: n0(r.durata_s),
    ritmi: ritmi.map((m) => ({
      ritmo: n0(m.ritmo),
      battiti: n0(m.battiti),
      artefatti_pct: n0(m.artefatti_pct),
      fase_gradi: toNum(m.fase_gradi),
      fase_coerenza: toNum(m.fase_coerenza),
      ampiezza_bpm: toNum(m.ampiezza_bpm),
      picco_hz: toNum(m.picco_hz),
      picco_rapporto: toNum(m.picco_rapporto),
      picco_potenza: toNum(m.picco_potenza),
      sdnn: toNum(m.sdnn),
      rmssd: toNum(m.rmssd),
    })),
    voti,
    voti_validi: n0(esito.voti_validi),
    ritmo_suggerito: toNum(r.ritmo_suggerito) ?? toNum(esito.ritmo_suggerito),
    confidenza: toNum(r.confidenza) ?? toNum(esito.confidenza),
    ritmo_confermato: toNum(r.ritmo_confermato),
    completata: bool(r.completata, true),
  }
}

// ── Letture di una sessione ─────────────────────────────────────────────────

export function minutiSintonia(s: BiofeedbackSession): number {
  return s.secondi_livello[3] / 60
}

export function minutiTotali(s: BiofeedbackSession): number {
  return s.durata_s / 60
}

export function secondiAttivi(s: BiofeedbackSession): number {
  return s.secondi_livello[1] + s.secondi_livello[2] + s.secondi_livello[3]
}

export function quotaLivello3(s: BiofeedbackSession): number {
  const a = secondiAttivi(s)
  return a === 0 ? 0 : s.secondi_livello[3] / a
}

/** Istante "da muro" (ora locale di chi ha respirato), come Date in UTC. */
export function istanteLocale(iniziata_il: string, tz_offset_minutes: number): Date {
  return new Date(new Date(iniziata_il).getTime() + tz_offset_minutes * 60_000)
}

/** Chiave YYYY-MM-DD del giorno locale della sessione. */
export function chiaveGiorno(s: { iniziata_il: string; tz_offset_minutes: number }): string {
  return istanteLocale(s.iniziata_il, s.tz_offset_minutes).toISOString().slice(0, 10)
}

// ── Percorsi (percorsi-1.0.0, identico al Dart) ────────────────────────────

export const VERSIONE_PERCORSI = 'percorsi-1.0.0'

export type FasePercorso = {
  daSettimana: number
  aSettimana: number
  sessioniGiorno: number
  minutiSessione: number
  sfida: number
}

export type Percorso = { tipo: TipoPercorso; settimane: number; fasi: FasePercorso[] }

export const PERCORSI: Record<TipoPercorso, Percorso> = {
  fondamenti: {
    tipo: 'fondamenti',
    settimane: 8,
    fasi: [
      { daSettimana: 1, aSettimana: 2, sessioniGiorno: 1, minutiSessione: 5, sfida: 1 },
      { daSettimana: 3, aSettimana: 4, sessioniGiorno: 1, minutiSessione: 10, sfida: 2 },
      { daSettimana: 5, aSettimana: 6, sessioniGiorno: 2, minutiSessione: 10, sfida: 2 },
      { daSettimana: 7, aSettimana: 8, sessioniGiorno: 2, minutiSessione: 20, sfida: 3 },
    ],
  },
  ripresa_veloce: {
    tipo: 'ripresa_veloce',
    settimane: 4,
    fasi: [
      { daSettimana: 1, aSettimana: 2, sessioniGiorno: 1, minutiSessione: 10, sfida: 1 },
      { daSettimana: 3, aSettimana: 4, sessioniGiorno: 1, minutiSessione: 10, sfida: 2 },
    ],
  },
  pratica_libera: {
    tipo: 'pratica_libera',
    settimane: 0,
    fasi: [{ daSettimana: 1, aSettimana: 1 << 20, sessioniGiorno: 1, minutiSessione: 10, sfida: 1 }],
  },
}

export function faseAllaSettimana(p: Percorso, settimana: number): FasePercorso | null {
  return p.fasi.find((f) => settimana >= f.daSettimana && settimana <= f.aSettimana) ?? null
}

/** Giorni di calendario fra due chiavi YYYY-MM-DD (in UTC, immune all'ora legale). */
export function giorniFra(da: string, a: string): number {
  return Math.round((Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+da.slice(0, 4), +da.slice(5, 7) - 1, +da.slice(8, 10))) / 86_400_000)
}

export function piuGiorni(chiave: string, n: number): string {
  return new Date(Date.UTC(+chiave.slice(0, 4), +chiave.slice(5, 7) - 1, +chiave.slice(8, 10) + n)).toISOString().slice(0, 10)
}

export function settimanaDelPercorso(inizio: string, giorno: string): number {
  return Math.floor(giorniFra(inizio, giorno) / 7) + 1
}

export type AderenzaSettimana = { settimana: number; fatte: number; attese: number; quota: number; minutiSintonia: number }

/**
 * Aderenza settimana per settimana dall'inizio del percorso a [oggi]
 * (chiave YYYY-MM-DD): sessioni di almeno un minuto contro quelle attese
 * fino a oggi compreso, come nell'app.
 */
export function aderenzaPerSettimana(a: BiofeedbackAssignment, sessioni: BiofeedbackSession[], oggi: string): AderenzaSettimana[] {
  const p = PERCORSI[a.percorso]
  const corrente = settimanaDelPercorso(a.inizio, oggi)
  if (corrente < 1) return []
  const ultima = p.settimane > 0 ? Math.min(corrente, p.settimane) : corrente
  const out: AderenzaSettimana[] = []
  for (let w = 1; w <= ultima; w++) {
    const f = faseAllaSettimana(p, w)
    if (!f) continue
    const primo = piuGiorni(a.inizio, (w - 1) * 7)
    const ultimoGiorno = piuGiorni(primo, 6)
    const fine = oggi < ultimoGiorno ? oggi : ultimoGiorno
    const giorni = fine < primo ? 0 : giorniFra(primo, fine) + 1
    let fatte = 0
    let sint = 0
    for (const s of sessioni) {
      if (s.assegnazione_id !== a.id) continue
      const g = chiaveGiorno(s)
      if (g >= primo && g <= ultimoGiorno && s.durata_s >= 60) {
        fatte++
        sint += minutiSintonia(s)
      }
    }
    const attese = giorni * f.sessioniGiorno
    out.push({ settimana: w, fatte, attese, quota: attese === 0 ? 0 : Math.min(1, fatte / attese), minutiSintonia: sint })
  }
  return out
}

// ── Calendario a celle ──────────────────────────────────────────────────────

export type CellaCalendario = { giorno: string; sessioni: number; minuti: number; minutiSintonia: number }

/** Lunedì della settimana della chiave data. */
export function lunediDi(chiave: string): string {
  const d = new Date(Date.UTC(+chiave.slice(0, 4), +chiave.slice(5, 7) - 1, +chiave.slice(8, 10)))
  const wd = (d.getUTCDay() + 6) % 7 // 0 = lunedì
  return piuGiorni(chiave, -wd)
}

/** Le ultime [settimane] settimane di calendario fino a quella di [oggi], un giorno per cella. */
export function celleCalendario(sessioni: BiofeedbackSession[], oggi: string, settimane = 8): CellaCalendario[] {
  const da = piuGiorni(lunediDi(oggi), -7 * (settimane - 1))
  const perGiorno = new Map<string, CellaCalendario>()
  for (let i = 0; i < settimane * 7; i++) {
    const g = piuGiorni(da, i)
    perGiorno.set(g, { giorno: g, sessioni: 0, minuti: 0, minutiSintonia: 0 })
  }
  for (const s of sessioni) {
    const c = perGiorno.get(chiaveGiorno(s))
    if (!c) continue
    c.sessioni++
    c.minuti += minutiTotali(s)
    c.minutiSintonia += minutiSintonia(s)
  }
  return Array.from(perGiorno.values())
}

// ── Serie nel tempo ─────────────────────────────────────────────────────────

/** Media mobile centrata su [finestra] punti (dispari), ai bordi su quelli che ci sono. */
export function mediaMobile(valori: (number | null)[], finestra = 5): (number | null)[] {
  const mezza = Math.floor(finestra / 2)
  return valori.map((_, i) => {
    let somma = 0
    let n = 0
    for (let j = Math.max(0, i - mezza); j <= Math.min(valori.length - 1, i + mezza); j++) {
      const v = valori[j]
      if (v == null) continue
      somma += v
      n++
    }
    return n === 0 ? null : somma / n
  })
}

export type ConfrontoPeriodi = { recente: number | null; precedente: number | null; deltaPct: number | null; sessioniRecenti: number; sessioniPrecedenti: number }

/**
 * Media di [valore] nelle ultime [giorni] giornate contro i [giorni] prima,
 * con la differenza in percentuale (null se un periodo è vuoto o la base è 0).
 * Niente mediana: la media si legge e si confronta meglio su poche sessioni.
 */
export function confrontoPeriodi(
  sessioni: BiofeedbackSession[],
  valore: (s: BiofeedbackSession) => number | null,
  oggi: string,
  giorni = 14,
): ConfrontoPeriodi {
  const inizioRecente = piuGiorni(oggi, -(giorni - 1))
  const inizioPrecedente = piuGiorni(inizioRecente, -giorni)
  const rec: number[] = []
  const prec: number[] = []
  for (const s of sessioni) {
    const v = valore(s)
    if (v == null) continue
    const g = chiaveGiorno(s)
    if (g >= inizioRecente && g <= oggi) rec.push(v)
    else if (g >= inizioPrecedente && g < inizioRecente) prec.push(v)
  }
  const media = (v: number[]) => (v.length === 0 ? null : v.reduce((a, b) => a + b, 0) / v.length)
  const r = media(rec)
  const p = media(prec)
  return {
    recente: r,
    precedente: p,
    deltaPct: r == null || p == null || p === 0 ? null : ((r - p) / p) * 100,
    sessioniRecenti: rec.length,
    sessioniPrecedenti: prec.length,
  }
}

/** Dominio di un asse Y che segue i dati: da 0 (o dal minimo, se tutti alti) con un margine del 10%. */
export function asseAdattivo(valori: (number | null)[], { daZero = true } = {}): [number, number] {
  const v = valori.filter((x): x is number => x != null)
  if (v.length === 0) return [0, 1]
  const max = Math.max(...v)
  const min = Math.min(...v)
  const lo = daZero ? 0 : Math.max(0, min - (max - min) * 0.1)
  const hi = max === lo ? lo + 1 : max + (max - lo) * 0.1
  return [lo, Math.ceil(hi * 10) / 10]
}

// ── Avviso: la guida resta contro un limite ─────────────────────────────────

export type GuidaAlLimite = { verso: 'su' | 'giu'; sessioni: number } | null

/**
 * In almeno [minimo] delle ultime [ultime] sessioni complete la guida ha
 * chiuso a ridosso dello stesso limite (± 0,5 dall'assegnato, entro 0,05):
 * conviene rifare Trova il ritmo.
 */
export function guidaControIlLimite(sessioni: BiofeedbackSession[], { ultime = 5, minimo = 4 } = {}): GuidaAlLimite {
  const complete = [...sessioni].filter((s) => s.completata).sort((a, b) => a.iniziata_il.localeCompare(b.iniziata_il)).slice(-ultime)
  if (complete.length < minimo) return null
  let su = 0
  let giu = 0
  for (const s of complete) {
    const d = s.ritmo_finale - s.ritmo_assegnato
    if (d >= 0.45) su++
    else if (d <= -0.45) giu++
  }
  if (su >= minimo) return { verso: 'su', sessioni: su }
  if (giu >= minimo) return { verso: 'giu', sessioni: giu }
  return null
}

/** Serie per i grafici nel tempo, in ordine cronologico. */
export type PuntoSessione = {
  id: string
  giorno: string
  istante: number
  minutiSintonia: number
  aggancio_min: number | null
  ritmo_finale: number
  ritmo_assegnato: number
  completata: boolean
}

export function puntiSessioni(sessioni: BiofeedbackSession[]): PuntoSessione[] {
  return [...sessioni]
    .sort((a, b) => a.iniziata_il.localeCompare(b.iniziata_il))
    .map((s) => ({
      id: s.id,
      giorno: chiaveGiorno(s),
      istante: new Date(s.iniziata_il).getTime(),
      minutiSintonia: minutiSintonia(s),
      aggancio_min: s.aggancio_s == null ? null : s.aggancio_s / 60,
      ritmo_finale: s.ritmo_finale,
      ritmo_assegnato: s.ritmo_assegnato,
      completata: s.completata,
    }))
}

// ── Quello che la scheda cliente riceve dal server ──────────────────────────

export type BiofeedbackScheda = {
  sessioni: BiofeedbackSession[]
  assegnazioni: BiofeedbackAssignment[]
  valutazioni: ResonanceAssessment[]
  /** Vero se le tabelle non esistono ancora in produzione. */
  tabelleAssenti: boolean
}

export const BIOFEEDBACK_VUOTO: BiofeedbackScheda = { sessioni: [], assegnazioni: [], valutazioni: [], tabelleAssenti: false }
