'use client'

import {
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { DFA_ZONES, formatClock, zoneForAlpha1 } from '@/lib/sport-format'
import type { DfaWindow } from '@/lib/sport-data'
import type { ThresholdAnalysis, ThresholdTestRecord } from '@/lib/threshold-types'
import { formatIstante } from '@/lib/format'

const TOOLTIP_STYLE = { background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 } as const
const Z3 = DFA_ZONES[2].color // giallo, soglia VT1 (0,75)
const Z4 = DFA_ZONES[3].color // arancio, soglia VT2 (0,50)

function Placeholder({ text, height = 260 }: { text: string; height?: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-anthracite-lighter bg-surface rounded-xl" style={{ height }}>
      {text}
    </div>
  )
}

// ============================================================================
// SCATTER alpha1 contro FC: punti colorati per zona, retta di regressione,
// linee orizzontali a 0,75 e 0,50, verticali su VT1 e VT2, R² in legenda.
// ============================================================================

export function ThresholdScatterChart({ windows, record }: { windows: DfaWindow[]; record: ThresholdTestRecord }) {
  const a: ThresholdAnalysis | null = record.analysis
  const used = new Set(a?.used_windows ?? [])
  const pts = windows
    .filter((w) => w.alpha1 != null && w.hr_mean != null)
    .filter((w) => w.window_start_ms / 1000 >= record.config.warmup_s && w.window_start_ms / 1000 <= record.stop_at_s)
    .map((w) => ({ hr: w.hr_mean as number, alpha1: w.alpha1 as number, inTract: used.has(w.window_start_ms / 1000) }))
  if (pts.length < 3) return <Placeholder text="Dati alpha1 non disponibili per lo scatter" />

  const hrs = pts.map((p) => p.hr)
  const xMin = Math.floor(Math.min(...hrs) - 5)
  const xMax = Math.ceil(Math.max(...hrs) + 5)
  const yMax = Math.max(1.5, ...pts.map((p) => p.alpha1 + 0.15))
  const reg = a?.regression ?? null
  const line = reg
    ? [
        { hr: reg.hr_min - 3, alpha1: clamp(reg.intercept + reg.slope * (reg.hr_min - 3), 0, yMax) },
        { hr: reg.hr_max + 3, alpha1: clamp(reg.intercept + reg.slope * (reg.hr_max + 3), 0, yMax) },
      ]
    : []

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
          <XAxis
            type="number"
            dataKey="hr"
            domain={[xMin, xMax]}
            stroke="#6B7280"
            fontSize={10}
            tickFormatter={(v) => `${Math.round(Number(v))}`}
            label={{ value: 'FC (bpm)', position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6B7280' }}
          />
          <YAxis
            type="number"
            dataKey="alpha1"
            domain={[0, yMax]}
            stroke="#6B7280"
            fontSize={10}
            width={34}
            tickFormatter={(v) => Number(v).toFixed(2)}
            label={{ value: 'DFA α1', angle: -90, position: 'insideLeft', offset: 18, fontSize: 11, fill: '#6B7280' }}
          />
          <ZAxis range={[24, 24]} />
          <ReferenceLine y={0.75} stroke={Z3} strokeDasharray="5 4" label={{ value: '0,75 · VT1', position: 'insideTopRight', fontSize: 10, fill: Z3 }} />
          <ReferenceLine y={0.5} stroke={Z4} strokeDasharray="5 4" label={{ value: '0,50 · VT2', position: 'insideTopRight', fontSize: 10, fill: Z4 }} />
          {a?.vt1 && <ReferenceLine x={a.vt1.hr} stroke={Z3} strokeWidth={1.5} label={{ value: `VT1 ${Math.round(a.vt1.hr)}`, position: 'top', fontSize: 10, fill: Z3, fontWeight: 700 }} />}
          {a?.vt2 && <ReferenceLine x={a.vt2.hr} stroke={Z4} strokeWidth={1.5} label={{ value: `VT2 ${Math.round(a.vt2.hr)}`, position: 'top', fontSize: 10, fill: Z4, fontWeight: 700 }} />}
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={TOOLTIP_STYLE}
            formatter={(v, name) => (name === 'alpha1' ? [Number(v).toFixed(2), 'α1'] : [`${Math.round(Number(v))} bpm`, 'FC'])}
          />
          <Scatter data={pts} isAnimationActive={false}>
            {pts.map((p, i) => (
              <Cell key={i} fill={zoneForAlpha1(p.alpha1)?.color ?? '#6B7280'} fillOpacity={p.inTract ? 0.9 : 0.35} />
            ))}
          </Scatter>
          {line.length === 2 && (
            <Scatter data={line} line={{ stroke: '#2F343A', strokeWidth: 2 }} shape={() => <g />} isAnimationActive={false} />
          )}
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-anthracite-lighter mt-1">
        {reg && <span><b className="text-anthracite">R² {reg.r2.toFixed(2)}</b> · n {reg.n}</span>}
        <span className="inline-flex items-center gap-1"><span className="w-3 border-t-2 border-dashed" style={{ borderColor: Z3 }} /> 0,75 · VT1</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 border-t-2 border-dashed" style={{ borderColor: Z4 }} /> 0,50 · VT2</span>
        <span>punti pieni: usati dalla retta</span>
      </div>
    </div>
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// ============================================================================
// FC e alpha1 nel tempo con le bande degli step (e del recupero)
// ============================================================================

export function ThresholdTimeChart({ windows, record }: { windows: DfaWindow[]; record: ThresholdTestRecord }) {
  const data = windows
    .filter((w) => w.hr_mean != null || w.alpha1 != null)
    .map((w) => ({ t: w.window_start_ms / 1000, hr: w.hr_mean ?? null, alpha1: w.alpha1 ?? null }))
  if (data.length < 2) return <Placeholder text="Dati non disponibili per il grafico temporale" />
  const xMax = Math.max(data[data.length - 1].t, record.stop_at_s + (record.recovery?.duration_s ?? 0))

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 28, left: 0 }}>
          {record.steps.map((s) => (
            <ReferenceArea
              key={s.index}
              x1={s.start_s}
              x2={s.end_s}
              yAxisId="hr"
              fill={s.index === 0 ? '#3D5A80' : '#4FA39A'}
              fillOpacity={s.index === 0 ? 0.08 : s.index % 2 === 0 ? 0.06 : 0.12}
              ifOverflow="hidden"
              label={s.index > 0 ? { value: `${s.index}`, position: 'insideTop', fontSize: 9, fill: '#2F343A' } : undefined}
            />
          ))}
          {record.recovery && (
            <ReferenceArea x1={record.recovery.start_s} x2={record.recovery.start_s + record.recovery.duration_s} yAxisId="hr" fill="#3D5A80" fillOpacity={0.1} ifOverflow="hidden" label={{ value: 'recupero', position: 'insideTop', fontSize: 9, fill: '#3D5A80' }} />
          )}
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[0, xMax]}
            stroke="#6B7280"
            fontSize={10}
            tickFormatter={(v) => formatClock(Number(v) * 1000)}
            label={{ value: 'Tempo (mm:ss)', position: 'insideBottom', offset: -6, fontSize: 11, fill: '#6B7280' }}
          />
          <YAxis yAxisId="hr" stroke="#EF4444" fontSize={10} width={34} domain={['auto', 'auto']} label={{ value: 'bpm', angle: -90, position: 'insideLeft', offset: 18, fontSize: 11, fill: '#EF4444' }} />
          <YAxis yAxisId="a1" orientation="right" stroke="#2E746C" fontSize={10} width={34} domain={[0, 1.5]} ticks={[0, 0.3, 0.5, 0.75, 1.0, 1.5]} label={{ value: 'α1', angle: 90, position: 'insideRight', offset: 18, fontSize: 11, fill: '#2E746C' }} />
          <ReferenceLine yAxisId="a1" y={0.75} stroke={Z3} strokeDasharray="4 4" />
          <ReferenceLine yAxisId="a1" y={0.5} stroke={Z4} strokeDasharray="4 4" />
          <ReferenceLine yAxisId="hr" x={record.stop_at_s} stroke="#C44E4E" strokeDasharray="4 3" label={{ value: 'stop', position: 'top', fontSize: 9, fill: '#C44E4E' }} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(v) => `t = ${formatClock(Number(v) * 1000)}`}
            formatter={(v, name) => (name === 'alpha1' ? [Number(v).toFixed(2), 'α1'] : [`${Math.round(Number(v))} bpm`, 'FC'])}
          />
          <Legend verticalAlign="top" height={20} iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <Line yAxisId="hr" type="monotone" dataKey="hr" name="FC" stroke="#EF4444" strokeWidth={1.6} dot={false} isAnimationActive={false} connectNulls />
          <Line yAxisId="a1" type="monotone" dataKey="alpha1" name="alpha1" stroke="#2E746C" strokeWidth={1.6} dot={false} isAnimationActive={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ============================================================================
// Andamento di VT1 e VT2 nel tempo (uno o due assi: bpm e intensità)
// ============================================================================

export function ThresholdTrendChart({
  points,
  unit,
}: {
  points: Array<{ date: string; vt1: number | null; vt2: number | null }>
  unit: string
}) {
  const valid = points.filter((p) => p.vt1 != null || p.vt2 != null)
  if (valid.length < 2) return <Placeholder text="Servono almeno due test per un andamento" height={160} />
  const data = valid.map((p) => ({ ...p, label: formatIstante(p.date, 'dd/MM/yy') }))
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
        <XAxis dataKey="label" stroke="#6B7280" fontSize={10} />
        <YAxis stroke="#6B7280" fontSize={10} width={40} domain={['auto', 'auto']} label={{ value: unit, angle: -90, position: 'insideLeft', offset: 18, fontSize: 11, fill: '#6B7280' }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="vt1" name="VT1" stroke={Z3} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} connectNulls />
        <Line type="monotone" dataKey="vt2" name="VT2" stroke={Z4} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}
