'use client'

import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Customized,
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
import { num } from '@/lib/format'

// ============================================================================
// POINCARÉ — scatter quadrato 1:1 con linea identità, centroide ed ellisse SD1/SD2
// ============================================================================

export function PoincareScatter({ rr, sd1, sd2 }: { rr: number[] | null; sd1: number | null; sd2: number | null }) {
  if (!rr || rr.length < 2) {
    return <Placeholder text="Dati RR non disponibili" />
  }
  const allPoints = rr.slice(0, -1).map((v, i) => ({ x: v, y: rr[i + 1] }))
  const sample = allPoints.length > 1500
    ? allPoints.filter((_, i) => i % Math.ceil(allPoints.length / 1500) === 0)
    : allPoints

  const meanRr = rr.reduce((a, b) => a + b, 0) / rr.length

  const xs = sample.map((p) => p.x)
  const ys = sample.map((p) => p.y)
  const dataMin = Math.min(...xs, ...ys)
  const dataMax = Math.max(...xs, ...ys)
  // simmetrico rispetto al centroide con padding 20% del range
  const halfRange = Math.max(dataMax - meanRr, meanRr - dataMin)
  const padded = halfRange * 1.2
  const min = Math.floor(meanRr - padded)
  const max = Math.ceil(meanRr + padded)

  return (
    <div>
      <div className="aspect-square w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 16, bottom: 32, left: 8 }}>
            <CartesianGrid stroke="#E2E6EA" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[min, max]}
              stroke="#6B7280"
              fontSize={10}
              tickFormatter={(v) => v.toFixed(0)}
              label={{ value: 'RR(n) ms', position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6B7280' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[min, max]}
              stroke="#6B7280"
              fontSize={10}
              tickFormatter={(v) => v.toFixed(0)}
              label={{ value: 'RR(n+1) ms', angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }}
            />
            <ZAxis range={[14, 14]} />
            <ReferenceLine
              segment={[{ x: min, y: min }, { x: max, y: max }]}
              stroke="#94A3B8"
              strokeDasharray="4 4"
              ifOverflow="hidden"
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null
                const p = payload[0].payload as { x: number; y: number }
                const diff = p.y - p.x
                return (
                  <div className="bg-white border border-surface-border rounded-xl shadow-elevated px-3 py-2 text-[11px]">
                    <div className="text-anthracite">RR(n): <b>{p.x.toFixed(0)}</b> ms</div>
                    <div className="text-anthracite">RR(n+1): <b>{p.y.toFixed(0)}</b> ms</div>
                    <div className="text-anthracite-lighter">differenza: <b>{diff > 0 ? '+' : ''}{diff.toFixed(0)}</b> ms</div>
                  </div>
                )
              }}
            />
            <Scatter data={sample} fill="#4FA39A" fillOpacity={0.45} />
            <Customized component={(props: unknown) => (
              <PoincareOverlay
                chart={props as ChartInternals}
                meanRr={meanRr}
                sd1={sd1}
                sd2={sd2}
              />
            )} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-around mt-3 text-xs text-anthracite-lighter">
        <div>SD1: <b className="text-anthracite">{num(sd1)}</b> ms</div>
        <div>SD2: <b className="text-anthracite">{num(sd2)}</b> ms</div>
      </div>
    </div>
  )
}

type AxisScale = { scale: (v: number) => number }
type ChartInternals = {
  xAxisMap?: Record<string, AxisScale>
  yAxisMap?: Record<string, AxisScale>
}

function PoincareOverlay({ chart, meanRr, sd1, sd2 }: { chart: ChartInternals; meanRr: number; sd1: number | null; sd2: number | null }) {
  const xMap = chart.xAxisMap
  const yMap = chart.yAxisMap
  if (!xMap || !yMap) return null
  const xAxis = Object.values(xMap)[0]
  const yAxis = Object.values(yMap)[0]
  if (!xAxis || !yAxis) return null

  const cx = xAxis.scale(meanRr)
  const cy = yAxis.scale(meanRr)

  // pixel per ms (assume axes hanno stesso dominio quindi stessa scala)
  const pxPerMsX = Math.abs(xAxis.scale(meanRr + 50) - xAxis.scale(meanRr)) / 50
  const pxPerMsY = Math.abs(yAxis.scale(meanRr + 50) - yAxis.scale(meanRr)) / 50

  if (!isFinite(cx) || !isFinite(cy) || !pxPerMsX || !pxPerMsY) return null

  const rx = (sd2 ?? 0) * pxPerMsX // asse lungo (lungo termine, lungo la diagonale)
  const ry = (sd1 ?? 0) * pxPerMsY // asse breve (breve termine, perpendicolare alla diagonale)

  // In SVG y cresce verso il basso: ruotando di -45° l'ellisse si allinea
  // alla diagonale y=x visiva (basso-sx → alto-dx).
  const rotation = -45

  const sd1Pos = sd1 ?? 0
  const sd2Pos = sd2 ?? 0

  return (
    <g pointerEvents="none">
      {/* ellisse SD1/SD2 */}
      {sd1Pos > 0 && sd2Pos > 0 && (
        <g transform={`translate(${cx},${cy}) rotate(${rotation})`}>
          <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="#4FA39A" fillOpacity={0.12} stroke="#4FA39A" strokeWidth={1.5} />
          {/* asse maggiore SD2 lungo orizzontale (post-rotazione = diagonale) */}
          <line x1={-rx} y1={0} x2={rx} y2={0} stroke="#4FA39A" strokeWidth={1} strokeDasharray="3 3" />
          {/* asse minore SD1 verticale (post-rotazione = perpendicolare) */}
          <line x1={0} y1={-ry} x2={0} y2={ry} stroke="#4FA39A" strokeWidth={1} strokeDasharray="3 3" />
          {/* label SD2 al tip dell'asse lungo */}
          <g transform={`translate(${rx + 6},0) rotate(${-rotation})`}>
            <text x={0} y={4} fontSize={10} fill="#1F2A37" fontWeight={600}>SD2 {sd2Pos.toFixed(0)} ms</text>
          </g>
          {/* label SD1 al tip dell'asse breve */}
          <g transform={`translate(0,${-ry - 6}) rotate(${-rotation})`}>
            <text x={4} y={0} fontSize={10} fill="#1F2A37" fontWeight={600}>SD1 {sd1Pos.toFixed(0)} ms</text>
          </g>
        </g>
      )}
      {/* centroide come croce */}
      <g transform={`translate(${cx},${cy})`}>
        <line x1={-7} y1={0} x2={7} y2={0} stroke="#1F2A37" strokeWidth={2} />
        <line x1={0} y1={-7} x2={0} y2={7} stroke="#1F2A37" strokeWidth={2} />
      </g>
    </g>
  )
}

// ============================================================================
// RITMOGRAMMA — full-width con Brush per zoom temporale + linea media
// ============================================================================

export function Rhythmogram({ rr }: { rr: number[] | null }) {
  if (!rr || rr.length === 0) {
    return <Placeholder text="Dati RR non disponibili" />
  }
  let acc = 0
  const data = rr.map((v) => {
    acc += v
    return { t: +(acc / 1000).toFixed(2), rr: v }
  })
  const sample = data.length > 1500 ? data.filter((_, i) => i % Math.ceil(data.length / 1500) === 0) : data
  const meanRr = rr.reduce((a, b) => a + b, 0) / rr.length
  const totalSec = data[data.length - 1]?.t ?? 0
  const tickStep = totalSec > 300 ? 60 : totalSec > 120 ? 30 : 15

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={sample} margin={{ top: 8, right: 20, bottom: 32, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
        <XAxis
          dataKey="t"
          stroke="#6B7280"
          fontSize={10}
          type="number"
          domain={[0, 'dataMax']}
          ticks={Array.from({ length: Math.floor(totalSec / tickStep) + 1 }, (_, i) => i * tickStep)}
          tickFormatter={(v) => `${Math.round(v)}s`}
          label={{ value: 'Tempo (s)', position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6B7280' }}
        />
        <YAxis
          stroke="#6B7280"
          fontSize={10}
          domain={['auto', 'auto']}
          label={{ value: 'Intervallo RR (ms)', angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }}
        />
        <ReferenceLine y={meanRr} stroke="#9CA3AF" strokeDasharray="4 4" label={{ value: `media ${meanRr.toFixed(0)} ms`, position: 'right', fontSize: 10, fill: '#6B7280' }} />
        <Tooltip
          contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }}
          labelFormatter={(v) => `t = ${Number(v).toFixed(1)}s`}
          formatter={(v) => [`${Number(v).toFixed(0)} ms`, 'RR']}
        />
        <Line type="monotone" dataKey="rr" stroke="#4FA39A" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Brush dataKey="t" height={26} stroke="#4FA39A" travellerWidth={8} tickFormatter={(v) => `${Math.round(Number(v))}s`} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ============================================================================
// PSD — AreaChart con bande VLF/LF/HF colorate, spettro sintetico gaussiano
// ============================================================================

const VLF_CENTER = 0.02, VLF_SIGMA = 0.012
const LF_CENTER = 0.10, LF_SIGMA = 0.035
const HF_CENTER = 0.27, HF_SIGMA = 0.08

function gauss(f: number, mu: number, sigma: number) {
  return Math.exp(-((f - mu) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI))
}

export function PsdPlaceholder({ vlf, lf, hf, lfHfRatio }: { vlf: number | null; lf: number | null; hf: number | null; lfHfRatio?: number | null }) {
  if (vlf == null && lf == null && hf == null) return <Placeholder text="Dati spettro non disponibili" />

  const fMax = 0.4
  const step = 0.004
  const data: { f: number; psd: number }[] = []
  for (let f = 0; f <= fMax + step / 2; f += step) {
    const psd =
      (vlf ?? 0) * gauss(f, VLF_CENTER, VLF_SIGMA) +
      (lf ?? 0) * gauss(f, LF_CENTER, LF_SIGMA) +
      (hf ?? 0) * gauss(f, HF_CENTER, HF_SIGMA)
    data.push({ f: +f.toFixed(4), psd })
  }
  const maxPsd = Math.max(...data.map((d) => d.psd), 1)

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 24, right: 16, bottom: 28, left: 8 }}>
          <defs>
            <linearGradient id="psd-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2F343A" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#2F343A" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
          <XAxis
            dataKey="f"
            type="number"
            domain={[0, fMax]}
            ticks={[0, 0.04, 0.1, 0.15, 0.2, 0.3, 0.4]}
            stroke="#6B7280"
            fontSize={10}
            tickFormatter={(v) => Number(v).toFixed(2)}
            label={{ value: 'Frequenza (Hz)', position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6B7280' }}
          />
          <YAxis
            stroke="#6B7280"
            fontSize={10}
            domain={[0, Math.ceil(maxPsd * 1.15)]}
            tickFormatter={(v) => Number(v).toFixed(0)}
            label={{ value: 'PSD (ms²/Hz)', angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }}
          />
          <ReferenceArea x1={0} x2={0.04} fill="#DC2626" fillOpacity={0.18} label={{ value: 'VLF', position: 'insideTop', fill: '#991B1B', fontSize: 11, fontWeight: 600 }} />
          <ReferenceArea x1={0.04} x2={0.15} fill="#F59E0B" fillOpacity={0.18} label={{ value: 'LF', position: 'insideTop', fill: '#92400E', fontSize: 11, fontWeight: 600 }} />
          <ReferenceArea x1={0.15} x2={0.4} fill="#4FA39A" fillOpacity={0.18} label={{ value: 'HF', position: 'insideTop', fill: '#115E59', fontSize: 11, fontWeight: 600 }} />
          <Tooltip
            contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }}
            labelFormatter={(v) => `f = ${Number(v).toFixed(3)} Hz`}
            formatter={(v) => [`${Number(v).toFixed(1)} ms²/Hz`, 'PSD']}
          />
          <Area type="monotone" dataKey="psd" stroke="#2F343A" strokeWidth={1.8} fill="url(#psd-fill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-4 gap-2 mt-3">
        <PowerCell label="VLF" value={vlf} color="#DC2626" unit="ms²" />
        <PowerCell label="LF" value={lf} color="#F59E0B" unit="ms²" />
        <PowerCell label="HF" value={hf} color="#4FA39A" unit="ms²" />
        <PowerCell label="LF/HF" value={lfHfRatio ?? (lf != null && hf ? lf / hf : null)} color="#2F343A" />
      </div>
    </div>
  )
}

function PowerCell({ label, value, color, unit }: { label: string; value: number | null; color: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-anthracite-lighter">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </div>
      <div className="text-sm font-semibold text-anthracite mt-0.5">
        {value == null ? '—' : value.toFixed(1)}{unit ? <span className="text-[10px] text-anthracite-lighter font-normal ml-1">{unit}</span> : null}
      </div>
    </div>
  )
}

function Placeholder({ text }: { text: string }) {
  return <div className="h-[260px] flex items-center justify-center text-sm text-anthracite-lighter bg-surface rounded-xl">{text}</div>
}
