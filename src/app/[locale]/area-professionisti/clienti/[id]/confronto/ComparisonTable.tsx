'use client'

import { useLocale, useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { deltaVerdict, SCORE_DELTA_ROWS, type DeltaVerdict } from '@/lib/before-after'
import { num } from '@/lib/format'
import { STABLE_DELTA } from '@/lib/hrv-reference'
import { verdettoVariazione } from '@/lib/trend-stats'
import type { MeasurementAnalytics } from '@/lib/types'

// `label` è il testo fisso (sigla HRV) oppure, con `labelKey`, la chiave in
// clients.compare.table.*.
type HrvRow = { key: keyof MeasurementAnalytics; label?: string; labelKey?: 'meanHr' | 'baevsky'; unit?: string; digits?: number }

// Parametri HRV mostrati sotto ai cinque score. Il verso del "meglio" viene
// da `PARAM_REFERENCE` (hrv-reference.ts, Appendice A del manuale) tramite
// `verdettoVariazione`: FC media e Stress Index più basso, RMSSD, SDNN e
// pNN50 più alto, DFA α1 a campana verso 1,0 (migliora chi si avvicina),
// LF/HF senza direzione (decisione 12). "Stabile" sotto il 10% (decisione 9).
const HRV_ROWS: HrvRow[] = [
  { key: 'mean_hr', labelKey: 'meanHr', unit: 'bpm', digits: 0 },
  { key: 'rmssd', label: 'RMSSD', unit: 'ms', digits: 1 },
  { key: 'sdnn', label: 'SDNN', unit: 'ms', digits: 1 },
  { key: 'pnn50', label: 'pNN50', unit: '%', digits: 1 },
  { key: 'dfa_alpha1', label: 'DFA α1', digits: 2 },
  { key: 'stress_index_baevsky', labelKey: 'baevsky', digits: 1 },
]

function val(m: MeasurementAnalytics, key: keyof MeasurementAnalytics): number | null {
  const v = m[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

// Freccia = direzione reale del numero, colore = significato. Per gli score
// il verdetto è `deltaVerdict` (10 punti), per i parametri `verdettoVariazione`
// (10% e verso da hrv-reference). Con verdetto 'unknown' (LF/HF) resta solo
// il numero, senza colore né etichetta.
function Delta({ a, b, verdict, digits, unit }: { a: number | null; b: number | null; verdict: DeltaVerdict; digits: number; unit?: string }) {
  const t = useTranslations('clients.compare.table')
  const locale = useLocale()
  if (a == null || b == null) return <span className="text-anthracite-lighter">—</span>
  const delta = b - a
  const tone = verdict === 'improved' ? 'text-emerald-700' : verdict === 'declined' ? 'text-red-700' : 'text-anthracite-lighter'
  const Icon = verdict === 'stable' ? Minus : delta > 0 ? ArrowUp : ArrowDown
  const label = verdict === 'improved' ? t('improved') : verdict === 'declined' ? t('declined') : verdict === 'stable' ? t('stable') : null
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${tone}`}>
      <Icon size={13} />
      {delta > 0 ? '+' : ''}{num(delta, digits, locale)}{unit ? <span className="text-[10px] ml-0.5">{unit}</span> : null}
      {label && <span className="text-[10px] ml-1">{label}</span>}
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
                  <td className="py-2 pl-4 text-right"><Delta a={va} b={vb} verdict={deltaVerdict(va, vb, r.higherIsBetter, STABLE_DELTA.score)} digits={0} /></td>
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
                  <td className="py-2 pl-4 text-right"><Delta a={va} b={vb} verdict={verdettoVariazione(va, vb, String(r.key))} digits={r.digits ?? 1} unit={r.unit} /></td>
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
