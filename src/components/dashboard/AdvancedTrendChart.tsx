'use client'

import { useMemo, useState } from 'react'
import { Calendar } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { TrendChart, type TrendSeries } from './TrendChart'

type Point = Record<string, number | string | null | undefined> & { date: string }

type PresetKey = '7' | '30' | '90' | '180' | '365' | 'all' | 'custom'

const PRESETS: Array<{ key: PresetKey; label: string; days: number | null }> = [
  { key: '7', label: 'Ultimi 7', days: 7 },
  { key: '30', label: 'Ultimi 30', days: 30 },
  { key: '90', label: '90 giorni', days: 90 },
  { key: '180', label: '6 mesi', days: 180 },
  { key: '365', label: '1 anno', days: 365 },
  { key: 'all', label: 'Tutto', days: null },
]

function isoDay(d: Date) { return format(d, 'yyyy-MM-dd') }

export function AdvancedTrendChart({
  data,
  series,
  defaultPreset = '30',
  height = 260,
  storageKey,
}: {
  data: Point[]
  series: TrendSeries[]
  defaultPreset?: PresetKey
  height?: number
  /** opzionale: salva la preferenza di periodo in localStorage */
  storageKey?: string
}) {
  const [activeKey, setActiveKey] = useState<PresetKey>(() => {
    if (typeof window !== 'undefined' && storageKey) {
      const saved = window.localStorage.getItem(storageKey) as PresetKey | null
      if (saved) return saved
    }
    return defaultPreset
  })
  const [customFrom, setCustomFrom] = useState(() => isoDay(subDays(new Date(), 30)))
  const [customTo, setCustomTo] = useState(() => isoDay(new Date()))

  function setKey(k: PresetKey) {
    setActiveKey(k)
    if (typeof window !== 'undefined' && storageKey) {
      window.localStorage.setItem(storageKey, k)
    }
  }

  const filtered = useMemo(() => {
    if (!data.length) return []
    if (activeKey === 'all') return data
    let fromDate: string
    let toDate: string
    if (activeKey === 'custom') {
      fromDate = customFrom
      toDate = customTo
    } else {
      const p = PRESETS.find((x) => x.key === activeKey)
      const days = p?.days ?? 30
      fromDate = isoDay(subDays(new Date(), days))
      toDate = isoDay(new Date())
    }
    return data.filter((p) => {
      const d = String(p.date)
      return d >= fromDate && d <= toDate
    })
  }, [data, activeKey, customFrom, customTo])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setKey(p.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              activeKey === p.key
                ? 'bg-teal-dark text-white border-teal-dark'
                : 'bg-white border-surface-border text-anthracite-lighter hover:bg-surface hover:text-anthracite'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setKey('custom')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            activeKey === 'custom'
              ? 'bg-teal-dark text-white border-teal-dark'
              : 'bg-white border-surface-border text-anthracite-lighter hover:bg-surface hover:text-anthracite'
          }`}
        >
          <Calendar size={12} /> Custom
        </button>
        {activeKey === 'custom' && (
          <div className="flex items-center gap-1.5 ml-2">
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="text-xs px-2 py-1 border border-surface-border rounded-lg bg-white text-anthracite"
            />
            <span className="text-xs text-anthracite-lighter">→</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={isoDay(new Date())}
              onChange={(e) => setCustomTo(e.target.value)}
              className="text-xs px-2 py-1 border border-surface-border rounded-lg bg-white text-anthracite"
            />
          </div>
        )}
      </div>
      {filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-anthracite-lighter">Nessun dato nel periodo selezionato</div>
      ) : (
        <TrendChart data={filtered} series={series} height={height} />
      )}
    </div>
  )
}
