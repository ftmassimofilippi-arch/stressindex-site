// =============================================================================
// Il percorso di un cliente: misurazione di riferimento, media mobile, partenza
// =============================================================================
//
// Modulo puro (niente React né Supabase), coperto da `reference-trend.test.ts`
// con una fixture che riproduce una scheda vera. Decisioni del 17/10/2026
// (`docs/PROMPT_GRAFICI_ANALISI_2026-10-17.md`), in breve:
//   • misurazione di RIFERIMENTO = tipo standard (né coerenza né ortostatica,
//     anche quando l'etichetta dice "standard" ma i dati di coerenza ci sono),
//     fatta fra le 04:00 e le 11:59 italiane. I tag non contano;
//   • nei conti entra UN valore al giorno: la media delle misurazioni di
//     riferimento del giorno;
//   • media mobile a 7 giorni di calendario, provvisoria sotto 3 valori,
//     interrotta dopo più di 7 giorni senza dati;
//   • partenza = media dei primi 7 giorni di riferimento (da
//     `data_inizio_percorso` se c'è), fascia = partenza ± 0,5 DS campionaria
//     dei primi 7 valori giornalieri (nessuna fascia sotto 3, provvisoria
//     sotto 7);
//   • variazione = (media mobile di oggi - riferimento) / riferimento; il
//     verdetto è "stabile" dentro la fascia, fuori decide il verso del
//     "meglio" (`piuAltoEMeglio` di trend-stats);
//   • RMSSD: tutti i conti sul logaritmo naturale, ritorno in ms per la
//     lettura (`toDisplay`).
// Il sito non ricalcola nessuno score: qui ci sono solo medie, deviazioni e
// percentuali sui valori salvati.

import { measuredDayKey, measuredHour, measuredInstant, type ConIstante } from './measured-time.ts'
import { normalizeTestType } from './measurement-type.ts'
import { periodoPrecedente, piuAltoEMeglio } from './trend-stats.ts'

export const REFERENCE_HOUR_FROM = 4
export const REFERENCE_HOUR_TO = 11
export const ROLLING_WINDOW_DAYS = 7
export const BASELINE_DAYS = 7
export const PROVISIONAL_BELOW = 3
export const DYNAMIC_WINDOW_DAYS = 60
/** Fascia = media ± HALF_SD_BAND × DS. */
export const HALF_SD_BAND = 0.5

/** Il minimo che serve per decidere se una riga è di riferimento. */
export type ReferenceRow = ConIstante & {
  session_id?: string | null
  test_type?: string | null
  coherence_data?: unknown
  orthostatic_data?: unknown
}

export type NonReferenceReason = 'type' | 'hour' | 'excluded'

/** Perché una misurazione resta fuori dai conti; `null` se è di riferimento. */
export function nonReferenceReason(m: ReferenceRow, excluded?: ReadonlySet<string> | null): NonReferenceReason | null {
  if (normalizeTestType(m.test_type) !== 'standard') return 'type'
  // La forma dei dati vince sull'etichetta: le coerenze delle build vecchie
  // dell'app sono salvate come "standard" con `coherence_data` pieno.
  if (m.coherence_data != null || m.orthostatic_data != null) return 'type'
  const h = measuredHour(m)
  if (h == null || h < REFERENCE_HOUR_FROM || h > REFERENCE_HOUR_TO) return 'hour'
  if (excluded && m.session_id && excluded.has(m.session_id)) return 'excluded'
  return null
}

export function isReferenceMeasurement(m: ReferenceRow, excluded?: ReadonlySet<string> | null): boolean {
  return nonReferenceReason(m, excluded) == null
}

/** La misurazione da mettere in testata e sulle lancette della scheda. */
export type MisurazioneDaMostrare<T> = {
  m: T
  /** Non è di riferimento (tipo o ora): si mostra, ma non entra nei confronti. */
  nonDiRiferimento: boolean
  reason: NonReferenceReason | null
}

/**
 * Testata e lancette: la misurazione di riferimento più recente; se non ce
 * n'è nessuna, la più recente in assoluto (così un cliente con una sola
 * misurazione del pomeriggio la vede comunque); `null` senza misurazioni.
 * Regola del 20/10/2026: la fascia del mattino decide che cosa entra nei
 * CONTI, non che cosa si VEDE. Nessun conto qui: solo una scelta.
 */
export function misurazioneDaMostrare<T extends ReferenceRow>(rows: T[], excluded?: ReadonlySet<string> | null): MisurazioneDaMostrare<T> | null {
  if (rows.length === 0) return null
  const ms = (m: T) => measuredInstant(m)?.getTime() ?? Number.NEGATIVE_INFINITY
  // Ordine per istante (la lista della scheda è già dalla più recente, ma non
  // si dà per scontato); a parità vince chi viene prima nella lista.
  const ordinate = rows.map((m, i) => ({ m, i })).sort((a, b) => ms(b.m) - ms(a.m) || a.i - b.i).map((x) => x.m)
  const riferimento = ordinate.find((m) => isReferenceMeasurement(m, excluded))
  if (riferimento) return { m: riferimento, nonDiRiferimento: false, reason: null }
  const ultima = ordinate[0]
  return { m: ultima, nonDiRiferimento: true, reason: nonReferenceReason(ultima, excluded) }
}

// ── Spazio dei conti: RMSSD in logaritmo ─────────────────────────────────────

const LOG_METRICS: ReadonlySet<string> = new Set(['rmssd'])

export function isLogMetric(metric: string): boolean {
  return LOG_METRICS.has(metric)
}

/** Dal valore salvato allo spazio dei conti (ln per le metriche in log). */
export function toCalc(metric: string, v: number): number {
  return isLogMetric(metric) ? (v > 0 ? Math.log(v) : NaN) : v
}

/** Dallo spazio dei conti al valore da leggere (exp per le metriche in log). */
export function toDisplay(metric: string, v: number): number {
  return isLogMetric(metric) ? Math.exp(v) : v
}

// ── Giorni (chiavi `yyyy-MM-dd`) ─────────────────────────────────────────────

function dayMs(day: string): number {
  return Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10))
}

/** Giorni da `a` a `b` (positivo se `b` è dopo). */
export function diffDays(a: string, b: string): number {
  return Math.round((dayMs(b) - dayMs(a)) / 86_400_000)
}

export function addDays(day: string, n: number): string {
  return new Date(dayMs(day) + n * 86_400_000).toISOString().slice(0, 10)
}

// ── Un valore al giorno ──────────────────────────────────────────────────────

export type DailyValue = {
  day: string
  /** Media del giorno, nello spazio dei conti (ln per RMSSD). */
  value: number
  /** Quante misurazioni di riferimento ha il giorno. */
  n: number
}

/**
 * Valori giornalieri di riferimento di una metrica, in ordine di giorno.
 * `metric` è la colonna della riga; `opts.value` la sostituisce quando il
 * valore va letto altrove. `opts.excluded` sono i `session_id` esclusi dai
 * conti dal professionista.
 */
export function dailyReferenceValues<T extends ReferenceRow>(
  rows: T[],
  metric: string,
  opts?: { excluded?: ReadonlySet<string> | null; value?: (m: T) => unknown },
): DailyValue[] {
  const byDay = new Map<string, number[]>()
  for (const m of rows) {
    if (!isReferenceMeasurement(m, opts?.excluded)) continue
    const raw = opts?.value ? opts.value(m) : (m as Record<string, unknown>)[metric]
    const v = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN
    if (!Number.isFinite(v)) continue
    const c = toCalc(metric, v)
    if (!Number.isFinite(c)) continue
    const day = measuredDayKey(m)
    if (!day) continue
    const arr = byDay.get(day) ?? []
    arr.push(c)
    byDay.set(day, arr)
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, vals]) => ({ day, value: mean(vals), n: vals.length }))
}

function mean(v: number[]): number {
  return v.reduce((a, b) => a + b, 0) / v.length
}

/** Deviazione standard campionaria (n-1); `null` sotto 2 valori. */
function sampleSd(v: number[]): number | null {
  if (v.length < 2) return null
  const m = mean(v)
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1))
}

// ── Media mobile a 7 giorni ──────────────────────────────────────────────────

export type RollingPoint = {
  day: string
  /** Media dei valori giornalieri nei 7 giorni di calendario fino a `day` compreso. */
  mean: number
  n: number
  /** Meno di 3 valori nella finestra: tratto tratteggiato. */
  provisional: boolean
  /** Più di 7 giorni dal giorno con dato precedente: la linea si interrompe. */
  gapBefore: boolean
}

export function rollingMean7(daily: DailyValue[]): RollingPoint[] {
  const out: RollingPoint[] = []
  for (let i = 0; i < daily.length; i++) {
    const window: number[] = []
    for (let j = i; j >= 0; j--) {
      const dist = diffDays(daily[j].day, daily[i].day)
      if (dist >= ROLLING_WINDOW_DAYS) break
      window.push(daily[j].value)
    }
    out.push({
      day: daily[i].day,
      mean: mean(window),
      n: window.length,
      provisional: window.length < PROVISIONAL_BELOW,
      gapBefore: i > 0 && diffDays(daily[i - 1].day, daily[i].day) > ROLLING_WINDOW_DAYS,
    })
  }
  return out
}

// ── Riferimenti: partenza del percorso e alternative ─────────────────────────

export type Band = {
  low: number
  high: number
  /** Calcolata su 3-6 valori: bordo tratteggiato. */
  provisional: boolean
}

/** Un riferimento con cui confrontare la media mobile (spazio dei conti). */
export type Reference = {
  mean: number
  sd: number | null
  /** `null` sotto 3 valori. */
  band: Band | null
  n: number
  /** Meno di 7 valori: "provvisoria, su N misurazioni". */
  provisional: boolean
  firstDay: string
  lastDay: string
}

/** Media, DS e fascia dei valori giornalieri dati. `null` se non ce ne sono. */
export function referenceFromDaily(values: DailyValue[]): Reference | null {
  if (values.length === 0) return null
  const v = values.map((d) => d.value)
  const m = mean(v)
  const sd = v.length >= PROVISIONAL_BELOW ? sampleSd(v) : null
  const provisional = v.length < BASELINE_DAYS
  return {
    mean: m,
    sd,
    band: sd == null ? null : { low: m - HALF_SD_BAND * sd, high: m + HALF_SD_BAND * sd, provisional },
    n: v.length,
    provisional,
    firstDay: values[0].day,
    lastDay: values[values.length - 1].day,
  }
}

/**
 * Partenza del percorso: i primi 7 giorni di riferimento del cliente, su
 * tutta la storia (o da `startDay`, la `data_inizio_percorso` della scheda).
 */
export function courseBaseline(daily: DailyValue[], startDay?: string | null): Reference | null {
  const from = startDay ? daily.filter((d) => d.day >= startDay) : daily
  return referenceFromDaily(from.slice(0, BASELINE_DAYS))
}

/** Prima settimana di riferimento del periodo selezionato. */
export function periodStartReference(daily: DailyValue[], from: string): Reference | null {
  return referenceFromDaily(daily.filter((d) => d.day >= from).slice(0, BASELINE_DAYS))
}

/** Tutti i giorni di riferimento del periodo precedente di pari durata. */
export function previousPeriodReference(daily: DailyValue[], from: string, to: string): Reference | null {
  const p = periodoPrecedente(from, to)
  return referenceFromDaily(daily.filter((d) => d.day >= p.from && d.day <= p.to))
}

/** Il cliente ha almeno `days` giorni di storia di riferimento? */
export function hasLongHistory(daily: DailyValue[], days = DYNAMIC_WINDOW_DAYS): boolean {
  return daily.length > 0 && diffDays(daily[0].day, daily[daily.length - 1].day) >= days
}

/** Riferimento sui 60 giorni che precedono `asOfDay` (escluso). */
export function last60Reference(daily: DailyValue[], asOfDay: string, days = DYNAMIC_WINDOW_DAYS): Reference | null {
  const from = addDays(asOfDay, -days)
  return referenceFromDaily(daily.filter((d) => d.day >= from && d.day < asOfDay))
}

/** Fascia dinamica: per ogni giorno con dato, il riferimento sui 60 giorni precedenti. */
export function rollingBand60(daily: DailyValue[], days = DYNAMIC_WINDOW_DAYS): Array<{ day: string; reference: Reference | null }> {
  return daily.map((d) => ({ day: d.day, reference: last60Reference(daily, d.day, days) }))
}

// ── Regolarità ───────────────────────────────────────────────────────────────

/** Giorni con misurazione di riferimento sui giorni del periodo (estremi inclusi). */
export function regularity(daily: DailyValue[], from: string, to: string): { days: number; total: number } {
  const total = Math.max(0, diffDays(from, to) + 1)
  const days = daily.filter((d) => d.day >= from && d.day <= to).length
  return { days, total }
}

// ── Sintesi del cambiamento ──────────────────────────────────────────────────

export type Verdict = 'improved' | 'declined' | 'stable' | 'unknown'

export type ChangeSummary = {
  metric: string
  higherIsBetter: boolean
  /** Riferimento, nello spazio di lettura (ms per RMSSD). */
  start: number | null
  startN: number
  startProvisional: boolean
  /** Media mobile dell'ultimo giorno con dato (entro `asOf`), spazio di lettura. */
  now: number | null
  nowDay: string | null
  nowN: number
  nowProvisional: boolean
  /** (adesso - riferimento) / riferimento × 100, sui valori di lettura. */
  pct: number | null
  /** Fascia del riferimento, spazio di lettura. */
  band: Band | null
  insideBand: boolean | null
  verdict: Verdict
  /** Partenza, fascia o media mobile provvisorie: il verdetto è "indicativo". */
  provisional: boolean
  regularity: { days: number; total: number } | null
}

/**
 * Partenza, adesso, variazione e verdetto di una metrica.
 * `daily` sono i valori giornalieri di riferimento (tutta la storia),
 * `reference` il confronto scelto (partenza del percorso di norma),
 * `opts.asOf` l'ultimo giorno da considerare (default: l'ultimo con dato),
 * `opts.period` il periodo mostrato, per la regolarità.
 */
export function changeSummary(
  metric: string,
  daily: DailyValue[],
  reference: Reference | null,
  opts?: { asOf?: string | null; period?: { from: string; to: string } | null },
): ChangeSummary {
  const higherIsBetter = piuAltoEMeglio(metric)
  const rolling = rollingMean7(daily)
  const asOf = opts?.asOf ?? null
  let now: RollingPoint | null = null
  for (const p of rolling) {
    if (asOf && p.day > asOf) break
    now = p
  }

  const startDisplay = reference ? toDisplay(metric, reference.mean) : null
  const nowDisplay = now ? toDisplay(metric, now.mean) : null
  const band = reference?.band
    ? { low: toDisplay(metric, reference.band.low), high: toDisplay(metric, reference.band.high), provisional: reference.band.provisional }
    : null

  let pct: number | null = null
  if (startDisplay != null && nowDisplay != null && startDisplay !== 0) {
    pct = ((nowDisplay - startDisplay) / Math.abs(startDisplay)) * 100
  }

  let verdict: Verdict = 'unknown'
  let insideBand: boolean | null = null
  if (reference && now) {
    if (reference.band) {
      insideBand = now.mean >= reference.band.low && now.mean <= reference.band.high
    }
    if (insideBand) verdict = 'stable'
    else {
      const delta = now.mean - reference.mean
      if (delta === 0) verdict = 'stable'
      else verdict = (higherIsBetter ? delta : -delta) > 0 ? 'improved' : 'declined'
    }
  }

  const periodo = opts?.period ?? (daily.length > 0 ? { from: daily[0].day, to: asOf ?? daily[daily.length - 1].day } : null)

  return {
    metric,
    higherIsBetter,
    start: startDisplay,
    startN: reference?.n ?? 0,
    startProvisional: reference?.provisional ?? true,
    now: nowDisplay,
    nowDay: now?.day ?? null,
    nowN: now?.n ?? 0,
    nowProvisional: now?.provisional ?? true,
    pct,
    band,
    insideBand,
    verdict,
    provisional: !!reference && !!now && (reference.provisional || reference.band == null || now.provisional),
    regularity: periodo ? regularity(daily, periodo.from, periodo.to) : null,
  }
}
