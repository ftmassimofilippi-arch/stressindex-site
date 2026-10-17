// =============================================================================
// Statistiche di base dei grafici di andamento (media, scostamento, verso)
// =============================================================================
//
// Modulo puro, senza React né Supabase. Dal 17/10/2026 i conti del percorso
// (misurazione di riferimento, media mobile, partenza, fascia, verdetto) stanno
// in `reference-trend.ts`; qui restano le funzioni che quel modulo e i
// componenti riusano. Regole:
//   • i giorni senza misurazione NON valgono zero: i `null` si scartano prima;
//   • il segno dello scostamento segue la stessa regola di "Prima e dopo"
//     (`before-after.ts`, `SCORE_DELTA_ROWS`): per l'Indice di Stress un calo
//     è un miglioramento, per gli altri score un aumento. Per le metriche HRV
//     grezze vale "più alto è meglio" tranne frequenza cardiaca, LF/HF e indice
//     di Baevsky, come in `ComparisonTable`.
//
// `SCORE_PIU_BASSO_E_MEGLIO` va tenuto uguale a `SCORE_DELTA_ROWS` di
// `before-after.ts` (porting dell'app, che non si importa da qui).

/** Gli score per cui un calo è un miglioramento (`SCORE_DELTA_ROWS`: solo lo stress). */
const SCORE_PIU_BASSO_E_MEGLIO = new Set<string>(['score_stress'])

/** Metriche HRV grezze per cui un calo è un miglioramento (come in `ComparisonTable`). */
const HRV_PIU_BASSO_E_MEGLIO = new Set<string>(['mean_hr', 'stress_index_baevsky', 'lf_hf_ratio'])

/** Solo i numeri finiti: niente null, undefined, NaN. */
export function valoriValidi(values: Array<number | null | undefined>): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
}

export function media(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** (valore - riferimento) / |riferimento| in percento. `null` se manca o il riferimento è 0. */
export function scostamentoPct(valore: number | null | undefined, riferimento: number | null | undefined): number | null {
  if (valore == null || riferimento == null) return null
  if (!Number.isFinite(valore) || !Number.isFinite(riferimento) || riferimento === 0) return null
  return ((valore - riferimento) / Math.abs(riferimento)) * 100
}

/**
 * Direzione del "meglio" per una metrica del grafico. Gli score seguono
 * `SCORE_DELTA_ROWS` di `before-after.ts`; per le altre colonne di
 * `measurement_analytics` vale la convenzione di `ComparisonTable`.
 */
export function piuAltoEMeglio(metricKey: string): boolean {
  if (SCORE_PIU_BASSO_E_MEGLIO.has(metricKey)) return false
  return !HRV_PIU_BASSO_E_MEGLIO.has(metricKey)
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
