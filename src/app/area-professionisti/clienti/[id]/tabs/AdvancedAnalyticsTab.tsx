'use client'

import { useMemo, useState } from 'react'
import { DateRangePicker, defaultRange, type DateRange } from '@/components/dashboard/DateRangePicker'
import { TrendChart } from '@/components/dashboard/TrendChart'
import { formatDateTime } from '@/lib/format'
import type { Session } from '@/lib/types'

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
  { key: 'stress_score', label: 'Stress', color: '#EF4444', inverted: true },
  { key: 'recovery_score', label: 'Recupero', color: '#10B981' },
  { key: 'balance_score', label: 'Equilibrio', color: '#4FA39A' },
  { key: 'energy_score', label: 'Energia', color: '#F59E0B' },
] as const

export function AdvancedAnalyticsTab({ sessions }: { sessions: Session[] }) {
  const [rangeA, setRangeA] = useState<DateRange>(defaultRange(30))
  const [rangeB, setRangeB] = useState<DateRange>({ ...defaultRange(60), to: defaultRange(31).from })

  const inA = useMemo(() => filterRange(sessions, rangeA), [sessions, rangeA])
  const inB = useMemo(() => filterRange(sessions, rangeB), [sessions, rangeB])

  const trendData = useMemo(() => {
    const arr = inA.slice().reverse().map((s) => ({
      date: s.created_at.slice(0, 10),
      stress_score: s.stress_score,
      recovery_score: s.recovery_score,
      balance_score: s.balance_score,
      energy_score: s.energy_score,
    }))
    return arr
  }, [inA])

  // Top 5 / Bottom 5 for stress score
  const topByStress = useMemo(() => [...inA].filter((s) => s.stress_score != null).sort((a, b) => (a.stress_score ?? 0) - (b.stress_score ?? 0)).slice(0, 5), [inA])
  const bottomByStress = useMemo(() => [...inA].filter((s) => s.stress_score != null).sort((a, b) => (b.stress_score ?? 0) - (a.stress_score ?? 0)).slice(0, 5), [inA])

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
          const valsA = inA.map((s) => (s as any)[m.key]).filter((v): v is number => v != null)
          const valsB = inB.map((s) => (s as any)[m.key]).filter((v): v is number => v != null)
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
        <h3 className="font-serif text-base text-anthracite mb-4">Trend Periodo A</h3>
        {trendData.length === 0 ? (
          <p className="text-sm text-anthracite-lighter">Nessun dato nel periodo</p>
        ) : (
          <TrendChart data={trendData} height={260} />
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <h3 className="font-serif text-base text-anthracite">Top 5 — Stress più basso</h3>
          </div>
          <ul className="divide-y divide-surface-border">
            {topByStress.length === 0 ? <li className="p-5 text-sm text-anthracite-lighter">—</li> : topByStress.map((s) => (
              <li key={s.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-anthracite-lighter">{formatDateTime(s.created_at)}</span>
                <span className="font-medium text-emerald-600">{s.stress_score?.toFixed(0)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <h3 className="font-serif text-base text-anthracite">Top 5 — Stress più alto</h3>
          </div>
          <ul className="divide-y divide-surface-border">
            {bottomByStress.length === 0 ? <li className="p-5 text-sm text-anthracite-lighter">—</li> : bottomByStress.map((s) => (
              <li key={s.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-anthracite-lighter">{formatDateTime(s.created_at)}</span>
                <span className="font-medium text-red-500">{s.stress_score?.toFixed(0)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <HourlyHeatmap sessions={inA} />
    </div>
  )
}

function filterRange(sessions: Session[], r: DateRange): Session[] {
  const fromMs = new Date(r.from).getTime()
  const toMs = new Date(r.to).getTime() + 24 * 3600 * 1000
  return sessions.filter((s) => {
    const t = new Date(s.created_at).getTime()
    return t >= fromMs && t <= toMs
  })
}

function HourlyHeatmap({ sessions }: { sessions: Session[] }) {
  // 7 days x 24 hours grid with avg stress
  const grid: Array<Array<{ sum: number; n: number }>> = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ sum: 0, n: 0 })))
  for (const s of sessions) {
    if (s.stress_score == null) continue
    const d = new Date(s.created_at)
    // ISO weekday: Mon=0..Sun=6
    const dow = (d.getDay() + 6) % 7
    const h = d.getHours()
    grid[dow][h].sum += s.stress_score
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
