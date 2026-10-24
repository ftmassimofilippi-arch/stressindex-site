'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { LinkCell } from '@/components/dashboard/LinkCell'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { DateRangePicker, defaultRange, type DateRange } from '@/components/dashboard/DateRangePicker'
import { formatMeasuredDate, formatMeasuredTime, intervalloGiorniIta, measuredDayKey, measuredInstant, num } from '@/lib/format'
import {
  deltaVerdict,
  deltaVerdictPct,
  pairBeforeAfter,
  pairMorningCoherence,
  SCORE_DELTA_ROWS,
  type BeforeAfterPair,
  type CoherencePairableRow,
  type MorningCoherencePair,
} from '@/lib/before-after'
import { normalizeTestType } from '@/lib/measurement-type'
import { changeSummary, courseBaseline, dailyReferenceValues, isReferenceMeasurement, rollingMean7, toDisplay, type ChangeSummary } from '@/lib/reference-trend.ts'
import { panelName } from '@/components/dashboard/AdvancedTrendChart'
import type { Client, MeasurementAnalytics } from '@/lib/types'

// Scheda "Prima e dopo", due viste (17/10/2026):
//   1. "Inizio e adesso" (default, da mostrare al cliente): una riga per
//      indice con partenza, adesso, variazione, verdetto e la mini linea della
//      media mobile, dagli stessi conti dei grafici (reference-trend.ts);
//   2. "Effetto della seduta": le coppie pre/post dell'app (stessa regola di
//      accoppiamento, src/lib/before-after.ts) più le coppie "mattino +
//      coerenza" dello stesso giorno (solo sito, pairMorningCoherence).
// Il click su una coppia apre il confronto delle due sessioni.

type Row = CoherencePairableRow & { m: MeasurementAnalytics }

function toRows(measurements: MeasurementAnalytics[], clientId: string, excluded: ReadonlySet<string>): Row[] {
  const out: Row[] = []
  for (const m of measurements) {
    const inst = measuredInstant(m)
    const day = measuredDayKey(m)
    if (!inst || !day) continue
    out.push({
      id: m.session_id,
      clientId: m.client_id ?? clientId,
      instantMs: inst.getTime(),
      dayKey: day,
      tags: m.tags,
      reference: isReferenceMeasurement(m, excluded),
      coherence: normalizeTestType(m.test_type) === 'coherence' || m.coherence_data != null,
      m,
    })
  }
  return out
}

// Freccia = direzione reale del numero, colore = significato (per lo Stress
// il calo è verde). Stessa regola del Confronto dell'app. "Stabile" sotto
// `STABLE_DELTA` (decisione 9): 10 punti sugli score, 10% sui parametri
// (`pct`).
function DeltaCell({ a, b, higherIsBetter, digits = 0, unit, pct = false }: { a: number | null; b: number | null; higherIsBetter: boolean; digits?: number; unit?: string; pct?: boolean }) {
  const locale = useLocale()
  const verdict = pct ? deltaVerdictPct(a, b, higherIsBetter) : deltaVerdict(a, b, higherIsBetter)
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

const INDEXES: Array<{ key: string; nameKey: string | null; higherIsBetter: boolean; color: string; score: boolean }> = [
  ...SCORE_DELTA_ROWS.map((r) => ({ key: r.key, nameKey: r.nameKey, higherIsBetter: r.higherIsBetter, color: '', score: true })),
  { key: 'rmssd', nameKey: null, higherIsBetter: true, color: '#0284C7', score: false },
]
const COLORS: Record<string, string> = { score_stress: '#E85D4A', score_recupero: '#4FA39A', score_equilibrio: '#F59E0B', score_energia: '#6366F1', score_modulazione_infiammatoria: '#8B5CF6', rmssd: '#0284C7' }

type View = 'startNow' | 'session'

export function BeforeAfterTab({ client, measurements, professionistaId, excluded = [] }: { client: Client; measurements: MeasurementAnalytics[]; professionistaId?: string; excluded?: string[] }) {
  const t = useTranslations('clients.beforeAfter')
  const tScores = useTranslations('scores')
  const tCharts = useTranslations('charts')
  const tMetrics = useTranslations('charts.metrics')
  const locale = useLocale()
  const qs = professionistaId ? `&professionista=${professionistaId}` : ''
  const [view, setView] = useState<View>('startNow')
  const [range, setRange] = useState<DateRange>(defaultRange(180))
  const excludedSet = useMemo(() => new Set(excluded), [excluded])

  // Vista 1: partenza, adesso, variazione e verdetto per indice, dagli stessi conti dei grafici.
  const startNow = useMemo(() => INDEXES.map((ix) => {
    const daily = dailyReferenceValues(measurements, ix.key, { excluded: excludedSet })
    const summary = changeSummary(ix.key, daily, courseBaseline(daily, client.data_inizio_percorso ?? null))
    const spark = rollingMean7(daily).map((p) => toDisplay(ix.key, p.mean))
    return { ...ix, summary, spark, n: daily.length }
  }), [measurements, excludedSet, client.data_inizio_percorso])
  const anyReference = startNow.some((r) => r.n > 0)

  // Vista 2: coppie nel periodo scelto.
  const rowsInRange = useMemo(() => {
    const { fromIso, toIso } = intervalloGiorniIta(range.from, range.to)
    const fromMs = new Date(fromIso).getTime()
    const toMs = new Date(toIso).getTime()
    return toRows(measurements, client.id, excludedSet).filter((r) => r.instantMs >= fromMs && r.instantMs <= toMs)
  }, [measurements, client.id, range, excludedSet])
  const pairs = useMemo(() => pairBeforeAfter(rowsInRange), [rowsInRange])
  const coherencePairs = useMemo(() => pairMorningCoherence(rowsInRange), [rowsInRange])

  const averages = useMemo(() => SCORE_DELTA_ROWS.map((r) => {
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
  }), [pairs])

  const tab = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${active ? 'bg-teal-dark text-white border-teal-dark' : 'bg-white border-surface-border text-anthracite-lighter hover:bg-surface hover:text-anthracite'}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setView('startNow')} className={tab(view === 'startNow')} aria-pressed={view === 'startNow'}>{t('viewStartNow')}</button>
        <button type="button" onClick={() => setView('session')} className={tab(view === 'session')} aria-pressed={view === 'session'}>{t('viewSession')}</button>
      </div>

      {view === 'startNow' && (
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <h3 className="font-serif text-base text-anthracite">{t('viewStartNow')}</h3>
            <p className="text-xs text-anthracite-lighter mt-0.5">{t('startNowSubtitle')}</p>
          </div>
          {!anyReference ? (
            <p className="px-5 py-6 text-sm text-anthracite-lighter">{t('noReference')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-surface text-anthracite-lighter">
                  <tr>
                    {[t('colIndex'), t('colStart'), t('colNow'), t('colChange'), t('colVerdict'), t('colTrend')].map((h, i) => (
                      <th key={h} className={`px-4 py-2.5 text-[11px] uppercase tracking-wide font-medium ${i === 0 || i >= 4 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {startNow.map((r) => (
                    <StartNowRow key={r.key} name={r.nameKey ? tScores(`names.${r.nameKey}`) : panelName(r.key, tCharts, tMetrics)} color={COLORS[r.key]} score={r.score} summary={r.summary} spark={r.spark} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {view === 'session' && (
        <>
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <DateRangePicker value={range} onChange={setRange} />
            <div className="text-sm text-anthracite-lighter">{t('pairsInPeriod', { count: pairs.length + coherencePairs.length })}</div>
          </div>

          <section className="card p-5">
            <h3 className="font-serif text-base text-anthracite mb-1">{t('avgTitle')}</h3>
            <p className="text-xs text-anthracite-lighter mb-3">{t('avgSubtitle')}</p>
            {pairs.length === 0 ? (
              <p className="text-sm text-anthracite-lighter">{t('noPrePost')}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {averages.map((r) => (
                  <div key={r.key} className="rounded-xl border border-surface-border bg-surface px-3 py-2 min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter truncate">{tScores(`names.${r.nameKey}`)}</div>
                    <div className="text-lg font-serif text-anthracite mt-0.5">
                      <DeltaCell a={0} b={r.avg} higherIsBetter={r.higherIsBetter} digits={1} />
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
              <PairsTable
                rows={pairs.map((p) => ({ key: `${p.pre.id}-${p.post.id}`, pre: p.pre.m, post: p.post.m, kind: p.kind }))}
                client={client}
                qs={qs}
                typeLabel={(k) => (k === 'coherence' ? null : <KindBadge kind={k} />)}
              />
            </section>
          )}

          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-border">
              <h3 className="font-serif text-base text-anthracite">{t('coherenceTitle')}</h3>
              <p className="text-xs text-anthracite-lighter mt-0.5">{t('coherenceSubtitle')}</p>
            </div>
            {coherencePairs.length === 0 ? (
              <p className="px-6 py-5 text-sm text-anthracite-lighter">{t('noCoherencePairs')}</p>
            ) : (
              <PairsTable
                rows={coherencePairs.map((p: MorningCoherencePair<Row>) => ({ key: `${p.morning.id}-${p.coherence.id}`, pre: p.morning.m, post: p.coherence.m, kind: 'coherence' as const }))}
                client={client}
                qs={qs}
                typeLabel={() => <span className="px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap bg-violet-50 text-violet-700">{t('coherenceKind')}</span>}
              />
            )}
          </section>
        </>
      )}
    </div>
  )
}

// ── Vista 1: una riga per indice ─────────────────────────────────────────────

const VERDICT_CLASS: Record<ChangeSummary['verdict'], string> = {
  improved: 'text-emerald-700',
  declined: 'text-rose-700',
  stable: 'text-anthracite',
  unknown: 'text-anthracite-lighter',
}

function StartNowRow({ name, color, score, summary: s, spark }: { name: string; color: string; score: boolean; summary: ChangeSummary; spark: number[] }) {
  const t = useTranslations('clients.beforeAfter')
  const tPanel = useTranslations('charts.panel.numbers')
  const tDir = useTranslations('charts.panel')
  const locale = useLocale()
  const fmt = (v: number | null) => (v == null ? '—' : score ? num(v, 0, locale) : `${num(v, 1, locale)} ms`)
  const pctAbs = s.pct == null ? null : num(Math.abs(s.pct), 0, locale)
  const change = s.pct == null || pctAbs == null ? tPanel('unknown')
    : s.verdict === 'stable' ? tPanel('stable')
    : s.verdict === 'improved' ? tPanel('improved', { pct: pctAbs })
    : s.verdict === 'declined' ? tPanel('declined', { pct: pctAbs })
    : `${s.pct > 0 ? '+' : ''}${num(s.pct, 0, locale)}%`
  // Freccia piatta quando il verdetto è stabile (fascia della partenza), altrimenti il verso del numero.
  const arrow = s.pct == null ? '' : s.verdict === 'stable' || s.pct === 0 ? '→' : s.pct > 0 ? '↑' : '↓'
  const verdict = s.start == null || s.now == null ? t('verdictUnknown')
    : s.provisional ? t('verdictProvisional', { n: s.startProvisional || s.band == null ? s.startN : s.nowN })
    : s.verdict === 'stable' ? t('verdictStable')
    : t('verdictReal')
  return (
    <tr className="border-t border-surface-border">
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-2 font-medium text-anthracite">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          {name}
        </span>
        <div className="text-[11px] text-anthracite-lighter ml-[18px]">{s.higherIsBetter ? '↑' : '↓'} {tDir(s.higherIsBetter ? 'betterHigher' : 'betterLower')}</div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-serif text-lg text-anthracite">{fmt(s.start)}</td>
      <td className="px-4 py-3 text-right tabular-nums font-serif text-lg text-anthracite">{fmt(s.now)}</td>
      <td className={`px-4 py-3 text-right whitespace-nowrap font-medium ${VERDICT_CLASS[s.verdict]}`}>{arrow} {change}</td>
      <td className={`px-4 py-3 text-xs ${s.provisional ? 'text-amber-700' : VERDICT_CLASS[s.verdict]}`}>{verdict}</td>
      <td className="px-4 py-3"><Sparkline values={spark} color={color} /></td>
    </tr>
  )
}

/** Mini linea della media mobile: solo forma, senza assi. */
function Sparkline({ values, color, width = 120, height = 28 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return <span className="text-xs text-anthracite-lighter">—</span>
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 2 - ((v - min) / span) * (height - 4)}`)
  const last = pts[pts.length - 1].split(',')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  )
}

// ── Vista 2: tabelle delle coppie ────────────────────────────────────────────

function KindBadge({ kind }: { kind: BeforeAfterPair['kind'] }) {
  const tKind = useTranslations('common.beforeAfterKind')
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${kind === 'treatment' ? 'bg-emerald-50 text-emerald-700' : 'bg-green-50 text-green-800'}`}>
      {tKind(kind)}
    </span>
  )
}

type PairRowData = { key: string; pre: MeasurementAnalytics; post: MeasurementAnalytics; kind: BeforeAfterPair['kind'] | 'coherence' }

function PairsTable({ rows, client, qs, typeLabel }: { rows: PairRowData[]; client: Client; qs: string; typeLabel: (kind: BeforeAfterPair['kind'] | 'coherence') => React.ReactNode }) {
  const t = useTranslations('clients.beforeAfter')
  const tScores = useTranslations('scores')
  const locale = useLocale()
  return (
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
          {rows.map((p) => {
            const href = `/area-professionisti/clienti/${client.id}/confronto?a=${p.pre.session_id}&b=${p.post.session_id}${qs}`
            return (
              <tr key={p.key} className="border-t border-surface-border hover:bg-surface transition-colors">
                <LinkCell href={href} primary padding="px-5 py-3" className="text-anthracite">
                  <div className="font-medium">{formatMeasuredDate(p.post, undefined, locale)}</div>
                  <div className="text-[11px] text-anthracite-lighter">{formatMeasuredTime(p.pre, locale)} → {formatMeasuredTime(p.post, locale)}</div>
                </LinkCell>
                <LinkCell href={href}>{typeLabel(p.kind)}</LinkCell>
                {SCORE_DELTA_ROWS.map((r) => (
                  <LinkCell key={r.key} href={href} className="text-right">
                    <DeltaCell a={p.pre[r.key]} b={p.post[r.key]} higherIsBetter={r.higherIsBetter} />
                  </LinkCell>
                ))}
                <LinkCell href={href} className="text-right">
                  <DeltaCell a={p.pre.rmssd} b={p.post.rmssd} higherIsBetter digits={1} unit="ms" pct />
                </LinkCell>
                <LinkCell href={href} className="text-right">
                  <DeltaCell a={p.pre.mean_hr} b={p.post.mean_hr} higherIsBetter={false} unit="bpm" pct />
                </LinkCell>
                <LinkCell href={href} className="text-right">
                  <span className="text-teal-dark text-sm whitespace-nowrap">{t('compare')}</span>
                </LinkCell>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

