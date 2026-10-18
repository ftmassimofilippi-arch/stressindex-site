// Baseline e banda SWC (smallest worthwhile change) di ln RMSSD.
//
// PORTING IDENTICO di hrv_app/lib/utils/ln_rmssd_swc.dart: se cambia uno,
// cambia l'altro. Definizione unica (hrv_app/docs/CONFRONTO_SCORE.md):
//  - Punti: solo misurazioni A RIPOSO (vedi `isRestingMeasurement`) con
//    RMSSD > 0 degli ultimi 60 giorni, in ordine di tempo.
//  - Baseline: mobile, media di ln RMSSD dei punti nei 7 giorni che finiscono
//    nel punto, punto compreso.
//  - Deviazione standard: CAMPIONARIA (n − 1) sugli ultimi 30 punti.
//  - Banda: baseline ± 0,5 × deviazione standard, solo da 5 punti in su.
// Modulo puro: niente import da Supabase o next, si testa con node --test.

export const LN_RMSSD_SWC = {
  lookbackDays: 60,
  baselineDays: 7,
  bandPoints: 30,
  minPointsBand: 5,
  swcFactor: 0.5,
} as const

const DAY = 86_400_000

export type RestingCandidate = {
  test_type?: string | null
  duration_type?: string | null
  duration_seconds?: number | null
  rmssd?: number | null
}

/**
 * Misurazione a riposo, la sola che entra nello SWC (come `restingMeasurements`
 * nell'app): test standard (fuori ortostatico e coerenza), non una sessione
 * lunga a durata libera, RMSSD positivo. Le sessioni di allenamento
 * (`sport_sessions`) non passano mai di qui.
 */
export function isRestingMeasurement(m: RestingCandidate): boolean {
  if ((m.test_type ?? 'standard') !== 'standard') return false
  if (m.duration_type === 'free' && (m.duration_seconds ?? 0) >= 600) return false
  return m.rmssd != null && m.rmssd > 0
}

export type LnRmssdPoint = { date: string; ln: number; baseline: number }
export type LnRmssdSwc = { points: LnRmssdPoint[]; sd: number | null; band: number | null }

/**
 * Calcola baseline mobile e banda. `measurements`: istante ISO e RMSSD in ms;
 * l'ordine non conta, i valori non positivi si scartano. `nowMs` fissa la
 * finestra degli ultimi 60 giorni.
 */
export function computeLnRmssdSwc(
  measurements: Array<{ date: string; rmssd: number }>,
  nowMs: number = Date.now(),
): LnRmssdSwc {
  const since = nowMs - LN_RMSSD_SWC.lookbackDays * DAY
  const raw = measurements
    .map((m) => ({ date: m.date, t: new Date(m.date).getTime(), rmssd: m.rmssd }))
    .filter((m) => m.rmssd > 0 && Number.isFinite(m.t) && m.t >= since && m.t <= nowMs)
    .map((m) => ({ date: m.date, t: m.t, ln: Math.log(m.rmssd) }))
    .sort((a, b) => a.t - b.t)
  if (raw.length === 0) return { points: [], sd: null, band: null }

  const windowMs = LN_RMSSD_SWC.baselineDays * DAY
  const points: LnRmssdPoint[] = raw.map((p, i) => {
    let sum = 0
    let n = 0
    for (let j = i; j >= 0; j--) {
      if (p.t - raw[j].t > windowMs) break
      sum += raw[j].ln
      n++
    }
    return { date: p.date, ln: p.ln, baseline: sum / n }
  })

  const tail = raw.slice(-LN_RMSSD_SWC.bandPoints)
  let sd: number | null = null
  if (tail.length >= LN_RMSSD_SWC.minPointsBand) {
    const mean = tail.reduce((a, p) => a + p.ln, 0) / tail.length
    const ss = tail.reduce((a, p) => a + (p.ln - mean) ** 2, 0)
    sd = Math.sqrt(ss / (tail.length - 1))
  }
  return { points, sd, band: sd == null ? null : LN_RMSSD_SWC.swcFactor * sd }
}
