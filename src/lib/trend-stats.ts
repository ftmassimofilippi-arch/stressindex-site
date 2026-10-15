// =============================================================================
// Statistiche di un periodo nei grafici di andamento (media, mediana, scostamenti)
// =============================================================================
//
// Modulo puro, senza React né Supabase: lo usano `AdvancedTrendChart` (linee di
// media e mediana, riga riassuntiva) e i test. Regole:
//   • i giorni senza misurazione NON valgono zero: i `null` si scartano prima;
//   • con meno di 2 punti non si calcola nulla (`null`): la UI scrive
//     "Dati insufficienti", mai 0 o NaN;
//   • il segno dello scostamento segue la stessa regola di "Prima e dopo"
//     (`before-after.ts`, `SCORE_DELTA_ROWS`): per l'Indice di Stress un calo
//     è un miglioramento, per gli altri score un aumento. Per le metriche HRV
//     grezze vale "più alto è meglio" tranne frequenza cardiaca e indice di
//     Baevsky, come in `ComparisonTable`.

// Nessun import da `before-after.ts`: i test girano con `node --test`, che non
// risolve gli import senza estensione, e TypeScript non accetta `.ts`. La regola
// è ripetuta qui in due righe (`SCORE_PIU_BASSO_E_MEGLIO`, `verdetto`) e va
// tenuta uguale a `SCORE_DELTA_ROWS` / `deltaVerdict` di `before-after.ts`.

/** Stesso tipo di `DeltaVerdict` in `before-after.ts`. */
export type Verdetto = 'improved' | 'declined' | 'stable' | 'unknown'

/** Gli score per cui un calo è un miglioramento (`SCORE_DELTA_ROWS`: solo lo stress). */
const SCORE_PIU_BASSO_E_MEGLIO = new Set<string>(['score_stress'])

export type StatistichePeriodo = {
  n: number
  media: number
  mediana: number
  ultimo: number
}

/** Solo i numeri finiti: niente null, undefined, NaN. */
export function valoriValidi(values: Array<number | null | undefined>): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
}

export function media(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function mediana(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Statistiche di una serie ordinata nel tempo (l'ultimo elemento è il più
 * recente). `null` sotto i 2 punti validi.
 */
export function statistichePeriodo(values: Array<number | null | undefined>): StatistichePeriodo | null {
  const v = valoriValidi(values)
  if (v.length < 2) return null
  return { n: v.length, media: media(v)!, mediana: mediana(v)!, ultimo: v[v.length - 1] }
}

/** (valore - riferimento) / |riferimento| in percento. `null` se manca o il riferimento è 0. */
export function scostamentoPct(valore: number | null | undefined, riferimento: number | null | undefined): number | null {
  if (valore == null || riferimento == null) return null
  if (!Number.isFinite(valore) || !Number.isFinite(riferimento) || riferimento === 0) return null
  return ((valore - riferimento) / Math.abs(riferimento)) * 100
}

/** Metriche HRV grezze per cui un calo è un miglioramento (come in `ComparisonTable`). */
const HRV_PIU_BASSO_E_MEGLIO = new Set<string>(['mean_hr', 'stress_index_baevsky', 'lf_hf_ratio'])

/**
 * Direzione del "meglio" per una metrica del grafico. Gli score seguono
 * `SCORE_DELTA_ROWS` di `before-after.ts`; per le altre colonne di
 * `measurement_analytics` vale la convenzione di `ComparisonTable`.
 */
export function piuAltoEMeglio(metricKey: string): boolean {
  if (SCORE_PIU_BASSO_E_MEGLIO.has(metricKey)) return false
  return !HRV_PIU_BASSO_E_MEGLIO.has(metricKey)
}

/**
 * Verdetto su uno scostamento percentuale: `improved` / `declined` / `stable`
 * (sotto `stableBelow` punti percentuali) / `unknown`. Stessa logica e stessa
 * soglia di stabilità di `deltaVerdict` in "Prima e dopo".
 */
export function verdettoScostamento(pct: number | null, higherIsBetter: boolean, stableBelow = 3): Verdetto {
  if (pct == null || !Number.isFinite(pct)) return 'unknown'
  if (Math.abs(pct) < stableBelow) return 'stable'
  const miglioramento = higherIsBetter ? pct : -pct
  return miglioramento > 0 ? 'improved' : 'declined'
}

/** Periodo di pari lunghezza che precede [from, to] (giorni `yyyy-MM-dd`, estremi inclusi). */
export function periodoPrecedente(from: string, to: string): { from: string; to: string } {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10))
  const giorni = Math.max(1, Math.round((b - a) / 86_400_000) + 1)
  return { from: iso(new Date(a - giorni * 86_400_000)), to: iso(new Date(a - 86_400_000)) }
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export type RiepilogoMetrica = {
  stats: StatistichePeriodo | null
  /** Ultimo valore contro media del periodo, in percento. */
  ultimoVsMedia: number | null
  verdettoUltimo: Verdetto
  /** Media del periodo contro media del periodo precedente di pari lunghezza. */
  mediaVsPrecedente: number | null
  verdettoPeriodo: Verdetto
  precedenteN: number
}

/**
 * Riga riassuntiva di una metrica: statistiche del periodo e i due scostamenti.
 * `corrente` e `precedente` sono serie ordinate nel tempo (null = giorno vuoto).
 */
export function riepilogoMetrica(
  metricKey: string,
  corrente: Array<number | null | undefined>,
  precedente: Array<number | null | undefined>,
): RiepilogoMetrica {
  const higher = piuAltoEMeglio(metricKey)
  const stats = statistichePeriodo(corrente)
  const prev = statistichePeriodo(precedente)
  const ultimoVsMedia = stats ? scostamentoPct(stats.ultimo, stats.media) : null
  const mediaVsPrecedente = stats && prev ? scostamentoPct(stats.media, prev.media) : null
  return {
    stats,
    ultimoVsMedia,
    verdettoUltimo: verdettoScostamento(ultimoVsMedia, higher),
    mediaVsPrecedente,
    verdettoPeriodo: verdettoScostamento(mediaVsPrecedente, higher),
    precedenteN: prev?.n ?? valoriValidi(precedente).length,
  }
}
