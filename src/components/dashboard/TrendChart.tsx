'use client'

import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

export type TrendSeries = {
  key: string
  label: string
  color: string
}

type Point = Record<string, number | string | null | undefined>

const DEFAULT_SERIES: TrendSeries[] = [
  { key: 'stress_score', label: 'Stress', color: '#EF4444' },
  { key: 'recovery_score', label: 'Recupero', color: '#10B981' },
  { key: 'balance_score', label: 'Equilibrio', color: '#4FA39A' },
  { key: 'energy_score', label: 'Energia', color: '#F59E0B' },
]

export function TrendChart({
  data,
  series = DEFAULT_SERIES,
  height = 280,
  dateKey = 'date',
}: {
  data: Point[]
  series?: TrendSeries[]
  height?: number
  dateKey?: string
}) {
  const [visible, setVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(series.map((s) => [s.key, true])),
  )

  const toggle = (key: string) => setVisible((v) => ({ ...v, [key]: !v[key] }))

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {series.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => toggle(s.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              visible[s.key]
                ? 'bg-white border-surface-border text-anthracite'
                : 'bg-surface border-surface-border text-anthracite-lighter line-through'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
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
              try { return format(parseISO(v), 'd MMM', { locale: it }) } catch { return v }
            }}
          />
          <YAxis domain={[0, 100]} stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 12 }}
            labelFormatter={(v) => { try { return format(parseISO(v as string), 'd MMM yyyy', { locale: it }) } catch { return v as string } }}
          />
          <Legend wrapperStyle={{ display: 'none' }} />
          {series.filter((s) => visible[s.key]).map((s) => (
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
