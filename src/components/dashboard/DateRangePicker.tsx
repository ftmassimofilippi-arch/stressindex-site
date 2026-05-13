'use client'

import { useState } from 'react'
import { Calendar } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { subDays, subMonths, startOfDay, endOfDay, format } from 'date-fns'

export type DateRange = { from: string; to: string } // ISO

type Props = {
  value: DateRange
  onChange: (v: DateRange) => void
}

const PRESETS = [
  { label: '7 giorni', days: 7 },
  { label: '30 giorni', days: 30 },
  { label: '90 giorni', days: 90 },
  { label: '6 mesi', months: 6 },
  { label: '1 anno', months: 12 },
] as const

function isoDay(d: Date) { return format(d, 'yyyy-MM-dd') }

export function defaultRange(days = 30): DateRange {
  const to = endOfDay(new Date())
  const from = startOfDay(subDays(to, days))
  return { from: isoDay(from), to: isoDay(to) }
}

export function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)

  function applyPreset(p: typeof PRESETS[number]) {
    const to = new Date()
    const from = 'days' in p ? subDays(to, p.days) : subMonths(to, p.months)
    onChange({ from: isoDay(from), to: isoDay(to) })
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-surface-border rounded-xl hover:bg-surface"
      >
        <Calendar size={15} />
        <span>{formatDate(value.from)} – {formatDate(value.to)}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full mt-2 z-40 w-80 bg-white border border-surface-border rounded-2xl shadow-elevated p-4">
            <div className="text-xs font-medium text-anthracite-lighter uppercase tracking-wide mb-2">Preset</div>
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="px-3 py-2 text-sm text-anthracite hover:bg-surface rounded-lg text-left"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Dal</label>
                <input
                  type="date"
                  value={value.from}
                  max={value.to}
                  onChange={(e) => onChange({ ...value, from: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="input-label">Al</label>
                <input
                  type="date"
                  value={value.to}
                  min={value.from}
                  onChange={(e) => onChange({ ...value, to: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
