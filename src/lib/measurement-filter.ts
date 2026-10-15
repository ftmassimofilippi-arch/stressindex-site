// Filtro delle misurazioni della scheda cliente (etichetta + tipo), condiviso
// fra la tabella di "Misurazioni" e il grafico Andamento della panoramica.
// Vive nell'URL della scheda (?tab=…&tag=…&tipo=…): sopravvive al cambio di
// scheda, all'apertura di una misurazione con ritorno e alla ricarica.
// Nessun calcolo: sceglie solo quali righe mostrare.

import type { MeasurementAnalytics } from './types'
import { ALL_MEASUREMENT_TYPE_META, normalizeTestType, type MeasurementTypeKey } from './measurement-type'
import { rowHasTag, tagCounts } from './before-after'

export interface MeasurementFilter {
  /** Chiave neutra dell'etichetta (vedi normalizeTagKey). */
  tag: string | null
  tipo: MeasurementTypeKey | null
}

/** Legge il filtro dall'URL. Un valore che non è fra quelli ammessi vale come
 *  assente: un tipo fuori dall'elenco, un'etichetta che nessuna misurazione
 *  del cliente porta (le etichette personalizzate non hanno un elenco fisso). */
export function parseMeasurementFilter(
  params: { get(name: string): string | null },
  measurements: Pick<MeasurementAnalytics, 'tags'>[],
): MeasurementFilter {
  const rawTipo = params.get('tipo')
  const tipo = ALL_MEASUREMENT_TYPE_META.find((m) => m.key === rawTipo)?.key ?? null
  const rawTag = params.get('tag')
  const tag = rawTag && tagCounts(measurements).has(rawTag) ? rawTag : null
  return { tag, tipo }
}

export function isFilterActive(f: MeasurementFilter): boolean {
  return f.tag != null || f.tipo != null
}

/** Regola unica del filtro: etichetta e tipo in AND, come i chip dell'app. */
export function matchesMeasurementFilter(m: Pick<MeasurementAnalytics, 'tags' | 'test_type'>, f: MeasurementFilter): boolean {
  if (f.tipo && normalizeTestType(m.test_type) !== f.tipo) return false
  if (f.tag && !rowHasTag(m, f.tag)) return false
  return true
}
