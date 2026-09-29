'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Calendar } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { subDays, subMonths, startOfDay, endOfDay, format } from 'date-fns'

export type DateRange = { from: string; to: string } // ISO

type Props = {
  value: DateRange
  onChange: (v: DateRange) => void
}

// Gli id dei preset sono stabili (chiavi React e chiavi dei messaggi
// `dashboard.dateRange.*`); il valore emesso resta la coppia ISO from/to.
const PRESETS = [
  { id: 'last7', days: 7 },
  { id: 'last30', days: 30 },
  { id: 'last90', days: 90 },
  { id: 'months6', months: 6 },
  { id: 'year1', months: 12 },
] as const

function isoDay(d: Date) { return format(d, 'yyyy-MM-dd') }

export function defaultRange(days = 30): DateRange {
  const to = endOfDay(new Date())
  const from = startOfDay(subDays(to, days))
  return { from: isoDay(from), to: isoDay(to) }
}

export function DateRangePicker({ value, onChange }: Props) {
  const t = useTranslations('dashboard.dateRange')
  const locale = useLocale()
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
        className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-surface-border rounded-xl hover:bg-surface whitespace-nowrap"
      >
        <Calendar size={15} />
        <span>{formatDate(value.from, undefined, locale)} – {formatDate(value.to, undefined, locale)}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full mt-2 z-40 w-80 max-w-[calc(100vw-2rem)] bg-white border border-surface-border rounded-2xl shadow-elevated p-4">
            <div className="text-xs font-medium text-anthracite-lighter uppercase tracking-wide mb-2">{t('presets')}</div>
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="px-3 py-2 text-sm text-anthracite hover:bg-surface rounded-lg text-left"
                >
                  {t(p.id)}
                </button>
              ))}
            </div>
            <div className="text-xs font-medium text-anthracite-lighter uppercase tracking-wide mb-2">{t('custom')}</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">{t('from')}</label>
                <input
                  type="date"
                  lang={locale}
                  value={value.from}
                  max={value.to}
                  onChange={(e) => onChange({ ...value, from: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="input-label">{t('to')}</label>
                <input
                  type="date"
                  lang={locale}
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
