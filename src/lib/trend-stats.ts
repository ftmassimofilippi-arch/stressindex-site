// =============================================================================
// Statistiche di base dei grafici di andamento (media, scostamento, verso)
// =============================================================================
//
// Modulo puro, senza React né Supabase. Dal 17/10/2026 i conti del percorso
// (misurazione di riferimento, media mobile, partenza, fascia, verdetto) stanno
// in `reference-trend.ts`; qui restano le funzioni che quel modulo e i
// componenti riusano. Regole:
//   • i giorni senza misurazione NON valgono zero: i `null` si scartano prima;
//   • il verso del "meglio" segue la stessa regola di "Prima e dopo"
//     (`before-after.ts`, `SCORE_DELTA_ROWS`): per l'Indice di Stress un calo
//     è un miglioramento, per gli altri score un aumento. Per i parametri HRV
//     il verso viene dalla forma di `PARAM_REFERENCE` (hrv-reference.ts,
//     Appendice A del manuale): "alto = bene", "basso = bene", a campana
//     (DFA α1 verso 1,0: migliora chi si avvicina al centro del range) o
//     nessuna direzione (LF/HF, decisione 12 del 23/10/2026).
//
// `SCORE_PIU_BASSO_E_MEGLIO` va tenuto uguale a `SCORE_DELTA_ROWS` di
// `before-after.ts` (porting dell'app, che non si importa da qui).

import { PARAM_REFERENCE, STABLE_DELTA } from './hrv-reference.ts'

/** Gli score per cui un calo è un miglioramento (`SCORE_DELTA_ROWS`: solo lo stress). */
const SCORE_PIU_BASSO_E_MEGLIO = new Set<string>(['score_stress'])

/**
 * Verso del "meglio" di una metrica:
 *   'higher' più alto è meglio, 'lower' più basso è meglio,
 *   'bell' meglio vicino al centro del range, 'none' nessuna direzione.
 */
export type DirezioneMeglio = 'higher' | 'lower' | 'bell' | 'none'

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

/** Colonna di Lomb (`_ls`) → colonna di Welch, per leggere la stessa forma. */
function chiaveRiferimento(metricKey: string): string {
  return metricKey.endsWith('_ls') ? metricKey.slice(0, -3) : metricKey
}

/**
 * Verso del "meglio" per una metrica del grafico. Gli score seguono
 * `SCORE_DELTA_ROWS` di `before-after.ts`; i parametri HRV la forma di
 * `PARAM_REFERENCE`. Colonne sconosciute: più alto è meglio.
 */
export function direzioneMeglio(metricKey: string): DirezioneMeglio {
  if (metricKey.startsWith('score_')) return SCORE_PIU_BASSO_E_MEGLIO.has(metricKey) ? 'lower' : 'higher'
  const ref = PARAM_REFERENCE[chiaveRiferimento(metricKey)]
  if (!ref) return 'higher'
  switch (ref.shape) {
    case 'lowerBetter': return 'lower'
    case 'bell': return 'bell'
    case 'none': return 'none'
    default: return 'higher'
  }
}

/** Centro del range di riferimento di un parametro a campana (DFA α1: 1,0). */
export function centroRiferimento(metricKey: string): number | null {
  const ref = PARAM_REFERENCE[chiaveRiferimento(metricKey)]
  if (!ref) return null
  return (ref.range[0] + ref.range[1]) / 2
}

/**
 * Compatibilità: vero quando il verso è 'higher'. Per 'bell' e 'none' resta
 * vero (nessuna freccia "più basso = meglio"): chi deve distinguere usa
 * `direzioneMeglio`.
 */
export function piuAltoEMeglio(metricKey: string): boolean {
  return direzioneMeglio(metricKey) !== 'lower'
}

export type VerdettoVariazione = 'improved' | 'declined' | 'stable' | 'unknown'

/**
 * Verdetto di una variazione da `a` a `b` (decisione 9: stabile sotto il
 * 10% sui parametri, `STABLE_DELTA.paramPct`; per gli score usare
 * `deltaVerdict` di before-after.ts con i 10 punti). Per 'bell' migliora chi
 * si avvicina al centro del range; per 'none' il verdetto resta 'unknown'
 * (si mostra solo la variazione, senza colore).
 */
export function verdettoVariazione(
  a: number | null | undefined,
  b: number | null | undefined,
  metricKey: string,
  stablePct: number = STABLE_DELTA.paramPct,
): VerdettoVariazione {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return 'unknown'
  const direzione = direzioneMeglio(metricKey)
  const pct = scostamentoPct(b, a)
  const stabile = pct == null ? a === b : Math.abs(pct) < stablePct
  if (stabile) return 'stable'
  if (direzione === 'none') return 'unknown'
  if (direzione === 'bell') {
    const centro = centroRiferimento(metricKey)
    if (centro == null) return 'unknown'
    const prima = Math.abs(a - centro)
    const dopo = Math.abs(b - centro)
    if (prima === dopo) return 'stable'
    return dopo < prima ? 'improved' : 'declined'
  }
  const delta = b - a
  return (direzione === 'higher' ? delta : -delta) > 0 ? 'improved' : 'declined'
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
