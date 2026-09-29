'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { GaugeScore } from '@/components/dashboard/GaugeScore'
import { AdvancedTrendChart, TREND_METRICS } from '@/components/dashboard/AdvancedTrendChart'
import { AlertBadge } from '@/components/dashboard/AlertBadge'
import { MeasurementTypeBadge } from '@/components/dashboard/MeasurementTypeBadge'
import { LastMonitoringCard } from '@/components/monitoring/LastMonitoringCard'
import type { MonitoringSession } from '@/lib/monitoring-types'
import type { Alert, Client, MeasurementAnalytics } from '@/lib/types'
import { alertTypeLabel } from '@/lib/alert-rules'
import { formatDateTime, formatMeasuredAt, num } from '@/lib/format'
import { measuredDayKey } from '@/lib/format'

export function OverviewTab({ client, measurements, monitoring = [], alerts, professionistaId }: { client: Client; measurements: MeasurementAnalytics[]; monitoring?: MonitoringSession[]; alerts: Alert[]; professionistaId?: string }) {
  const t = useTranslations('clients.overview')
  const tScores = useTranslations('scores')
  const tAlerts = useTranslations('alerts')
  const locale = useLocale()
  const latest = measurements[0]
  const qs = professionistaId ? `?professionista=${professionistaId}` : ''

  // Trend completo: tutte le 24+ metriche disponibili; il chart filtra internamente per periodo e selezione.
  const trendData = measurements.slice().reverse().map((m) => {
    const point = { date: measuredDayKey(m) ?? '' } as { date: string } & Record<string, number | string | null>
    for (const def of TREND_METRICS) {
      point[def.key] = (m as unknown as Record<string, number | null>)[def.key] ?? null
    }
    return point
  })

  return (
    <div className="space-y-6">
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <GaugeScore label={tScores('names.stress').toUpperCase()} value={latest?.score_stress} colorScheme="stress" />
          <GaugeScore label={tScores('names.recovery').toUpperCase()} value={latest?.score_recupero} colorScheme="recovery" />
          <GaugeScore label={tScores('names.balance').toUpperCase()} value={latest?.score_equilibrio} colorScheme="balance" />
          <GaugeScore label={tScores('names.energy').toUpperCase()} value={latest?.score_energia} colorScheme="energy" />
        </div>
        {latest && <p className="mt-3 text-xs text-anthracite-lighter">{t('lastUpdate', { date: formatMeasuredAt(latest, locale) })}</p>}
      </section>

      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-1">{t('trendTitle')}</h2>
        <p className="text-sm text-anthracite-lighter mb-4">{t('trendSubtitle')}</p>
        {trendData.length === 0 ? (
          <p className="text-sm text-anthracite-lighter">{t('noData')}</p>
        ) : (
          <AdvancedTrendChart
            data={trendData}
            defaultSelected={['score_stress', 'score_recupero']}
            defaultPreset="30"
            height={280}
            storageKey="sx-client-overview-trend"
          />
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h3 className="font-serif text-base text-anthracite">{t('activeAlerts')}</h3>
            <span className="text-sm text-anthracite-lighter">({alerts.length})</span>
          </div>
          {alerts.length === 0 ? (
            <div className="px-5 py-6 text-sm text-anthracite-lighter text-center">{t('noAlerts')}</div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {alerts.map((a) => (
                <li key={a.id} className="px-5 py-3 flex items-center gap-3">
                  <AlertBadge severity={a.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-anthracite">{alertTypeLabel(a.type, tAlerts)}</div>
                    <div className="text-xs text-anthracite-lighter mt-0.5">{a.message ?? ''}</div>
                  </div>
                  <span className="text-xs text-anthracite-lighter">{formatDateTime(a.created_at, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
            <h3 className="font-serif text-base text-anthracite">{t('lastThree')}</h3>
          </div>
          {measurements.length === 0 ? (
            <div className="px-5 py-6 text-sm text-anthracite-lighter text-center">{t('noMeasurements')}</div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {measurements.slice(0, 3).map((m) => (
                <li key={m.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-anthracite">{formatMeasuredAt(m, locale)}</span>
                      <MeasurementTypeBadge testType={m.test_type} size="sm" />
                    </div>
                    <div className="text-xs text-anthracite-lighter mt-0.5">
                      {tScores('names.stress')} {num(m.score_stress, 0, locale)} · {tScores('names.recovery')} {num(m.score_recupero, 0, locale)}
                    </div>
                  </div>
                  <Link href={`/area-professionisti/clienti/${client.id}/misurazione/${m.session_id}${qs}`} className="text-teal-dark text-sm hover:underline whitespace-nowrap">
                    {t('open')}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <LastMonitoringCard session={monitoring[0] ?? null} baseQuery={qs} />

      <section className="card p-6 border-dashed border-2 border-surface-border bg-surface/50">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-light text-teal-dark flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif text-base text-anthracite">{t('aiTitle')}</h3>
              <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-anthracite text-white">{t('comingSoon')}</span>
            </div>
            <p className="text-sm text-anthracite-lighter mt-1 max-w-prose">{t('aiBody')}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
