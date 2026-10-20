// =============================================================================
// Righe, segmenti e scale dei pannelli di andamento (un pannello per indice)
// =============================================================================
//
// Modulo puro: prepara quello che `AdvancedTrendChart` disegna con Recharts e
// lo coprono i test. Qui non c'è nessuna statistica nuova: i conti stanno in
// `reference-trend.ts`, qui si decide solo COME finiscono sul grafico.
//   • `pointRows`: un puntino per misurazione, con il motivo per cui è fuori
//     dai conti (tipo, ora, esclusa) e il valore da leggere;
//   • `rollingSegments`: la media mobile spezzata in segmenti, perché Recharts
//     non sa disegnare una stessa linea un po' piena e un po' tratteggiata né
//     interromperla dopo un buco quando le righe del grafico sono miste
//     (misurazioni e giorni sullo stesso asse);
//   • `niceDomain`: asse Y dal minimo al massimo dei valori visibili, più un
//     margine del 10%, arrotondato a tacche leggibili; "scala completa" riporta
//     0-100 per gli score;
//   • `xTicks` / `xDomain`: asse del tempo in millisecondi, tacche sui giorni.

import { daOraItaliana, fineGiornoIta, inizioGiornoIta, measuredDayKey, measuredInstant } from './measured-time.ts'
import { normalizeTestType } from './measurement-type.ts'
import { nonReferenceReason, toDisplay, type NonReferenceReason, type ReferenceRow, type RollingPoint } from './reference-trend.ts'

export type TrendPointRow = {
  kind: 'point'
  /** Istante reale in ms: è la x. */
  x: number
  day: string
  id: string
  typeKey: ReturnType<typeof normalizeTestType>
  /** `null` = misurazione di riferimento, dentro i conti. */
  reason: NonReferenceReason | null
  /** Valore da leggere (ms per RMSSD, non il logaritmo). */
  value: number
}

export type TrendDayRow = {
  kind: 'day'
  /** Mezzogiorno italiano del giorno, in ms. */
  x: number
  day: string
  rolling: number
  n: number
  provisional: boolean
  gapBefore: boolean
  /** `r0`, `r1`, ...: il valore ripetuto per ogni segmento a cui il giorno appartiene. */
  [segment: `r${number}`]: number | undefined
}

export type TrendRow = TrendPointRow | TrendDayRow

/** Istante (ms) del mezzogiorno italiano di un giorno `yyyy-MM-dd`. */
export function dayNoonMs(day: string): number {
  return daOraItaliana(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), 12, 0, 0)).getTime()
}

/** Un puntino per misurazione con un valore della metrica, in ordine di istante. */
export function pointRows<T extends ReferenceRow & { id?: string }>(
  rows: T[],
  metric: string,
  excluded?: ReadonlySet<string> | null,
): TrendPointRow[] {
  const out: TrendPointRow[] = []
  for (const m of rows) {
    const raw = (m as Record<string, unknown>)[metric]
    const v = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN
    if (!Number.isFinite(v)) continue
    const inst = measuredInstant(m)
    const day = measuredDayKey(m)
    if (!inst || !day) continue
    out.push({
      kind: 'point',
      x: inst.getTime(),
      day,
      id: m.session_id ?? m.id ?? `${inst.getTime()}`,
      typeKey: normalizeTestType(m.test_type),
      reason: nonReferenceReason(m, excluded),
      value: v,
    })
  }
  out.sort((a, b) => a.x - b.x)
  return out
}

/**
 * I puntini si vedono quando il professionista li vuole, e COMUNQUE quando
 * non c'è nessun giorno di riferimento: senza media mobile i puntini sono
 * l'unica cosa che resta, e una misurazione che esiste non deve sparire
 * (nemmeno in "Mostra al cliente" o nel report versione cliente).
 */
export function pointsVisible(showPoints: boolean, referenceDays: number): boolean {
  return showPoints || referenceDays === 0
}

export type RollingSegment = { key: `r${number}`; dashed: boolean }

/**
 * Giorni della media mobile con le chiavi dei segmenti. Un segmento nuovo
 * parte dopo un buco (`gapBefore`) o quando cambia lo stile (provvisorio o
 * no); nel secondo caso il giorno precedente entra anche nel segmento nuovo,
 * così i due tratti si toccano. I valori tornano nello spazio di lettura.
 */
export function rollingSegments(points: RollingPoint[], metric: string): { rows: TrendDayRow[]; segments: RollingSegment[] } {
  const rows: TrendDayRow[] = points.map((p) => ({
    kind: 'day',
    x: dayNoonMs(p.day),
    day: p.day,
    rolling: toDisplay(metric, p.mean),
    n: p.n,
    provisional: p.provisional,
    gapBefore: p.gapBefore,
  }))
  const segments: RollingSegment[] = []
  let seg = -1
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const prev = i > 0 ? rows[i - 1] : null
    const nuovo = !prev || r.gapBefore || prev.provisional !== r.provisional
    if (nuovo) {
      seg++
      segments.push({ key: `r${seg}`, dashed: r.provisional })
      if (prev && !r.gapBefore) prev[`r${seg}`] = prev.rolling
    }
    r[`r${seg}`] = r.rolling
  }
  return { rows, segments }
}

// ── Asse Y ───────────────────────────────────────────────────────────────────

/** Passo "umano" (1, 2, 5 × 10^k) non inferiore a `raw`. */
export function niceStep(raw: number): number {
  if (!(raw > 0)) return 1
  const mag = 10 ** Math.floor(Math.log10(raw))
  for (const f of [1, 2, 5, 10]) if (f * mag >= raw) return f * mag
  return 10 * mag
}

export type DomainOptions = {
  /** Metrica 0-100: la scala completa è [0, 100] e la scala adattata non esce da lì. */
  score?: boolean
  /** "Scala completa": parte da 0 (e arriva a 100 per gli score). */
  full?: boolean
  margin?: number
}

/**
 * Estremi dell'asse Y per i valori visibili (punti, media mobile, fascia),
 * arrotondati al passo delle tacche. Con nessun valore torna `[0, 100]` per
 * gli score e `[0, 1]` per il resto.
 */
export function niceDomain(values: Array<number | null | undefined>, opts: DomainOptions = {}): [number, number] {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  if (opts.full && opts.score) return [0, 100]
  if (v.length === 0) return opts.score ? [0, 100] : [0, 1]
  let min = Math.min(...v)
  let max = Math.max(...v)
  if (opts.full) min = Math.min(0, min)
  const span = max - min
  const pad = span > 0 ? span * (opts.margin ?? 0.1) : Math.max(Math.abs(max) * 0.1, 1)
  let lo = min - pad
  let hi = max + pad
  const step = niceStep((hi - lo) / 5)
  lo = Math.floor(lo / step) * step
  hi = Math.ceil(hi / step) * step
  // Niente valori negativi per grandezze che non li hanno, niente oltre 100 per gli score.
  if (min >= 0 && lo < 0) lo = 0
  if (opts.score) {
    if (hi > 100) hi = 100
    if (lo < 0) lo = 0
  }
  if (hi <= lo) hi = lo + step
  return [lo, hi]
}

// ── Asse X ───────────────────────────────────────────────────────────────────

export type Periodo = { from: string; to: string } | null

/** Estremi dell'asse del tempo in ms: il periodo scelto, o i dati con "Tutto". */
export function xDomain(periodo: Periodo, rows: Array<{ x: number }>, today: string): [number, number] {
  if (periodo) return [new Date(inizioGiornoIta(periodo.from)).getTime(), new Date(fineGiornoIta(periodo.to)).getTime()]
  const first = rows.length ? Math.min(...rows.map((r) => r.x)) : new Date(inizioGiornoIta(today)).getTime()
  const firstDay = measuredDayKey({ started_at_utc: new Date(first).toISOString() }) ?? today
  return [new Date(inizioGiornoIta(firstDay)).getTime(), new Date(fineGiornoIta(today)).getTime()]
}

const TICK_STEPS_DAYS = [1, 2, 3, 7, 14, 30, 61, 91, 182, 365]

/** Tacche dell'asse del tempo, a mezzogiorno dei giorni, al massimo `count` circa. */
export function xTicks(domain: [number, number], count = 8): number[] {
  const [a, b] = domain
  const firstDay = measuredDayKey({ started_at_utc: new Date(a).toISOString() })
  if (!firstDay) return []
  const spanDays = Math.max(1, Math.round((b - a) / 86_400_000))
  const step = TICK_STEPS_DAYS.find((s) => spanDays / s <= count) ?? TICK_STEPS_DAYS[TICK_STEPS_DAYS.length - 1]
  const out: number[] = []
  for (let i = 0; i * step <= spanDays; i++) {
    const d = new Date(Date.UTC(+firstDay.slice(0, 4), +firstDay.slice(5, 7) - 1, +firstDay.slice(8, 10) + i * step))
    const ms = dayNoonMs(d.toISOString().slice(0, 10))
    if (ms >= a && ms <= b) out.push(ms)
  }
  return out
}
