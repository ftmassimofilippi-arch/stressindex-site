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
import { num } from '@/lib/format'
import { formatClock } from '@/lib/measurement-type'
import type { MeasurementAnalytics, MeasurementSegment, RollingSeriesPoint } from '@/lib/types'

// Vista per le misurazioni lunghe: andamento continuo navigabile (Brush),
// analisi segmentata e confronto inizio-fine.

// Metadati delle metriche della serie rolling (chiavi camelCase come nel JSONB).
const ROLLING_META: Record<string, { label: string; unit?: string; color: string; digits?: number }> = {
  rmssd: { label: 'RMSSD', unit: 'ms', color: '#4FA39A' },
  sdnn: { label: 'SDNN', unit: 'ms', color: '#3B82F6' },
  meanBpm: { label: 'Frequenza cardiaca', unit: 'bpm', color: '#EF4444', digits: 0 },
  stressIndex: { label: 'Stress Index', color: '#F59E0B', digits: 1 },
  dfaAlpha1: { label: 'DFA α1', color: '#8B5CF6', digits: 2 },
  lfHfRatio: { label: 'LF/HF', color: '#6366F1', digits: 2 },
  hfPower: { label: 'HF', unit: 'ms²', color: '#0EA5E9' },
}

function metaFor(k: string) {
  return ROLLING_META[k] ?? { label: k, color: '#6B7280' }
}

export function LongMeasurementView({ measurement }: { measurement: MeasurementAnalytics }) {
  const rolling = Array.isArray(measurement.rolling_series) ? measurement.rolling_series : []
  const segments = Array.isArray(measurement.segments) ? measurement.segments : []

  return (
    <div className="space-y-6">
      <RollingChart rolling={rolling} />
      <StartEndComparison segments={segments} />
      <SegmentAnalysis segments={segments} />
    </div>
  )
}

// ── Andamento continuo con Brush ─────────────────────────────────────────────
function RollingChart({ rolling }: { rolling: RollingSeriesPoint[] }) {
  const metrics = useMemo(() => {
    const present = new Set<string>()
    for (const p of rolling) present.add(p.k)
    // ordine preferito + eventuali extra
    const ordered = Object.keys(ROLLING_META).filter((k) => present.has(k))
    const extra = Array.from(present).filter((k) => !ROLLING_META[k])
    return [...ordered, ...extra]
  }, [rolling])

  const [metric, setMetric] = useState<string>('')
  const activeMetric = metric && metrics.includes(metric) ? metric : metrics[0]

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
        <h3 className="font-serif text-base text-anthracite mb-1">Andamento nel tempo</h3>
        <div className="h-[240px] flex items-center justify-center text-sm text-anthracite-lighter bg-surface rounded-xl">
          Serie temporale continua non disponibile per questa misurazione
        </div>
      </section>
    )
  }

  const meta = metaFor(activeMetric)
  const totalSec = data.length ? data[data.length - 1].t : 0
  const tickStep = totalSec > 3600 ? 600 : totalSec > 1200 ? 300 : totalSec > 300 ? 60 : 30

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-serif text-base text-anthracite mb-1">Andamento nel <em className="italic">tempo</em></h3>
          <p className="text-xs text-anthracite-lighter">
            Serie continua · trascina il selettore inferiore per zoom / scroll temporale · durata totale {formatClock(totalSec)}
          </p>
        </div>
        <select
          value={activeMetric}
          onChange={(e) => setMetric(e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-surface-border rounded-xl"
        >
          {metrics.map((k) => <option key={k} value={k}>{metaFor(k).label}</option>)}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 8, right: 20, bottom: 32, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
          <XAxis
            dataKey="t"
            type="number"
            domain={[0, 'dataMax']}
            stroke="#6B7280"
            fontSize={10}
            ticks={Array.from({ length: Math.floor(totalSec / tickStep) + 1 }, (_, i) => i * tickStep)}
            tickFormatter={(v) => formatClock(Number(v))}
            label={{ value: 'Tempo (mm:ss)', position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6B7280' }}
          />
          <YAxis
            stroke="#6B7280"
            fontSize={10}
            domain={['auto', 'auto']}
            label={{ value: meta.unit ? `${meta.label} (${meta.unit})` : meta.label, angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }}
          />
          <Tooltip
            contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }}
            labelFormatter={(v) => `t = ${formatClock(Number(v))}`}
            formatter={(v) => [`${Number(v).toFixed(meta.digits ?? 1)}${meta.unit ? ' ' + meta.unit : ''}`, meta.label]}
          />
          <Line type="monotone" dataKey="v" stroke={meta.color} strokeWidth={1.6} dot={false} isAnimationActive={false} />
          <Brush dataKey="t" height={26} stroke={meta.color} travellerWidth={8} tickFormatter={(v) => formatClock(Number(v))} />
        </LineChart>
      </ResponsiveContainer>
    </section>
  )
}

// ── Confronto inizio-fine ────────────────────────────────────────────────────
// direction: +1 se valori più alti sono migliori, -1 se più alti sono peggiori.
const COMPARE_ROWS: Array<{ group: 'score' | 'hrv'; key: string; label: string; unit?: string; digits?: number; direction: number }> = [
  { group: 'score', key: 'stress', label: 'Stress', direction: -1 },
  { group: 'score', key: 'recovery', label: 'Recupero', direction: 1 },
  { group: 'score', key: 'balance', label: 'Equilibrio', direction: 1 },
  { group: 'score', key: 'energy', label: 'Energia', direction: 1 },
  // `key` è la chiave JSONB scritta dall'app in segments[].scores: non rinominabile.
  { group: 'score', key: 'inflammation', label: 'Adattamento', direction: 1 },
  { group: 'hrv', key: 'meanBpm', label: 'Frequenza cardiaca', unit: 'bpm', digits: 0, direction: -1 },
  { group: 'hrv', key: 'rmssd', label: 'RMSSD', unit: 'ms', direction: 1 },
  { group: 'hrv', key: 'sdnn', label: 'SDNN', unit: 'ms', direction: 1 },
  { group: 'hrv', key: 'lfHfRatio', label: 'LF/HF', digits: 2, direction: -1 },
]

function segVal(seg: MeasurementSegment | undefined, group: 'score' | 'hrv', key: string): number | null {
  if (!seg) return null
  const src = group === 'score' ? seg.scores : seg.hrv
  const v = src ? (src as Record<string, unknown>)[key] : null
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function StartEndComparison({ segments }: { segments: MeasurementSegment[] }) {
  if (segments.length < 2) return null
  const sorted = segments.slice().sort((a, b) => a.start_ms - b.start_ms)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  return (
    <section className="card p-6">
      <h3 className="font-serif text-base text-anthracite mb-1">Confronto <em className="italic">inizio - fine</em></h3>
      <p className="text-xs text-anthracite-lighter mb-4">
        Primo segmento ({formatClock(first.start_ms / 1000)}–{formatClock(first.end_ms / 1000)}) vs ultimo ({formatClock(last.start_ms / 1000)}–{formatClock(last.end_ms / 1000)})
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-anthracite-lighter border-b border-surface-border">
              <th className="py-2 pr-4 font-medium">Parametro</th>
              <th className="py-2 px-4 font-medium text-right">Inizio</th>
              <th className="py-2 px-4 font-medium text-right">Fine</th>
              <th className="py-2 pl-4 font-medium text-right">Variazione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {COMPARE_ROWS.map((r) => {
              const a = segVal(first, r.group, r.key)
              const b = segVal(last, r.group, r.key)
              if (a == null && b == null) return null
              const delta = a != null && b != null ? b - a : null
              const improved = delta != null && delta !== 0 ? delta * r.direction > 0 : null
              return (
                <tr key={`${r.group}-${r.key}`}>
                  <td className="py-2 pr-4 text-anthracite-lighter">{r.label}</td>
                  <td className="py-2 px-4 text-right font-medium text-anthracite tabular-nums">
                    {num(a, r.digits ?? 1)}{r.unit ? <span className="text-[10px] text-anthracite-lighter ml-1">{r.unit}</span> : null}
                  </td>
                  <td className="py-2 px-4 text-right font-medium text-anthracite tabular-nums">
                    {num(b, r.digits ?? 1)}{r.unit ? <span className="text-[10px] text-anthracite-lighter ml-1">{r.unit}</span> : null}
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums">
                    {delta == null ? <span className="text-anthracite-lighter">—</span> : (
                      <span className={improved == null ? 'text-anthracite-lighter' : improved ? 'text-emerald-700' : 'text-red-700'}>
                        {delta > 0 ? '+' : ''}{delta.toFixed(r.digits ?? 1)}
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
      <p className="text-[11px] text-anthracite-lighter mt-3">Le frecce indicano se la variazione rappresenta un miglioramento (verde) o un peggioramento (rosso) per quel parametro.</p>
    </section>
  )
}

// ── Analisi segmentata ───────────────────────────────────────────────────────
function SegmentAnalysis({ segments }: { segments: MeasurementSegment[] }) {
  if (segments.length < 2) return null
  const sorted = segments.slice().sort((a, b) => a.start_ms - b.start_ms)

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
    { key: 'stress', label: 'Stress', color: '#EF4444' },
    { key: 'recovery', label: 'Recupero', color: '#2F8F6B' },
    { key: 'balance', label: 'Equilibrio', color: '#3B82F6' },
    { key: 'energy', label: 'Energia', color: '#F59E0B' },
  ]

  return (
    <section className="card p-6">
      <h3 className="font-serif text-base text-anthracite mb-1">Analisi <em className="italic">segmentata</em></h3>
      <p className="text-xs text-anthracite-lighter mb-4">
        {sorted.length} segmenti · evoluzione degli score proprietari nel corso della misurazione
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 20, bottom: 32, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
          <XAxis
            dataKey="tMid"
            type="number"
            domain={['dataMin', 'dataMax']}
            stroke="#6B7280"
            fontSize={10}
            tickFormatter={(v) => formatClock(Number(v))}
            label={{ value: 'Tempo (mm:ss)', position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6B7280' }}
          />
          <YAxis domain={[0, 100]} stroke="#6B7280" fontSize={10} label={{ value: 'Score', angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }} />
          <Tooltip
            contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }}
            labelFormatter={(v) => `t = ${formatClock(Number(v))}`}
          />
          {scoreLines.map((l) => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color} strokeWidth={1.8} dot={{ r: 2 }} isAnimationActive={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
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
              <th className="py-2 pr-3 font-medium">Segm.</th>
              <th className="py-2 px-3 font-medium">Intervallo</th>
              <th className="py-2 px-3 font-medium text-right">Stress</th>
              <th className="py-2 px-3 font-medium text-right">Recupero</th>
              <th className="py-2 px-3 font-medium text-right">Equilibrio</th>
              <th className="py-2 px-3 font-medium text-right">Energia</th>
              <th className="py-2 px-3 font-medium text-right">RMSSD</th>
              <th className="py-2 pl-3 font-medium text-right">FC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {sorted.map((s, i) => (
              <tr key={s.index ?? i}>
                <td className="py-2 pr-3 text-anthracite-lighter">{i + 1}</td>
                <td className="py-2 px-3 text-anthracite-lighter tabular-nums">{formatClock(s.start_ms / 1000)}–{formatClock(s.end_ms / 1000)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-anthracite">{num(s.scores?.stress, 0)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-anthracite">{num(s.scores?.recovery, 0)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-anthracite">{num(s.scores?.balance, 0)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-anthracite">{num(s.scores?.energy, 0)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-anthracite">{num(segVal(s, 'hrv', 'rmssd'), 0)}</td>
                <td className="py-2 pl-3 text-right tabular-nums text-anthracite">{num(segVal(s, 'hrv', 'meanBpm'), 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
