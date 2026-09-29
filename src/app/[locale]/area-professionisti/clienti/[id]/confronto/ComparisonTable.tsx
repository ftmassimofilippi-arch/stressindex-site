'use client'

import { useLocale, useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { deltaVerdict, SCORE_DELTA_ROWS } from '@/lib/before-after'
import { num } from '@/lib/format'
import type { MeasurementAnalytics } from '@/lib/types'

// `label` è il testo fisso (sigla HRV) oppure, con `labelKey`, la chiave in
// clients.compare.table.*.
type HrvRow = { key: keyof MeasurementAnalytics; label?: string; labelKey?: 'meanHr' | 'baevsky'; unit?: string; digits?: number; higherIsBetter: boolean; stableBelow: number }

// Parametri HRV mostrati sotto ai cinque score, con la direzione "meglio"
// della schermata Confronto dell'app (FC media e Stress Index: più basso).
const HRV_ROWS: HrvRow[] = [
  { key: 'mean_hr', labelKey: 'meanHr', unit: 'bpm', digits: 0, higherIsBetter: false, stableBelow: 2 },
  { key: 'rmssd', label: 'RMSSD', unit: 'ms', digits: 1, higherIsBetter: true, stableBelow: 2 },
  { key: 'sdnn', label: 'SDNN', unit: 'ms', digits: 1, higherIsBetter: true, stableBelow: 2 },
  { key: 'pnn50', label: 'pNN50', unit: '%', digits: 1, higherIsBetter: true, stableBelow: 2 },
  { key: 'dfa_alpha1', label: 'DFA α1', digits: 2, higherIsBetter: true, stableBelow: 0.05 },
  { key: 'stress_index_baevsky', labelKey: 'baevsky', digits: 1, higherIsBetter: false, stableBelow: 5 },
]

function val(m: MeasurementAnalytics, key: keyof MeasurementAnalytics): number | null {
  const v = m[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function Delta({ a, b, higherIsBetter, digits, unit, stableBelow }: { a: number | null; b: number | null; higherIsBetter: boolean; digits: number; unit?: string; stableBelow: number }) {
  const t = useTranslations('clients.compare.table')
  const locale = useLocale()
  const verdict = deltaVerdict(a, b, higherIsBetter, stableBelow)
  if (a == null || b == null) return <span className="text-anthracite-lighter">—</span>
  const delta = b - a
  const tone = verdict === 'improved' ? 'text-emerald-700' : verdict === 'declined' ? 'text-red-700' : 'text-anthracite-lighter'
  const Icon = verdict === 'stable' ? Minus : delta > 0 ? ArrowUp : ArrowDown
  const label = verdict === 'improved' ? t('improved') : verdict === 'declined' ? t('declined') : t('stable')
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${tone}`}>
      <Icon size={13} />
      {delta > 0 ? '+' : ''}{num(delta, digits, locale)}{unit ? <span className="text-[10px] ml-0.5">{unit}</span> : null}
      <span className="text-[10px] ml-1">{label}</span>
    </span>
  )
}

export function ComparisonTable({ a, b }: { a: MeasurementAnalytics; b: MeasurementAnalytics }) {
  const t = useTranslations('clients.compare.table')
  const tScores = useTranslations('scores')
  const locale = useLocale()
  return (
    <section className="card p-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-anthracite-lighter border-b border-surface-border">
              <th className="py-2 pr-4 font-medium">{t('parameter')}</th>
              <th className="py-2 px-4 font-medium text-right">{t('before')}</th>
              <th className="py-2 px-4 font-medium text-right">{t('after')}</th>
              <th className="py-2 pl-4 font-medium text-right">{t('change')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            <tr><td colSpan={4} className="pt-3 pb-1 text-[11px] uppercase tracking-wide text-teal-dark font-medium">{t('scoresGroup')}</td></tr>
            {SCORE_DELTA_ROWS.map((r) => {
              const va = a[r.key]
              const vb = b[r.key]
              return (
                <tr key={r.key}>
                  <td className="py-2 pr-4 text-anthracite-lighter">{tScores(`names.${r.nameKey}`)}</td>
                  <td className="py-2 px-4 text-right font-medium text-anthracite tabular-nums">{num(va, 0, locale)}</td>
                  <td className="py-2 px-4 text-right font-medium text-anthracite tabular-nums">{num(vb, 0, locale)}</td>
                  <td className="py-2 pl-4 text-right"><Delta a={va} b={vb} higherIsBetter={r.higherIsBetter} digits={0} stableBelow={3} /></td>
                </tr>
              )
            })}
            <tr><td colSpan={4} className="pt-4 pb-1 text-[11px] uppercase tracking-wide text-teal-dark font-medium">{t('hrvGroup')}</td></tr>
            {HRV_ROWS.map((r) => {
              const va = val(a, r.key)
              const vb = val(b, r.key)
              if (va == null && vb == null) return null
              return (
                <tr key={String(r.key)}>
                  <td className="py-2 pr-4 text-anthracite-lighter">{r.labelKey ? t(r.labelKey) : r.label}</td>
                  <td className="py-2 px-4 text-right font-medium text-anthracite tabular-nums">{num(va, r.digits ?? 1, locale)}{r.unit ? <span className="text-[10px] text-anthracite-lighter ml-1">{r.unit}</span> : null}</td>
                  <td className="py-2 px-4 text-right font-medium text-anthracite tabular-nums">{num(vb, r.digits ?? 1, locale)}{r.unit ? <span className="text-[10px] text-anthracite-lighter ml-1">{r.unit}</span> : null}</td>
                  <td className="py-2 pl-4 text-right"><Delta a={va} b={vb} higherIsBetter={r.higherIsBetter} digits={r.digits ?? 1} unit={r.unit} stableBelow={r.stableBelow} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-anthracite-lighter mt-3">{t('legend')}</p>
    </section>
  )
}
