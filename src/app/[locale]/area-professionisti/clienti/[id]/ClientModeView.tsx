'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AdvancedTrendChart, panelName } from '@/components/dashboard/AdvancedTrendChart'
import { DEFAULT_CHART_VIEW, type ChartPrefs, type ChartView } from '@/lib/chart-view.ts'
import { fullName } from '@/lib/format'
import type { Client, MeasurementAnalytics } from '@/lib/types'

// ============================================================================
// "Mostra al cliente": schermo intero, caratteri grandi, un indice alla volta
// con le frecce, niente menu né metriche tecniche, nessun dato di altri
// clienti (arrivano solo le misurazioni di QUESTA scheda). Esc per uscire.
// La vista è quella preparata dal professionista (periodo, confronto,
// indici e ordine); i puntini delle singole misurazioni restano spenti.
// ============================================================================

export function ClientModeView({ client, measurements, prefs, view, onClose }: {
  client: Client
  measurements: MeasurementAnalytics[]
  prefs: ChartPrefs
  view: ChartView | null
  onClose: () => void
}) {
  const t = useTranslations('clients.clientMode')
  const tCharts = useTranslations('charts')
  const tMetrics = useTranslations('charts.metrics')
  const v = view ?? prefs.view ?? DEFAULT_CHART_VIEW
  const metrics = v.metrics.length ? v.metrics : DEFAULT_CHART_VIEW.metrics
  const [i, setI] = useState(0)
  const metric = metrics[Math.min(i, metrics.length - 1)]
  const excluded = useMemo(() => prefs.exclusions.map((e) => e.session_id), [prefs.exclusions])
  const panelView = useMemo<ChartView>(() => ({ ...v, metrics: [metric], points: false }), [v, metric])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((x) => Math.min(x + 1, metrics.length - 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(x - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose, metrics.length])

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto" role="dialog" aria-modal="true" aria-label={t('title')}>
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-5 min-h-full flex flex-col">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <div className="font-serif text-2xl text-anthracite truncate">{t('title')}</div>
            <div className="text-sm text-anthracite-lighter truncate">{fullName(client)}</div>
          </div>
          <button type="button" onClick={onClose} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-border text-sm text-anthracite hover:bg-surface">
            <X size={16} /> {t('close')}
          </button>
        </div>

        <div className="mt-6 flex-1">
          <div className="text-xs uppercase tracking-wide text-anthracite-lighter mb-1">{t('counter', { i: i + 1, n: metrics.length })}</div>
          <h2 className="font-serif text-3xl text-anthracite mb-4">{panelName(metric, tCharts, tMetrics)}</h2>
          <AdvancedTrendChart
            key={metric}
            measurements={measurements}
            view={panelView}
            showPoints={false}
            clientMode
            height={340}
            courseStart={client.data_inizio_percorso ?? null}
            excluded={excluded}
            annotations={prefs.annotations}
          />
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={() => setI((x) => Math.max(x - 1, 0))} disabled={i === 0} className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl border border-surface-border text-base text-anthracite hover:bg-surface disabled:opacity-40">
            <ChevronLeft size={20} /> {t('prev')}
          </button>
          <button type="button" onClick={() => setI((x) => Math.min(x + 1, metrics.length - 1))} disabled={i >= metrics.length - 1} className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-teal-dark text-white text-base hover:bg-teal disabled:opacity-40">
            {t('next')} <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
