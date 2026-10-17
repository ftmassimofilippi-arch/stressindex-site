'use client'

import { useCallback, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { AlertTriangle, X } from 'lucide-react'
import { GaugeScore } from '@/components/dashboard/GaugeScore'
import { AdvancedTrendChart } from '@/components/dashboard/AdvancedTrendChart'
import { AlertBadge } from '@/components/dashboard/AlertBadge'
import { MeasurementTypeBadge } from '@/components/dashboard/MeasurementTypeBadge'
import { LastMonitoringCard } from '@/components/monitoring/LastMonitoringCard'
import type { MonitoringSession } from '@/lib/monitoring-types'
import type { Alert, Client, MeasurementAnalytics } from '@/lib/types'
import type { AlertGruppo } from '@/lib/alert-group'
import { alertMessage, alertTypeLabel, alertValueDecimals } from '@/lib/alert-rules'
import { formatDate, formatDateTime, formatMeasuredAt, num } from '@/lib/format'
import { tagLabel } from '@/lib/before-after'
import { measurementTypeLabel, normalizeTestType } from '@/lib/measurement-type'
import { isReferenceMeasurement } from '@/lib/reference-trend.ts'
import { DEFAULT_CHART_VIEW, EMPTY_CHART_PREFS, sameChartView, type ChartPrefs, type ChartView } from '@/lib/chart-view.ts'
import { PrepareViewPanel } from '../PrepareViewPanel'
import { ClientModeView } from '../ClientModeView'
import { isFilterActive, matchesMeasurementFilter, type MeasurementFilter } from '@/lib/measurement-filter'

export function OverviewTab({ client, measurements, monitoring = [], alerts, appEvents = [], professionistaId, filter, onFilterChange, detailQs, prefs = EMPTY_CHART_PREFS, readOnly = false }: {
  client: Client
  /** Vista salvata, annotazioni ed esclusioni (sito-049). */
  prefs?: ChartPrefs
  /** Vista "come un altro professionista": niente strumenti di preparazione. */
  readOnly?: boolean
  measurements: MeasurementAnalytics[]
  monitoring?: MonitoringSession[]
  /** Alert attivi (tabella `alerts`, new/seen) raggruppati: il titolo conta questi. */
  alerts: AlertGruppo[]
  /** Eventi dell'app non letti, raggruppati: lista separata, non contati sopra. */
  appEvents?: AlertGruppo[]
  professionistaId?: string
  /** Filtro scelto in "Misurazioni": vale solo per il grafico Andamento. */
  filter: MeasurementFilter
  onFilterChange: (next: Partial<MeasurementFilter>) => void
  /** Query per i link al dettaglio (professionista, scheda, filtro). */
  detailQs: string
}) {
  const t = useTranslations('clients.overview')
  const tScores = useTranslations('scores')
  const tAlerts = useTranslations('alerts')
  const tTags = useTranslations('common.tags')
  const tTypes = useTranslations('measurement.types')
  const locale = useLocale()
  // Lancette e testata seguono l'ultima misurazione DI RIFERIMENTO (standard,
  // del mattino): una coerenza delle 10:39 non deve sembrare "lo stress di
  // oggi". L'ultima in assoluto, se è di altro tipo, si dice in una riga.
  const latestAny = measurements[0]
  const latest = measurements.find((m) => isReferenceMeasurement(m)) ?? null
  const latestOtherType = latestAny && latest && latestAny.session_id !== latest.session_id
    ? (latestAny.coherence_data ? 'coherence' : latestAny.orthostatic_data ? 'orthostatic' : normalizeTestType(latestAny.test_type))
    : null
  const qs = professionistaId ? `?professionista=${professionistaId}` : ''
  // Riga sotto il titolo di ogni alert: tradotta dai numeri, mai il testo
  // grezzo dell'app (che arriva nella lingua del telefono del cliente).
  const alertDetail = (a: Alert) => alertMessage(a, tAlerts, (v) => num(v, alertValueDecimals(v), locale), {
    tScores,
    fmtDate: (d) => formatDate(d, undefined, locale),
  })

  // Trend completo: tutte le 24+ metriche disponibili; il chart filtra internamente per periodo e selezione.
  // Il filtro di "Misurazioni" sceglie quali misurazioni disegnare; lancette e
  // ultime misurazioni restano sull'ultima in assoluto.
  const filterOn = isFilterActive(filter)
  const filterLabel = [
    filter.tag ? tagLabel(filter.tag, tTags) : null,
    filter.tipo ? measurementTypeLabel(filter.tipo, tTypes) : null,
  ].filter(Boolean).join(' · ')
  // Memoizzato: un array nuovo a ogni render rifarebbe tutti i conti dei pannelli.
  const trendRows = useMemo(() => measurements.filter((m) => matchesMeasurementFilter(m, filter)), [measurements, filter])

  // Vista in bozza: parte da quella salvata per il cliente, segue i comandi del
  // grafico e il pannello "Prepara la vista"; si salva solo su richiesta.
  const [draft, setDraft] = useState<ChartView>(() => prefs.view ?? DEFAULT_CHART_VIEW)
  const onViewChange = useCallback((v: ChartView) => setDraft((prev) => (sameChartView(prev, v) ? prev : v)), [])
  const [clientMode, setClientMode] = useState(false)
  const excluded = useMemo(() => prefs.exclusions.map((e) => e.session_id), [prefs.exclusions])

  return (
    <div className="space-y-6">
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            ['stress', tScores('names.stress'), latest?.score_stress],
            ['recovery', tScores('names.recovery'), latest?.score_recupero],
            ['balance', tScores('names.balance'), latest?.score_equilibrio],
            ['energy', tScores('names.energy'), latest?.score_energia],
          ] as const).map(([scheme, label, value]) =>
            latest ? (
              // Card score cliccabile con un click: apre l'ultima misurazione.
              <Link
                key={scheme}
                href={`/area-professionisti/clienti/${client.id}/misurazione/${latest.session_id}${detailQs}`}
                aria-label={`${label}: ${t('open')}`}
                className="block rounded-2xl transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-teal/40"
              >
                <GaugeScore label={label.toUpperCase()} value={value} colorScheme={scheme} />
              </Link>
            ) : (
              <GaugeScore key={scheme} label={label.toUpperCase()} value={value} colorScheme={scheme} />
            ),
          )}
        </div>
        {latest ? (
          <p className="mt-3 text-xs text-anthracite-lighter">{t('lastReference', { date: formatMeasuredAt(latest, locale) })}</p>
        ) : latestAny ? (
          <p className="mt-3 text-xs text-amber-700">{t('noReferenceYet')}</p>
        ) : null}
        {latestOtherType && latestAny && (
          <p className="mt-1 text-xs text-anthracite-lighter">
            <Link href={`/area-professionisti/clienti/${client.id}/misurazione/${latestAny.session_id}${detailQs}`} className="hover:text-teal-dark hover:underline">
              {t('lastOther', { type: tTypes(`${latestOtherType}.short`).toLowerCase(), date: formatMeasuredAt(latestAny, locale) })}
            </Link>
          </p>
        )}
      </section>

      {!readOnly && (
        <PrepareViewPanel client={client} measurements={measurements} prefs={prefs} draft={draft} onDraftChange={setDraft} onShowClient={() => setClientMode(true)} />
      )}
      {clientMode && (
        <ClientModeView client={client} measurements={measurements} prefs={prefs} view={draft} onClose={() => setClientMode(false)} />
      )}

      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-1">{t('trendTitle')}</h2>
        <p className="text-sm text-anthracite-lighter mb-4">{t('trendSubtitle')}</p>
        {filterOn && (
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-light text-teal-dark text-xs font-medium pl-3 pr-1 py-1">
              {t('filterActive', { label: filterLabel })}
              <button
                type="button"
                onClick={() => onFilterChange({ tag: null, tipo: null })}
                aria-label={t('filterRemove')}
                title={t('filterRemove')}
                className="rounded-full p-0.5 hover:bg-teal/20 focus:outline-none focus:ring-2 focus:ring-teal/40"
              >
                <X size={12} />
              </button>
            </span>
          </div>
        )}
        {trendRows.length === 0 ? (
          <p className="text-sm text-anthracite-lighter">{filterOn ? t('emptyFiltered') : t('noData')}</p>
        ) : (
          <AdvancedTrendChart
            measurements={trendRows}
            defaultSelected={['score_stress', 'score_recupero', 'rmssd']}
            defaultPreset="30"
            height={220}
            storageKey="sx-client-overview-trend"
            courseStart={client.data_inizio_percorso ?? null}
            excluded={excluded}
            annotations={prefs.annotations}
            view={draft}
            onViewChange={onViewChange}
          />
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <section className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-border flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <h3 className="font-serif text-base text-anthracite">{t('activeAlerts')}</h3>
              <span className="text-sm text-anthracite-lighter">({alerts.length})</span>
            </div>
            {alerts.length === 0 ? (
              <div className="px-5 py-6 text-sm text-anthracite-lighter text-center">{t('noAlerts')}</div>
            ) : (
              <AlertGroupList groups={alerts} detail={alertDetail} />
            )}
          </section>

          {appEvents.length > 0 && (
            <section className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-surface-border flex items-center gap-2 flex-wrap">
                <AlertTriangle size={16} className="text-blue-500" />
                <h3 className="font-serif text-base text-anthracite">{t('appEvents')}</h3>
                <span className="text-sm text-anthracite-lighter">({appEvents.length})</span>
                <span className="text-xs text-anthracite-lighter basis-full">{t('appEventsHint')}</span>
              </div>
              <AlertGroupList groups={appEvents} detail={alertDetail} />
            </section>
          )}
        </div>

        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
            <h3 className="font-serif text-base text-anthracite">{t('lastThree')}</h3>
          </div>
          {measurements.length === 0 ? (
            <div className="px-5 py-6 text-sm text-anthracite-lighter text-center">{t('noMeasurements')}</div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {measurements.slice(0, 3).map((m) => (
                <li key={m.id}>
                  <Link href={`/area-professionisti/clienti/${client.id}/misurazione/${m.session_id}${detailQs}`} className="px-5 py-3 flex items-center gap-3 hover:bg-surface transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-anthracite">{formatMeasuredAt(m, locale)}</span>
                        <MeasurementTypeBadge testType={m.test_type} size="sm" />
                      </div>
                      <div className="text-xs text-anthracite-lighter mt-0.5">
                        {tScores('names.stress')} {num(m.score_stress, 0, locale)} · {tScores('names.recovery')} {num(m.score_recupero, 0, locale)}
                      </div>
                    </div>
                    <span className="text-teal-dark text-sm whitespace-nowrap">{t('open')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <LastMonitoringCard session={monitoring[0] ?? null} baseQuery={qs} />
    </div>
  )
}

/** Lista di alert raggruppati: una riga per gruppo, "×N" se ha doppioni, data dell'ultimo. */
function AlertGroupList({ groups, detail }: { groups: AlertGruppo[]; detail: (a: Alert) => string | null }) {
  const tAlerts = useTranslations('alerts')
  const locale = useLocale()
  return (
    <ul className="divide-y divide-surface-border">
      {groups.map(({ alert: a, count }) => {
        const d = detail(a)
        const quando = formatDateTime(a.created_at, locale)
        return (
          <li key={a.id} className="px-5 py-3 flex items-center gap-3">
            <AlertBadge severity={a.severity} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-anthracite">{alertTypeLabel(a.type, tAlerts)}</span>
                {count > 1 && (
                  <span
                    className="inline-flex items-center px-1.5 h-5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 whitespace-nowrap"
                    title={tAlerts('group.title', { count, date: quando })}
                  >
                    {tAlerts('group.badge', { count })}
                  </span>
                )}
              </div>
              {d && <div className="text-xs text-anthracite-lighter mt-0.5">{d}</div>}
            </div>
            <span className="text-xs text-anthracite-lighter whitespace-nowrap">{quando}</span>
          </li>
        )
      })}
    </ul>
  )
}
