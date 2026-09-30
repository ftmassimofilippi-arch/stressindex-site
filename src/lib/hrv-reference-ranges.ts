// Intervalli di riferimento indicativi dei parametri HRV e semaforo relativo.
//
// Modulo puro (nessun import di next/headers): lo usano la tabella parametri
// della dashboard, le pagine di stampa e resta allineato alla logica del PDF
// (`measurement-pdf.tsx`, `statusColor`). Gli intervalli sono INDICATIVI
// (adulto sano, registrazione di 5-10 minuti, supino/seduto), non sono
// soglie del prodotto e non producono valutazioni: solo un colpo d'occhio
// sul posizionamento del valore rispetto a un riferimento di uso comune.
// Fonti: Task Force ESC/NASPE 1996 e range HRV di uso comune.
import { toNum } from '@/lib/format'
import type { MeasurementAnalytics } from '@/lib/types'

export type ReferenceRange = [number, number]

export const NORMATIVE_RANGES: Record<string, ReferenceRange> = {
  rmssd: [20, 80],
  sdnn: [30, 100],
  mean_hr: [55, 85],
  pnn50: [3, 40],
  pnn20: [15, 70],
  cv: [3, 10],
  lf_hf_ratio: [0.5, 2.5],
  dfa_alpha1: [0.85, 1.25],
  dfa_alpha2: [0.6, 1.0],
  sd1: [15, 60],
  sd2: [40, 130],
  sd1_sd2_ratio: [0.2, 0.6],
  sample_entropy: [1.0, 2.5],
  approximate_entropy: [0.8, 2.2],
  triangular_index: [15, 50],
  tinn: [100, 350],
  stress_index_baevsky: [30, 150],
}

/**
 * 'in'   dentro l'intervallo
 * 'edge' fuori ma entro il 20% dell'ampiezza dell'intervallo (al limite)
 * 'out'  oltre
 * 'none' valore assente o parametro senza intervallo di riferimento
 */
export type RangeStatus = 'in' | 'edge' | 'out' | 'none'

export function rangeStatus(value: unknown, range?: ReferenceRange | null): RangeStatus {
  const v = toNum(value)
  if (v == null || !range) return 'none'
  const [lo, hi] = range
  if (v >= lo && v <= hi) return 'in'
  const tolerance = (hi - lo) * 0.2
  if (v >= lo - tolerance && v <= hi + tolerance) return 'edge'
  return 'out'
}

export type ParamsSummary = {
  /** parametri dentro l'intervallo */
  inRange: number
  /** parametri fuori dall'intervallo (oltre la tolleranza) */
  outOfRange: number
  /** parametri al limite (entro il 20% dell'ampiezza) */
  edge: number
  /** parametri valutati: con un valore e un intervallo di riferimento */
  total: number
}

/** Conteggio dei parametri della misurazione rispetto agli intervalli di riferimento. */
export function paramsSummary(measurement: Partial<MeasurementAnalytics> | Record<string, unknown>): ParamsSummary {
  const out: ParamsSummary = { inRange: 0, outOfRange: 0, edge: 0, total: 0 }
  const m = measurement as Record<string, unknown>
  for (const [key, range] of Object.entries(NORMATIVE_RANGES)) {
    const status = rangeStatus(m[key], range)
    if (status === 'none') continue
    out.total++
    if (status === 'in') out.inRange++
    else if (status === 'edge') out.edge++
    else out.outOfRange++
  }
  return out
}
