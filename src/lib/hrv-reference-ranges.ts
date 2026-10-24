// Facciata: i range dei parametri HRV e il semaforo vivono in
// `hrv-reference.ts` (unica fonte dei numeri, Appendice A del manuale,
// DECISIONI.md del 23/10/2026). Questo file resta per non toccare gli import
// di HrvParamsTable, ParamsSummaryCard e delle pagine di stampa.
export {
  PARAM_REFERENCE,
  PARAMS_WITHOUT_REFERENCE,
  EDGE_TOLERANCE,
  isIndicativeOnly,
  paramsSummary,
  rangeStatus,
  referenceRange,
  referenceRangeText,
  withPersonalRanges,
  type ParamReference,
  type ParamsSummary,
  type RangeStatus,
  type ReferenceRange,
  type ReferenceShape,
} from './hrv-reference'

import { PARAM_REFERENCE as REF, type ReferenceRange as RR } from './hrv-reference'

/** Solo i range generici (compatibilità con il vecchio nome). */
export const NORMATIVE_RANGES: Record<string, RR> = Object.fromEntries(
  Object.entries(REF).map(([k, r]) => [k, r.range]),
)
