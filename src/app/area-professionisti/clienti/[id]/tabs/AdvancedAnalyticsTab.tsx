'use client'

import { useMemo, useState } from 'react'
import { DateRangePicker, defaultRange, type DateRange } from '@/components/dashboard/DateRangePicker'
import { AdvancedTrendChart, TREND_METRICS } from '@/components/dashboard/AdvancedTrendChart'
import { formatDateTime } from '@/lib/format'
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

function fmt(v: number | null) { return v == null ? '—' : v.toFixed(1) }

const METRICS = [
  { key: 'score_stress', label: 'Stress', color: '#EF4444', inverted: true },
  { key: 'score_recupero', label: 'Recupero', color: '#10B981' },
  { key: 'score_equilibrio', label: 'Equilibrio', color: '#4FA39A' },
  { key: 'score_energia', label: 'Energia', color: '#F59E0B' },
] as const

export function AdvancedAnalyticsTab({ measurements }: { measurements: MeasurementAnalytics[] }) {
  const [rangeA, setRangeA] = useState<DateRange>(defaultRange(30))
  const [rangeB, setRangeB] = useState<DateRange>({ ...defaultRange(60), to: defaultRange(31).from })

  const inA = useMemo(() => filterRange(measurements, rangeA), [measurements, rangeA])
  const inB = useMemo(() => filterRange(measurements, rangeB), [measurements, rangeB])

  // Punti trend su tutto lo storico — il chart filtra internamente con i propri controlli.
  // Mappa tutte le metriche supportate (24+ parametri HRV) dal record di measurement_analytics.
  const allTrendData = useMemo(() => measurements.slice().reverse().map((m) => {
    const point = { date: m.measured_at.slice(0, 10) } as { date: string } & Record<string, number | string | null>
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
        <h3 className="font-serif text-base text-anthracite mb-3">Confronto periodi</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-anthracite-lighter mb-1.5">Periodo A</div>
            <DateRangePicker value={rangeA} onChange={setRangeA} />
          </div>
          <div>
            <div className="text-xs font-medium text-anthracite-lighter mb-1.5">Periodo B (confronto)</div>
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
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-serif text-base text-anthracite">{m.label}</h4>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full text-anthracite-lighter">
                  {variation != null ? `${variation > 0 ? '+' : ''}${variation.toFixed(1)}% vs B` : '—'}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2 mt-3 text-xs">
                {(['mean','median','min','max','std'] as const).map((k) => (
                  <div key={k} className="text-center">
                    <div className="text-[10px] uppercase tracking-wide text-anthracite-lighter">
                      {k === 'std' ? 'σ' : k === 'mean' ? 'Media' : k === 'median' ? 'Med.' : k}
                    </div>
                    <div className="font-medium text-anthracite mt-0.5">{fmt(sA[k])}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <section className="card p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-serif text-base text-anthracite">Trend storico</h3>
          <span className="text-xs text-anthracite-lighter">Seleziona metriche e periodo</span>
        </div>
        <p className="text-xs text-anthracite-lighter mb-4">Indipendente dai periodi A/B sopra — usa i preset rapidi o un range personalizzato</p>
        {allTrendData.length === 0 ? (
          <p className="text-sm text-anthracite-lighter">Nessun dato disponibile</p>
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
            <h3 className="font-serif text-base text-anthracite">Top 5 — Stress più basso</h3>
          </div>
          <ul className="divide-y divide-surface-border">
            {topByStress.length === 0 ? <li className="p-5 text-sm text-anthracite-lighter">—</li> : topByStress.map((m) => (
              <li key={m.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-anthracite-lighter">{formatDateTime(m.measured_at)}</span>
                <span className="font-medium text-emerald-600">{m.score_stress?.toFixed(0)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <h3 className="font-serif text-base text-anthracite">Top 5 — Stress più alto</h3>
          </div>
          <ul className="divide-y divide-surface-border">
            {bottomByStress.length === 0 ? <li className="p-5 text-sm text-anthracite-lighter">—</li> : bottomByStress.map((m) => (
              <li key={m.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-anthracite-lighter">{formatDateTime(m.measured_at)}</span>
                <span className="font-medium text-red-500">{m.score_stress?.toFixed(0)}</span>
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
  const fromMs = new Date(r.from).getTime()
  const toMs = new Date(r.to).getTime() + 24 * 3600 * 1000
  return measurements.filter((m) => {
    const t = new Date(m.measured_at).getTime()
    return t >= fromMs && t <= toMs
  })
}

function HourlyHeatmap({ measurements }: { measurements: MeasurementAnalytics[] }) {
  const grid: Array<Array<{ sum: number; n: number }>> = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ sum: 0, n: 0 })))
  for (const m of measurements) {
    if (m.score_stress == null) continue
    const d = new Date(m.measured_at)
    const dow = (d.getDay() + 6) % 7
    const h = d.getHours()
    grid[dow][h].sum += m.score_stress
    grid[dow][h].n += 1
  }
  const days = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']

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
      <h3 className="font-serif text-base text-anthracite mb-1">Pattern temporali</h3>
      <p className="text-xs text-anthracite-lighter mb-4">Stress medio per giorno della settimana / ora</p>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="grid" style={{ gridTemplateColumns: '30px repeat(24, minmax(18px, 1fr))' }}>
            <div></div>
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="text-[9px] text-anthracite-lighter text-center">{h}</div>
            ))}
            {days.map((day, dow) => (
              <>
                <div key={`l-${dow}`} className="text-[10px] text-anthracite-lighter pr-2 flex items-center">{day}</div>
                {Array.from({ length: 24 }).map((_, h) => {
                  const cell = grid[dow][h]
                  const avg = cell.n > 0 ? cell.sum / cell.n : null
                  return (
                    <div
                      key={`${dow}-${h}`}
                      className="aspect-square rounded-sm m-0.5"
                      title={avg != null ? `${day} ${h}:00 — Stress medio ${avg.toFixed(1)} (n=${cell.n})` : `${day} ${h}:00 — nessuna misurazione`}
                      style={{ backgroundColor: colorFor(avg) }}
                    />
                  )
                })}
              </>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
