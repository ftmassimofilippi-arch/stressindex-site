'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { LinkCell } from '@/components/dashboard/LinkCell'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { DateRangePicker, defaultRange, type DateRange } from '@/components/dashboard/DateRangePicker'
import { formatMeasuredDate, formatMeasuredTime, intervalloGiorniIta, measuredDayKey, measuredInstant, num } from '@/lib/format'
import {
  deltaVerdict,
  pairBeforeAfter,
  SCORE_DELTA_ROWS,
  type BeforeAfterPair,
  type PairableRow,
} from '@/lib/before-after'
import type { Client, MeasurementAnalytics } from '@/lib/types'

// Sezione "Prima e dopo": le coppie pre/post del cliente (stessa regola di
// accoppiamento dell'app, src/lib/before-after.ts) con i delta dei cinque
// score, RMSSD e FC media; riepilogo medio del periodo; click che apre il
// confronto delle due sessioni.

type Row = PairableRow & { m: MeasurementAnalytics }

function toRows(measurements: MeasurementAnalytics[], clientId: string): Row[] {
  const out: Row[] = []
  for (const m of measurements) {
    const inst = measuredInstant(m)
    const day = measuredDayKey(m)
    if (!inst || !day) continue
    out.push({ id: m.session_id, clientId: m.client_id ?? clientId, instantMs: inst.getTime(), dayKey: day, tags: m.tags, m })
  }
  return out
}

// Freccia = direzione reale del numero, colore = significato (per lo Stress
// il calo è verde). Stessa regola del Confronto dell'app.
function DeltaCell({ a, b, higherIsBetter, digits = 0, unit, stableBelow = 3 }: { a: number | null; b: number | null; higherIsBetter: boolean; digits?: number; unit?: string; stableBelow?: number }) {
  const locale = useLocale()
  const verdict = deltaVerdict(a, b, higherIsBetter, stableBelow)
  if (a == null || b == null) return <span className="text-anthracite-lighter">—</span>
  const delta = b - a
  const tone = verdict === 'improved' ? 'text-emerald-700' : verdict === 'declined' ? 'text-red-700' : 'text-anthracite-lighter'
  const Icon = verdict === 'stable' ? Minus : delta > 0 ? ArrowUp : ArrowDown
  return (
    <span className={`inline-flex items-center gap-0.5 tabular-nums ${tone}`}>
      <Icon size={12} />
      {delta > 0 ? '+' : ''}{num(delta, digits, locale)}{unit ? <span className="text-[10px] ml-0.5">{unit}</span> : null}
    </span>
  )
}

export function BeforeAfterTab({ client, measurements, professionistaId }: { client: Client; measurements: MeasurementAnalytics[]; professionistaId?: string }) {
  const t = useTranslations('clients.beforeAfter')
  const tScores = useTranslations('scores')
  const qs = professionistaId ? `&professionista=${professionistaId}` : ''
  const [range, setRange] = useState<DateRange>(defaultRange(180))

  const pairs = useMemo(() => {
    // Estremi a mezzanotte ITALIANA: con la mezzanotte UTC le misurazioni
    // serali cadevano nel giorno dopo e uscivano dal periodo selezionato.
    const { fromIso, toIso } = intervalloGiorniIta(range.from, range.to)
    const fromMs = new Date(fromIso).getTime()
    const toMs = new Date(toIso).getTime()
    const rows = toRows(measurements, client.id).filter((r) => r.instantMs >= fromMs && r.instantMs <= toMs)
    return pairBeforeAfter(rows)
  }, [measurements, client.id, range])

  // Variazione media dei cinque score su tutte le coppie del periodo.
  const averages = useMemo(() => {
    return SCORE_DELTA_ROWS.map((r) => {
      let sum = 0
      let n = 0
      for (const p of pairs) {
        const a = p.pre.m[r.key]
        const b = p.post.m[r.key]
        if (a == null || b == null) continue
        sum += b - a
        n++
      }
      return { ...r, avg: n ? sum / n : null, n }
    })
  }, [pairs])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <DateRangePicker value={range} onChange={setRange} />
        <div className="text-sm text-anthracite-lighter">{t('pairsInPeriod', { count: pairs.length })}</div>
      </div>

      <section className="card p-5">
        <h3 className="font-serif text-base text-anthracite mb-1">{t('avgTitle')}</h3>
        <p className="text-xs text-anthracite-lighter mb-3">{t('avgSubtitle')}</p>
        {pairs.length === 0 ? (
          <p className="text-sm text-anthracite-lighter">{t('howToPair')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {averages.map((r) => (
              <div key={r.key} className="rounded-xl border border-surface-border bg-surface px-3 py-2 min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter truncate">{tScores(`names.${r.nameKey}`)}</div>
                <div className="text-lg font-serif text-anthracite mt-0.5">
                  <DeltaCell a={0} b={r.avg} higherIsBetter={r.higherIsBetter} digits={1} stableBelow={2} />
                </div>
                <div className="text-[10px] text-anthracite-lighter">{t('pairsCount', { count: r.n })}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {pairs.length > 0 && (
        <section className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-border">
            <h3 className="font-serif text-base text-anthracite">{t('pairsTitle')}</h3>
            <p className="text-xs text-anthracite-lighter mt-0.5">{t('pairsSubtitle')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-anthracite-lighter">
                <tr>
                  <th className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('colDate')}</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('colType')}</th>
                  {SCORE_DELTA_ROWS.map((r) => (
                    <th key={r.key} className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{tScores(`names.${r.nameKey}`)}</th>
                  ))}
                  <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">RMSSD</th>
                  <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('colHr')}</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {pairs.map((p) => (
                  <PairRow key={`${p.pre.id}-${p.post.id}`} pair={p} href={`/area-professionisti/clienti/${client.id}/confronto?a=${p.pre.id}&b=${p.post.id}${qs}`} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function PairRow({ pair, href }: { pair: BeforeAfterPair<Row>; href: string }) {
  const t = useTranslations('clients.beforeAfter')
  const tKind = useTranslations('common.beforeAfterKind')
  const locale = useLocale()
  const pre = pair.pre.m
  const post = pair.post.m
  return (
    <tr className="border-t border-surface-border hover:bg-surface transition-colors">
      <LinkCell href={href} primary padding="px-5 py-3" className="text-anthracite">
        <div className="font-medium">{formatMeasuredDate(post, undefined, locale)}</div>
        <div className="text-[11px] text-anthracite-lighter">{formatMeasuredTime(pre, locale)} → {formatMeasuredTime(post, locale)}</div>
      </LinkCell>
      <LinkCell href={href}>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${pair.kind === 'treatment' ? 'bg-emerald-50 text-emerald-700' : 'bg-green-50 text-green-800'}`}>
          {tKind(pair.kind)}
        </span>
      </LinkCell>
      {SCORE_DELTA_ROWS.map((r) => (
        <LinkCell key={r.key} href={href} className="text-right">
          <DeltaCell a={pre[r.key]} b={post[r.key]} higherIsBetter={r.higherIsBetter} />
        </LinkCell>
      ))}
      <LinkCell href={href} className="text-right">
        <DeltaCell a={pre.rmssd} b={post.rmssd} higherIsBetter digits={1} unit="ms" stableBelow={2} />
      </LinkCell>
      <LinkCell href={href} className="text-right">
        <DeltaCell a={pre.mean_hr} b={post.mean_hr} higherIsBetter={false} unit="bpm" stableBelow={2} />
      </LinkCell>
      <LinkCell href={href} className="text-right">
        <span className="text-teal-dark text-sm whitespace-nowrap">{t('compare')}</span>
      </LinkCell>
    </tr>
  )
}
