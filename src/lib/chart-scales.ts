// =============================================================================
// Scale fisse dei grafici HRV — STESSI VALORI DELL'APP (lib/utils/chart_scales.dart)
// =============================================================================
//
// Il motivo è di lettura, non estetico: con gli assi che si adattano ai dati,
// due clienti diversi (o lo stesso cliente in due momenti) producono grafici
// visivamente identici pur avendo valori molto diversi. Con la scala fissa la
// forma della nuvola e l'ampiezza dell'oscillazione si leggono a colpo d'occhio
// e sono confrontabili fra misurazioni, e fra app e sito.
//
// Quando i dati escono dal range base la scala si allarga una volta sola, a un
// secondo range pure fisso, e il grafico lo dichiara con la nota "scala estesa".
// Il pulsante "Zoom" passa alla scala adattiva (per guardare da vicino la
// singola misurazione) e lo dichiara: senza indicazione un grafico zoomato si
// scambia per un grafico drammatico. Default: scala fissa.
//
// Questo è l'unico file con le costanti: i componenti le importano da qui.

// ── Millisecondi: ritmogramma e diagramma di Poincaré ────────────────────────

export interface RrScale {
  min: number
  max: number
  extended: boolean
}

/** Range base: banda fisiologica normale (43–150 bpm). */
export const RR_SCALE_BASE: RrScale = { min: 400, max: 1400, extended: false }

/** Range esteso: bradicardia dell'atleta e tachicardia da stress. */
export const RR_SCALE_WIDE: RrScale = { min: 300, max: 1600, extended: true }

/** Il range più stretto che contiene tutti i valori. */
export function rrScaleFor(values: number[]): RrScale {
  for (const v of values) {
    if (v < RR_SCALE_BASE.min || v > RR_SCALE_BASE.max) return RR_SCALE_WIDE
  }
  return RR_SCALE_BASE
}

/**
 * Range adattivo ai dati (modalità Zoom), con un minimo di ampiezza di 200 ms
 * per non trasformare il rumore di misura in oscillazioni drammatiche.
 */
export function rrScaleAdaptive(values: number[]): RrScale {
  if (values.length === 0) return RR_SCALE_BASE
  let lo = values[0]
  let hi = values[0]
  for (const v of values) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  let min = lo - 50
  let max = hi + 50
  if (max - min < 200) {
    const c = (min + max) / 2
    min = c - 100
    max = c + 100
  }
  return { min: Math.floor(min), max: Math.ceil(max), extended: false }
}

// ── Spettro PSD ──────────────────────────────────────────────────────────────

/** Asse X in Hz: da 0 a 0,5 (banda HF fino a 0,4, margine oltre). */
export const PSD_X_MIN = 0
export const PSD_X_MAX = 0.5
export const PSD_X_TICKS = [0, 0.04, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5]

/** Bande spettrali (Hz), le stesse dell'app. */
export const PSD_BANDS = {
  vlf: { from: 0.0, to: 0.04 },
  lf: { from: 0.04, to: 0.15 },
  hf: { from: 0.15, to: 0.4 },
} as const

export interface PsdScale {
  min: number
  max: number
  extended: boolean
}

/**
 * Asse Y logaritmico in ms²/Hz: 10 – 1.000.000 (sei decadi: 10, 100, 1k, 10k,
 * 100k, 1M), esteso a 1 – 10.000.000 quando i dati escono.
 */
export const PSD_SCALE_BASE: PsdScale = { min: 10, max: 1_000_000, extended: false }
export const PSD_SCALE_WIDE: PsdScale = { min: 1, max: 10_000_000, extended: true }

export function psdScaleFor(values: Array<number | null | undefined>): PsdScale {
  for (const v of values) {
    if (v == null || v <= 0) continue
    if (v > PSD_SCALE_BASE.max) return PSD_SCALE_WIDE
  }
  return PSD_SCALE_BASE
}

/** Decadi da etichettare sull'asse (10, 100, 1k, …): solo potenze di 10. */
export function psdDecades(scale: PsdScale): number[] {
  const out: number[] = []
  for (let v = scale.min; v <= scale.max * 1.0001; v *= 10) out.push(v)
  return out
}

/** Etichetta compatta di un valore dell'asse: 10, 100, 1k, 10k, 100k, 1M. */
export function psdLabel(v: number): string {
  if (v >= 1_000_000) return `${Math.round(v / 1_000_000)}M`
  if (v >= 1000) return `${Math.round(v / 1000)}k`
  return `${Math.round(v)}`
}

/** Appoggia ai bordi della scala un valore da disegnare su asse logaritmico. */
export function psdClamp(v: number, scale: PsdScale): number {
  if (!Number.isFinite(v) || v < scale.min) return scale.min
  if (v > scale.max) return scale.max
  return v
}

// La nota "scala estesa" mostrata quando la scala fissa è stata allargata è
// tradotta: chiave `charts.scale.extendedNote`, usata da ScaleToggle.
