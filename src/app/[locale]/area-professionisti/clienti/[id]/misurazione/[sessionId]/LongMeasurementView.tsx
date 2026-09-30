'use client'

import { useMemo, useState } from 'react'
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useLocale, useTranslations } from 'next-intl'
import { num } from '@/lib/format'
import { formatClock } from '@/lib/measurement-type'
import type { MeasurementAnalytics, MeasurementSegment, RollingSeriesPoint } from '@/lib/types'

// Vista per le misurazioni lunghe: andamento continuo navigabile (Brush),
// analisi segmentata e confronto inizio-fine.

// Metadati delle metriche della serie rolling (chiavi camelCase come nel JSONB).
// L'etichetta è in `measurement.long.metrics.<chiave>`.
const ROLLING_META: Record<string, { unit?: string; color: string; digits?: number }> = {
  rmssd: { unit: 'ms', color: '#4FA39A' },
  sdnn: { unit: 'ms', color: '#3B82F6' },
  meanBpm: { unit: 'bpm', color: '#EF4444', digits: 0 },
  stressIndex: { color: '#F59E0B', digits: 1 },
  dfaAlpha1: { color: '#8B5CF6', digits: 2 },
  lfHfRatio: { color: '#6366F1', digits: 2 },
  hfPower: { unit: 'ms²', color: '#0EA5E9' },
}

function metaFor(k: string) {
  return ROLLING_META[k] ?? { color: '#6B7280' }
}

function signed(v: number, digits: number, locale: string): string {
  return `${v > 0 ? '+' : ''}${num(v, digits, locale)}`
}

// `print`: pagina di stampa A4. Serie continua (metrica di default, senza
// selettore né brush) e grafico dei segmenti con dimensioni fisse
// (`width`, default 680 px), senza tooltip.
export function LongMeasurementView({ measurement, print = false, width = 680 }: { measurement: MeasurementAnalytics; print?: boolean; width?: number }) {
  const rolling = Array.isArray(measurement.rolling_series) ? measurement.rolling_series : []
  const segments = Array.isArray(measurement.segments) ? measurement.segments : []

  return (
    <div className={print ? 'space-y-4' : 'space-y-6'}>
      <RollingChart rolling={rolling} print={print} width={width} />
      <StartEndComparison segments={segments} print={print} />
      <SegmentAnalysis segments={segments} print={print} width={width} />
    </div>
  )
}

// ── Andamento continuo con Brush ─────────────────────────────────────────────
function RollingChart({ rolling, print = false, width = 680 }: { rolling: RollingSeriesPoint[]; print?: boolean; width?: number }) {
  const locale = useLocale()
  const t = useTranslations('measurement.long')
  const tAxes = useTranslations('charts.axes')

  const metrics = useMemo(() => {
    const present = new Set<string>()
    for (const p of rolling) present.add(p.k)
    // ordine preferito + eventuali extra
    const ordered = Object.keys(ROLLING_META).filter((k) => present.has(k))
    const extra = Array.from(present).filter((k) => !ROLLING_META[k])
    return [...ordered, ...extra]
  }, [rolling])

  // Le chiavi extra (non previste) si mostrano con il nome grezzo del JSONB.
  const labelFor = (k: string) => (ROLLING_META[k] ? t(`metrics.${k}`) : k)

  const [metric, setMetric] = useState<string>('')
  // In stampa si mostra sempre la metrica di default (la prima disponibile).
  const activeMetric = !print && metric && metrics.includes(metric) ? metric : metrics[0]

  const data = useMemo(() => {
    if (!activeMetric) return []
    const pts = rolling
      .filter((p) => p.k === activeMetric && Number.isFinite(p.v))
      .map((p) => ({ t: p.t / 1000, v: p.v }))
      .sort((a, b) => a.t - b.t)
    // downsample per leggibilità
    if (pts.length > 1500) {
      const step = Math.ceil(pts.length / 1500)
      return pts.filter((_, i) => i % step === 0)
    }
    return pts
  }, [rolling, activeMetric])

  if (rolling.length === 0 || !activeMetric) {
    return (
      <section className="card p-6">
        <h3 className="font-serif text-base text-anthracite mb-1">
          {t.rich('trendTitle', { em: (c) => <em className="italic">{c}</em> })}
        </h3>
        <div className="h-[240px] flex items-center justify-center text-sm text-anthracite-lighter bg-surface rounded-xl">
          {t('noSeries')}
        </div>
      </section>
    )
  }

  const meta = metaFor(activeMetric)
  const label = labelFor(activeMetric)
  const totalSec = data.length ? data[data.length - 1].t : 0
  const tickStep = totalSec > 3600 ? 600 : totalSec > 1200 ? 300 : totalSec > 300 ? 60 : 30
  const chartW = width - 32
  const chartH = print ? 240 : 340

  const chart = (
    <LineChart data={data} {...(print ? { width: chartW, height: chartH } : {})} margin={{ top: 8, right: 20, bottom: 32, left: 8 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
      <XAxis
        dataKey="t"
        type="number"
        domain={[0, 'dataMax']}
        stroke="#6B7280"
        fontSize={10}
        ticks={Array.from({ length: Math.floor(totalSec / tickStep) + 1 }, (_, i) => i * tickStep)}
        tickFormatter={(v) => formatClock(Number(v))}
        label={{ value: tAxes('timeClock'), position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6B7280' }}
      />
      <YAxis
        stroke="#6B7280"
        fontSize={10}
        domain={['auto', 'auto']}
        tickFormatter={(v) => num(v, meta.digits ?? 0, locale)}
        label={{ value: meta.unit ? `${label} (${meta.unit})` : label, angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }}
      />
      {!print && (
        <Tooltip
          contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }}
          labelFormatter={(v) => `t = ${formatClock(Number(v))}`}
          formatter={(v) => [`${num(v, meta.digits ?? 1, locale)}${meta.unit ? ' ' + meta.unit : ''}`, label]}
        />
      )}
      <Line type="monotone" dataKey="v" stroke={meta.color} strokeWidth={1.6} dot={false} isAnimationActive={false} />
      {!print && (
        <Brush dataKey="t" height={26} stroke={meta.color} travellerWidth={8} tickFormatter={(v) => formatClock(Number(v))} />
      )}
    </LineChart>
  )

  return (
    <section className={`card ${print ? 'p-4 break-inside-avoid' : 'p-6'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-serif text-base text-anthracite mb-1">
            {t.rich('trendTitle', { em: (c) => <em className="italic">{c}</em> })}
          </h3>
          <p className="text-xs text-anthracite-lighter">{t('seriesInfo', { duration: formatClock(totalSec) })}</p>
        </div>
        {print ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-anthracite">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} /> {label}
          </span>
        ) : (
          <select
            value={activeMetric}
            onChange={(e) => setMetric(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-surface-border rounded-xl max-w-full"
          >
            {metrics.map((k) => <option key={k} value={k}>{labelFor(k)}</option>)}
          </select>
        )}
      </div>
      {print ? (
        <div style={{ width: chartW, height: chartH }}>{chart}</div>
      ) : (
        <ResponsiveContainer width="100%" height={chartH}>{chart}</ResponsiveContainer>
      )}
    </section>
  )
}

// ── Confronto inizio-fine ────────────────────────────────────────────────────
// direction: +1 se valori più alti sono migliori, -1 se più alti sono peggiori.
// `key` è la chiave JSONB scritta dall'app in segments[].scores / segments[].hrv:
// non rinominabile. `labelKey` punta a `scores.names` (score) o a
// `measurement.long.metrics` (hrv).
const COMPARE_ROWS: Array<{ group: 'score' | 'hrv'; key: string; labelKey: string; unit?: string; digits?: number; direction: number }> = [
  { group: 'score', key: 'stress', labelKey: 'stress', direction: -1 },
  { group: 'score', key: 'recovery', labelKey: 'recovery', direction: 1 },
  { group: 'score', key: 'balance', labelKey: 'balance', direction: 1 },
  { group: 'score', key: 'energy', labelKey: 'energy', direction: 1 },
  { group: 'score', key: 'inflammation', labelKey: 'adaptation', direction: 1 },
  { group: 'hrv', key: 'meanBpm', labelKey: 'meanBpm', unit: 'bpm', digits: 0, direction: -1 },
  { group: 'hrv', key: 'rmssd', labelKey: 'rmssd', unit: 'ms', direction: 1 },
  { group: 'hrv', key: 'sdnn', labelKey: 'sdnn', unit: 'ms', direction: 1 },
  { group: 'hrv', key: 'lfHfRatio', labelKey: 'lfHfRatio', digits: 2, direction: -1 },
]

function segVal(seg: MeasurementSegment | undefined, group: 'score' | 'hrv', key: string): number | null {
  if (!seg) return null
  const src = group === 'score' ? seg.scores : seg.hrv
  const v = src ? (src as Record<string, unknown>)[key] : null
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function StartEndComparison({ segments, print = false }: { segments: MeasurementSegment[]; print?: boolean }) {
  const locale = useLocale()
  const t = useTranslations('measurement.long')
  const tScores = useTranslations('scores.names')
  if (segments.length < 2) return null
  const sorted = segments.slice().sort((a, b) => a.start_ms - b.start_ms)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const range = (s: MeasurementSegment) => `${formatClock(s.start_ms / 1000)}–${formatClock(s.end_ms / 1000)}`

  return (
    <section className={`card ${print ? 'p-4 break-inside-avoid' : 'p-6'}`}>
      <h3 className="font-serif text-base text-anthracite mb-1">
        {t.rich('compareTitle', { em: (c) => <em className="italic">{c}</em> })}
      </h3>
      <p className="text-xs text-anthracite-lighter mb-4">{t('compareSubtitle', { first: range(first), last: range(last) })}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-anthracite-lighter border-b border-surface-border">
              <th className="py-2 pr-4 font-medium">{t('colParameter')}</th>
              <th className="py-2 px-4 font-medium text-right">{t('colStart')}</th>
              <th className="py-2 px-4 font-medium text-right">{t('colEnd')}</th>
              <th className="py-2 pl-4 font-medium text-right">{t('colChange')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {COMPARE_ROWS.map((r) => {
              const a = segVal(first, r.group, r.key)
              const b = segVal(last, r.group, r.key)
              if (a == null && b == null) return null
              const delta = a != null && b != null ? b - a : null
              const improved = delta != null && delta !== 0 ? delta * r.direction > 0 : null
              const label = r.group === 'score' ? tScores(r.labelKey) : t(`metrics.${r.labelKey}`)
              return (
                <tr key={`${r.group}-${r.key}`}>
                  <td className="py-2 pr-4 text-anthracite-lighter">{label}</td>
                  <td className="py-2 px-4 text-right font-medium text-anthracite tabular-nums">
                    {num(a, r.digits ?? 1, locale)}{r.unit ? <span className="text-[10px] text-anthracite-lighter ml-1">{r.unit}</span> : null}
                  </td>
                  <td className="py-2 px-4 text-right font-medium text-anthracite tabular-nums">
                    {num(b, r.digits ?? 1, locale)}{r.unit ? <span className="text-[10px] text-anthracite-lighter ml-1">{r.unit}</span> : null}
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums">
                    {delta == null ? <span className="text-anthracite-lighter">—</span> : (
                      <span className={improved == null ? 'text-anthracite-lighter' : improved ? 'text-emerald-700' : 'text-red-700'}>
                        {signed(delta, r.digits ?? 1, locale)}
                        {improved != null && <span className="ml-1">{improved ? '↑' : '↓'}</span>}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-anthracite-lighter mt-3">{t('arrowsNote')}</p>
    </section>
  )
}

// ── Analisi segmentata ───────────────────────────────────────────────────────
function SegmentAnalysis({ segments, print = false, width = 680 }: { segments: MeasurementSegment[]; print?: boolean; width?: number }) {
  const locale = useLocale()
  const t = useTranslations('measurement.long')
  const tScores = useTranslations('scores.names')
  const tAxes = useTranslations('charts.axes')
  if (segments.length < 2) return null
  const sorted = segments.slice().sort((a, b) => a.start_ms - b.start_ms)
  const chartW = width - 32
  const chartH = print ? 220 : 280

  const data = sorted.map((s, i) => ({
    seg: i + 1,
    tMid: (s.start_ms + s.end_ms) / 2000,
    stress: s.scores?.stress ?? null,
    recovery: s.scores?.recovery ?? null,
    balance: s.scores?.balance ?? null,
    energy: s.scores?.energy ?? null,
    rmssd: segVal(s, 'hrv', 'rmssd'),
    meanBpm: segVal(s, 'hrv', 'meanBpm'),
  }))

  const scoreLines = [
    { key: 'stress', label: tScores('stress'), color: '#EF4444' },
    { key: 'recovery', label: tScores('recovery'), color: '#2F8F6B' },
    { key: 'balance', label: tScores('balance'), color: '#3B82F6' },
    { key: 'energy', label: tScores('energy'), color: '#F59E0B' },
  ]

  const chart = (
    <LineChart data={data} {...(print ? { width: chartW, height: chartH } : {})} margin={{ top: 8, right: 20, bottom: 32, left: 8 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
      <XAxis
        dataKey="tMid"
        type="number"
        domain={['dataMin', 'dataMax']}
        stroke="#6B7280"
        fontSize={10}
        tickFormatter={(v) => formatClock(Number(v))}
        label={{ value: tAxes('timeClock'), position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6B7280' }}
      />
      <YAxis domain={[0, 100]} stroke="#6B7280" fontSize={10} label={{ value: tAxes('score'), angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }} />
      {!print && (
        <Tooltip
          contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }}
          labelFormatter={(v) => `t = ${formatClock(Number(v))}`}
          formatter={(v) => num(v, 0, locale)}
        />
      )}
      {scoreLines.map((l) => (
        <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color} strokeWidth={1.8} dot={{ r: 2 }} isAnimationActive={false} connectNulls />
      ))}
    </LineChart>
  )

  return (
    <section className={`card ${print ? 'p-4' : 'p-6'}`}>
      {/* In stampa titolo, sottotitolo e grafico restano insieme sulla stessa pagina. */}
      <div className={print ? 'break-inside-avoid' : ''}>
      <h3 className="font-serif text-base text-anthracite mb-1">
        {t.rich('segmentsTitle', { em: (c) => <em className="italic">{c}</em> })}
      </h3>
      <p className="text-xs text-anthracite-lighter mb-4">{t('segmentsSubtitle', { count: sorted.length })}</p>
      {print ? (
        <div style={{ width: chartW, height: chartH }}>{chart}</div>
      ) : (
        <ResponsiveContainer width="100%" height={chartH}>{chart}</ResponsiveContainer>
      )}
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        {scoreLines.map((l) => (
          <span key={l.key} className="inline-flex items-center gap-1.5 text-xs text-anthracite-lighter">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} /> {l.label}
          </span>
        ))}
      </div>

      {/* Tabella per-segmento */}
      <div className="overflow-x-auto mt-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-anthracite-lighter border-b border-surface-border">
              <th className="py-2 pr-3 font-medium">{t('colSegment')}</th>
              <th className="py-2 px-3 font-medium">{t('colInterval')}</th>
              <th className="py-2 px-3 font-medium text-right">{tScores('stress')}</th>
              <th className="py-2 px-3 font-medium text-right">{tScores('recovery')}</th>
              <th className="py-2 px-3 font-medium text-right">{tScores('balance')}</th>
              <th className="py-2 px-3 font-medium text-right">{tScores('energy')}</th>
              <th className="py-2 px-3 font-medium text-right">RMSSD</th>
              <th className="py-2 pl-3 font-medium text-right">{t('colHr')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {sorted.map((s, i) => (
              <tr key={s.index ?? i}>
                <td className="py-2 pr-3 text-anthracite-lighter">{i + 1}</td>
                <td className="py-2 px-3 text-anthracite-lighter tabular-nums whitespace-nowrap">{formatClock(s.start_ms / 1000)}–{formatClock(s.end_ms / 1000)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-anthracite">{num(s.scores?.stress, 0, locale)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-anthracite">{num(s.scores?.recovery, 0, locale)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-anthracite">{num(s.scores?.balance, 0, locale)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-anthracite">{num(s.scores?.energy, 0, locale)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-anthracite">{num(segVal(s, 'hrv', 'rmssd'), 0, locale)}</td>
                <td className="py-2 pl-3 text-right tabular-nums text-anthracite">{num(segVal(s, 'hrv', 'meanBpm'), 0, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
