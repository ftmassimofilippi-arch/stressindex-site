import { createClient } from '@/lib/supabase-server'
import { reportDataError } from '@/lib/data-error'
import { parseChartView, type ChartPrefs, type MeasurementExclusion } from '@/lib/chart-view.ts'

export type { ChartPrefs } from '@/lib/chart-view.ts'
export { EMPTY_CHART_PREFS } from '@/lib/chart-view.ts'

// =============================================================================
// Vista salvata, annotazioni ed esclusioni di una scheda (sito-049), lato server
// =============================================================================
//
// Si legge con il client dell'utente: la RLS limita alla scheda del
// professionista (e al superadmin in sola lettura). Finché la sito-049 non è
// applicata le tabelle non esistono (42P01) e la colonna `chart_view` manca
// (42703): si torna vuoto con `ready: false` e la scheda funziona lo stesso,
// con la parte "Prepara la vista" spenta.

const MISSING = new Set(['42P01', '42703'])

export async function loadChartPrefs(clientId: string, knownMetrics: ReadonlySet<string>): Promise<ChartPrefs> {
  const supabase = await createClient()
  const [viewRes, annRes, exclRes] = await Promise.all([
    supabase.from('client_settings').select('chart_view').eq('client_id', clientId).maybeSingle<{ chart_view: unknown }>(),
    supabase.from('client_chart_annotations').select('id, giorno, testo').eq('client_id', clientId).is('rimossa_at', null).order('giorno'),
    supabase.from('measurement_exclusions').select('id, session_id, motivo, nota').eq('client_id', clientId).is('revocata_at', null),
  ])
  let ready = true
  for (const r of [viewRes, annRes, exclRes]) {
    if (r.error) {
      if (MISSING.has(r.error.code)) ready = false
      else reportDataError('loadChartPrefs', r.error)
    }
  }
  const rawView = viewRes.data?.chart_view
  return {
    view: rawView ? parseChartView(rawView, knownMetrics) : null,
    annotations: ((annRes.data ?? []) as Array<{ id: string; giorno: string; testo: string }>).map((a) => ({ id: a.id, day: a.giorno, text: a.testo })),
    exclusions: (exclRes.data ?? []) as MeasurementExclusion[],
    ready,
  }
}
