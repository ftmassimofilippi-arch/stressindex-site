'use client'

import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { parseISO } from 'date-fns'
import { useLocale, useTranslations } from 'next-intl'
import { intlTag } from '@/lib/format'

export type TrendSeries = {
  key: string
  label: string
  color: string
}

type Point = Record<string, number | string | null | undefined>

// Serie di default: i quattro score principali; le etichette vengono da
// `scores.names`. Colonna DB → chiave di traduzione.
const DEFAULT_SERIES_DEF: Array<{ key: string; nameKey: string; color: string }> = [
  { key: 'stress_score', nameKey: 'stress', color: '#EF4444' },
  { key: 'recovery_score', nameKey: 'recovery', color: '#10B981' },
  { key: 'balance_score', nameKey: 'balance', color: '#4FA39A' },
  { key: 'energy_score', nameKey: 'energy', color: '#F59E0B' },
]

export function TrendChart({
  data,
  series,
  height = 280,
  dateKey = 'date',
}: {
  data: Point[]
  series?: TrendSeries[]
  height?: number
  dateKey?: string
}) {
  const locale = useLocale()
  const tScores = useTranslations('scores.names')
  const resolvedSeries = useMemo<TrendSeries[]>(
    () => series ?? DEFAULT_SERIES_DEF.map((s) => ({ key: s.key, label: tScores(s.nameKey), color: s.color })),
    [series, tScores],
  )
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(resolvedSeries.map((s) => [s.key, true])),
  )

  const tickDate = useMemo(() => new Intl.DateTimeFormat(intlTag(locale), { day: 'numeric', month: 'short' }), [locale])
  const fullDate = useMemo(
    () => new Intl.DateTimeFormat(intlTag(locale), { day: 'numeric', month: 'short', year: 'numeric' }),
    [locale],
  )

  const toggle = (key: string) => setVisible((v) => ({ ...v, [key]: !(v[key] ?? true) }))

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {resolvedSeries.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => toggle(s.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border max-w-full transition-colors ${
              (visible[s.key] ?? true)
                ? 'bg-white border-surface-border text-anthracite'
                : 'bg-surface border-surface-border text-anthracite-lighter line-through'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="truncate">{s.label}</span>
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
          <XAxis
            dataKey={dateKey}
            stroke="#6B7280"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => {
              try { return tickDate.format(parseISO(String(v))) } catch { return String(v) }
            }}
          />
          <YAxis domain={[0, 100]} stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 12 }}
            labelFormatter={(v) => { try { return fullDate.format(parseISO(String(v))) } catch { return String(v) } }}
          />
          <Legend wrapperStyle={{ display: 'none' }} />
          {resolvedSeries.filter((s) => visible[s.key] ?? true).map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              name={s.label}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
