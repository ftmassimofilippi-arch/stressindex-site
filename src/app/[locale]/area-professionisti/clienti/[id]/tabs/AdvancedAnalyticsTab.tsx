'use client'

import { Fragment, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { DateRangePicker, defaultRange, type DateRange } from '@/components/dashboard/DateRangePicker'
import { AdvancedTrendChart, TREND_METRICS } from '@/components/dashboard/AdvancedTrendChart'
import { formatMeasuredAt, intervalloGiorniIta, intlTag, measuredDayKey, measuredHour, measuredInstant, measuredWeekday, num } from '@/lib/format'
import type { MeasurementAnalytics } from '@/lib/types'

function stats(values: number[]) {
  if (!values.length) return { mean: null, median: null, min: null, max: null, std: null }
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const median = sorted[Math.floor(sorted.length / 2)]
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  const std = Math.sqrt(variance)
  return { mean, median, min, max, std }
}

// Colonna DB → chiave del nome in scores.names.*.
const METRICS = [
  { key: 'score_stress', nameKey: 'stress', color: '#EF4444', inverted: true },
  { key: 'score_recupero', nameKey: 'recovery', color: '#10B981' },
  { key: 'score_equilibrio', nameKey: 'balance', color: '#4FA39A' },
  { key: 'score_energia', nameKey: 'energy', color: '#F59E0B' },
] as const

const STAT_KEYS = ['mean', 'median', 'min', 'max', 'std'] as const

export function AdvancedAnalyticsTab({ measurements }: { measurements: MeasurementAnalytics[] }) {
  const t = useTranslations('clients.analytics')
  const tScores = useTranslations('scores')
  const locale = useLocale()
  const [rangeA, setRangeA] = useState<DateRange>(defaultRange(30))
  const [rangeB, setRangeB] = useState<DateRange>({ ...defaultRange(60), to: defaultRange(31).from })

  const inA = useMemo(() => filterRange(measurements, rangeA), [measurements, rangeA])
  const inB = useMemo(() => filterRange(measurements, rangeB), [measurements, rangeB])

  // Punti trend su tutto lo storico: il chart filtra internamente con i propri controlli.
  // Mappa tutte le metriche supportate (24+ parametri HRV) dal record di measurement_analytics.
  const allTrendData = useMemo(() => measurements.slice().reverse().map((m) => {
    const point = { date: measuredDayKey(m) ?? '' } as { date: string } & Record<string, number | string | null>
    for (const def of TREND_METRICS) {
      point[def.key] = (m as unknown as Record<string, number | null>)[def.key] ?? null
    }
    return point
  }), [measurements])

  const topByStress = useMemo(() => [...inA].filter((m) => m.score_stress != null).sort((a, b) => (a.score_stress ?? 0) - (b.score_stress ?? 0)).slice(0, 5), [inA])
  const bottomByStress = useMemo(() => [...inA].filter((m) => m.score_stress != null).sort((a, b) => (b.score_stress ?? 0) - (a.score_stress ?? 0)).slice(0, 5), [inA])

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-serif text-base text-anthracite mb-3">{t('periodsTitle')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-anthracite-lighter mb-1.5">{t('periodA')}</div>
            <DateRangePicker value={rangeA} onChange={setRangeA} />
          </div>
          <div>
            <div className="text-xs font-medium text-anthracite-lighter mb-1.5">{t('periodB')}</div>
            <DateRangePicker value={rangeB} onChange={setRangeB} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {METRICS.map((m) => {
          const valsA = inA.map((s) => s[m.key as keyof MeasurementAnalytics] as number | null).filter((v): v is number => v != null)
          const valsB = inB.map((s) => s[m.key as keyof MeasurementAnalytics] as number | null).filter((v): v is number => v != null)
          const sA = stats(valsA)
          const sB = stats(valsB)
          const variation = sA.mean != null && sB.mean ? ((sA.mean - sB.mean) / sB.mean) * 100 : null
          return (
            <div key={m.key} className="card p-5">
              <div className="flex items-center justify-between mb-1 gap-2">
                <h4 className="font-serif text-base text-anthracite">{tScores(`names.${m.nameKey}`)}</h4>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full text-anthracite-lighter whitespace-nowrap">
                  {variation != null ? t('vsB', { value: `${variation > 0 ? '+' : ''}${num(variation, 1, locale)}%` }) : '—'}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2 mt-3 text-xs">
                {STAT_KEYS.map((k) => (
                  <div key={k} className="text-center">
                    <div className="text-[10px] uppercase tracking-wide text-anthracite-lighter">{t(k)}</div>
                    <div className="font-medium text-anthracite mt-0.5">{num(sA[k], 1, locale)}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <section className="card p-6">
        <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
          <h3 className="font-serif text-base text-anthracite">{t('trendTitle')}</h3>
          <span className="text-xs text-anthracite-lighter">{t('trendHint')}</span>
        </div>
        <p className="text-xs text-anthracite-lighter mb-4">{t('trendSubtitle')}</p>
        {allTrendData.length === 0 ? (
          <p className="text-sm text-anthracite-lighter">{t('noData')}</p>
        ) : (
          <AdvancedTrendChart
            data={allTrendData}
            defaultSelected={['score_stress', 'score_recupero']}
            defaultPreset="30"
            height={320}
            storageKey="sx-client-trend"
          />
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <h3 className="font-serif text-base text-anthracite">{t('topLow')}</h3>
          </div>
          <ul className="divide-y divide-surface-border">
            {topByStress.length === 0 ? <li className="p-5 text-sm text-anthracite-lighter">—</li> : topByStress.map((m) => (
              <li key={m.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-anthracite-lighter">{formatMeasuredAt(m, locale)}</span>
                <span className="font-medium text-emerald-600">{num(m.score_stress, 0, locale)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <h3 className="font-serif text-base text-anthracite">{t('topHigh')}</h3>
          </div>
          <ul className="divide-y divide-surface-border">
            {bottomByStress.length === 0 ? <li className="p-5 text-sm text-anthracite-lighter">—</li> : bottomByStress.map((m) => (
              <li key={m.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-anthracite-lighter">{formatMeasuredAt(m, locale)}</span>
                <span className="font-medium text-red-500">{num(m.score_stress, 0, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <HourlyHeatmap measurements={inA} />
    </div>
  )
}

function filterRange(measurements: MeasurementAnalytics[], r: DateRange): MeasurementAnalytics[] {
  // Estremi a mezzanotte ITALIANA, come negli altri filtri per periodo.
  const { fromIso, toIso } = intervalloGiorniIta(r.from, r.to)
  const fromMs = new Date(fromIso).getTime()
  const toMs = new Date(toIso).getTime()
  return measurements.filter((m) => {
    const t = measuredInstant(m)?.getTime() ?? 0
    return t >= fromMs && t <= toMs
  })
}

// Nomi brevi dei giorni nella lingua della pagina, da lunedì (0) a domenica (6).
function weekdayShortNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(intlTag(locale), { weekday: 'short', timeZone: 'UTC' })
  // Il 5 gennaio 2026 è un lunedì.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2026, 0, 5 + i))).replace(/\.$/, ''))
}

function HourlyHeatmap({ measurements }: { measurements: MeasurementAnalytics[] }) {
  const t = useTranslations('clients.analytics')
  const locale = useLocale()
  const grid: Array<Array<{ sum: number; n: number }>> = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ sum: 0, n: 0 })))
  for (const m of measurements) {
    if (m.score_stress == null) continue
    // Giorno e ora ITALIANI dell'istante reale. Con `new Date().getHours()`
    // si otteneva l'ora del browser applicata a un timestamp gia' spostato:
    // la heatmap risultava traslata di due ore.
    const dow = measuredWeekday(m)
    const h = measuredHour(m)
    if (dow == null || h == null) continue
    grid[dow][h].sum += m.score_stress
    grid[dow][h].n += 1
  }
  const days = weekdayShortNames(locale)

  function colorFor(avg: number | null) {
    if (avg == null) return '#F1F4F7'
    if (avg >= 80) return '#EF4444'
    if (avg >= 60) return '#F59E0B'
    if (avg >= 40) return '#FACC15'
    if (avg >= 20) return '#86EFAC'
    return '#10B981'
  }

  return (
    <section className="card p-5">
      <h3 className="font-serif text-base text-anthracite mb-1">{t('patternsTitle')}</h3>
      <p className="text-xs text-anthracite-lighter mb-4">{t('patternsSubtitle')}</p>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="grid" style={{ gridTemplateColumns: '34px repeat(24, minmax(18px, 1fr))' }}>
            <div></div>
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="text-[9px] text-anthracite-lighter text-center">{h}</div>
            ))}
            {days.map((day, dow) => (
              <Fragment key={dow}>
                <div className="text-[10px] text-anthracite-lighter pr-2 flex items-center">{day}</div>
                {Array.from({ length: 24 }).map((_, h) => {
                  const cell = grid[dow][h]
                  const avg = cell.n > 0 ? cell.sum / cell.n : null
                  return (
                    <div
                      key={`${dow}-${h}`}
                      className="aspect-square rounded-sm m-0.5"
                      title={avg != null ? t('cellTitle', { day, hour: h, avg: num(avg, 1, locale), n: cell.n }) : t('cellEmpty', { day, hour: h })}
                      style={{ backgroundColor: colorFor(avg) }}
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
