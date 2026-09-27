'use client'

import { useState } from 'react'
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
import { num, toNum } from '@/lib/format'
import { ScaleToggle } from '@/components/dashboard/ScaleToggle'
import {
  PSD_BANDS,
  PSD_X_MAX,
  PSD_X_MIN,
  PSD_X_TICKS,
  psdClamp,
  psdDecades,
  psdLabel,
  psdScaleFor,
  rrScaleAdaptive,
  rrScaleFor,
} from '@/lib/chart-scales'

// I valori arrivano dal database (colonne numeriche, array e campi jsonb) e i
// tipi dichiarati non sono garantiti a runtime: si coercizzano una volta sola
// al confine dei componenti, così ogni .toFixed() interno è sicuro.
function toNumArray(values: unknown[] | null | undefined): number[] {
  if (!Array.isArray(values)) return []
  const out: number[] = []
  for (const v of values) {
    const n = toNum(v)
    if (n != null) out.push(n)
  }
  return out
}

// ============================================================================
// POINCARÉ — scatter quadrato 1:1 con linea identità, centroide ed ellisse SD1/SD2
// ============================================================================

export function PoincareScatter({ rr: rawRr, sd1: rawSd1, sd2: rawSd2 }: { rr: unknown[] | null; sd1: unknown; sd2: unknown }) {
  // Coercizione al confine del componente: da qui in giù i valori sono number
  // garantiti, quindi tutti i .toFixed() a valle sono sicuri.
  const rr = toNumArray(rawRr)
  const sd1 = toNum(rawSd1)
  const sd2 = toNum(rawSd2)
  // Scala fissa di default (stessi valori dell'app: 400–1400 ms, estesa a
  // 300–1600), così due misurazioni — o le due fasi di un ortostatico — si
  // confrontano a colpo d'occhio. "Zoom" passa alla scala adattiva.
  const [zoom, setZoom] = useState(false)
  if (rr.length < 2) {
    return <Placeholder text="Dati RR non disponibili" />
  }
  const allPoints = rr.slice(0, -1).map((v, i) => ({ x: v, y: rr[i + 1] }))
  const sample = allPoints.length > 1500
    ? allPoints.filter((_, i) => i % Math.ceil(allPoints.length / 1500) === 0)
    : allPoints

  const meanRr = rr.reduce((a, b) => a + b, 0) / rr.length

  const scale = zoom ? rrScaleAdaptive(rr) : rrScaleFor(rr)
  const min = scale.min
  const max = scale.max

  return (
    <div>
      <ScaleToggle zoom={zoom} onToggle={() => setZoom((z) => !z)} extended={scale.extended} />
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
            <Scatter data={sample} fill="#4FA39A" fillOpacity={0.4} />
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
      <PoincareLegend sd1={sd1} sd2={sd2} />
    </div>
  )
}

function PoincareLegend({ sd1, sd2 }: { sd1: number | null; sd2: number | null }) {
  const ratio = sd1 != null && sd2 != null && sd2 > 0 ? sd1 / sd2 : null
  let interp: { label: string; tone: string } | null = null
  if (ratio != null) {
    if (ratio < 0.5) interp = { label: 'Predominanza lungo termine', tone: 'text-blue-700' }
    else if (ratio > 1.0) interp = { label: 'Predominanza breve termine', tone: 'text-orange-700' }
    else interp = { label: 'Bilanciato', tone: 'text-emerald-700' }
  }
  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-surface-border bg-surface px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-anthracite-lighter">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#F97316' }} />
            SD1
          </div>
          <div className="text-sm font-semibold text-anthracite mt-0.5">
            {num(sd1)} <span className="text-[10px] text-anthracite-lighter font-normal">ms</span>
          </div>
          <div className="text-[10px] text-anthracite-lighter mt-0.5">var. breve termine</div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-anthracite-lighter">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3B82F6' }} />
            SD2
          </div>
          <div className="text-sm font-semibold text-anthracite mt-0.5">
            {num(sd2)} <span className="text-[10px] text-anthracite-lighter font-normal">ms</span>
          </div>
          <div className="text-[10px] text-anthracite-lighter mt-0.5">var. lungo termine</div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-anthracite-lighter">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#2F343A' }} />
            SD1/SD2
          </div>
          <div className="text-sm font-semibold text-anthracite mt-0.5">
            {ratio == null ? '—' : ratio.toFixed(2)}
          </div>
          {interp && <div className={`text-[10px] font-medium mt-0.5 ${interp.tone}`}>{interp.label}</div>}
        </div>
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
          <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="#4FA39A" fillOpacity={0.1} stroke="#4FA39A" strokeWidth={1.5} strokeOpacity={0.7} />
          {/* asse maggiore SD2 lungo orizzontale (post-rotazione = diagonale) — blu */}
          <line x1={-rx} y1={0} x2={rx} y2={0} stroke="#3B82F6" strokeWidth={1.5} />
          {/* asse minore SD1 verticale (post-rotazione = perpendicolare) — arancio */}
          <line x1={0} y1={-ry} x2={0} y2={ry} stroke="#F97316" strokeWidth={1.5} />
          {/* label SD2 al tip dell'asse lungo */}
          <g transform={`translate(${rx + 6},0) rotate(${-rotation})`}>
            <text x={0} y={4} fontSize={10} fill="#1D4ED8" fontWeight={700}>SD2 {sd2Pos.toFixed(0)} ms</text>
          </g>
          {/* label SD1 al tip dell'asse breve */}
          <g transform={`translate(0,${-ry - 6}) rotate(${-rotation})`}>
            <text x={4} y={0} fontSize={10} fill="#C2410C" fontWeight={700}>SD1 {sd1Pos.toFixed(0)} ms</text>
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

export function Rhythmogram({ rr: rawRr }: { rr: unknown[] | null }) {
  const rr = toNumArray(rawRr)
  // Asse Y fisso (400–1400 ms, esteso 300–1600) come nell'app; "Zoom" = adattivo.
  const [zoom, setZoom] = useState(false)
  if (rr.length === 0) {
    return <Placeholder text="Dati RR non disponibili" />
  }
  const scale = zoom ? rrScaleAdaptive(rr) : rrScaleFor(rr)
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
    <div>
    <ScaleToggle zoom={zoom} onToggle={() => setZoom((z) => !z)} extended={scale.extended} />
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
          domain={[scale.min, scale.max]}
          allowDataOverflow
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
    </div>
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

export function PsdPlaceholder({
  vlf: rawVlf,
  lf: rawLf,
  hf: rawHf,
  lfHfRatio: rawLfHfRatio,
  resonanceHz: rawResonanceHz,
}: { vlf: unknown; lf: unknown; hf: unknown; lfHfRatio?: unknown; resonanceHz?: unknown }) {
  const vlf = toNum(rawVlf)
  const lf = toNum(rawLf)
  const hf = toNum(rawHf)
  const lfHfRatio = toNum(rawLfHfRatio)
  const resonanceHz = toNum(rawResonanceHz)
  // Asse Y logaritmico fisso (10 – 1.000.000 ms²/Hz, esteso 1 – 10.000.000,
  // tick solo sulle potenze di 10) e asse X 0 – 0,5 Hz, come nell'app.
  // "Zoom" torna alla scala lineare adattiva.
  const [zoom, setZoom] = useState(false)
  if (vlf == null && lf == null && hf == null) return <Placeholder text="Dati spettro non disponibili" />

  const fMax = PSD_X_MAX
  const step = 0.004
  const raw: { f: number; psd: number }[] = []
  for (let f = PSD_X_MIN; f <= fMax + step / 2; f += step) {
    const psd =
      (vlf ?? 0) * gauss(f, VLF_CENTER, VLF_SIGMA) +
      (lf ?? 0) * gauss(f, LF_CENTER, LF_SIGMA) +
      (hf ?? 0) * gauss(f, HF_CENTER, HF_SIGMA)
    raw.push({ f: +f.toFixed(4), psd })
  }
  const maxPsd = Math.max(...raw.map((d) => d.psd), 1)
  const scale = psdScaleFor(raw.map((d) => d.psd))
  // Su asse logaritmico i valori sotto il minimo si appoggiano al bordo,
  // non spariscono: meglio una scala dichiarata che dei punti tagliati fuori.
  const data = zoom ? raw : raw.map((d) => ({ f: d.f, psd: psdClamp(d.psd, scale) }))
  const decades = psdDecades(scale)

  return (
    <div>
      <ScaleToggle zoom={zoom} onToggle={() => setZoom((z) => !z)} extended={scale.extended} />
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
            domain={[PSD_X_MIN, fMax]}
            ticks={PSD_X_TICKS}
            stroke="#6B7280"
            fontSize={10}
            tickFormatter={(v) => Number(v).toFixed(2)}
            label={{ value: 'Frequenza (Hz)', position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6B7280' }}
          />
          {zoom ? (
            <YAxis
              stroke="#6B7280"
              fontSize={10}
              domain={[0, Math.ceil(maxPsd * 1.15)]}
              tickFormatter={(v) => Number(v).toFixed(0)}
              label={{ value: 'PSD (ms²/Hz)', angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }}
            />
          ) : (
            <YAxis
              stroke="#6B7280"
              fontSize={10}
              scale="log"
              domain={[scale.min, scale.max]}
              ticks={decades}
              allowDataOverflow
              tickFormatter={(v) => psdLabel(Number(v))}
              label={{ value: 'PSD (ms²/Hz)', angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }}
            />
          )}
          <ReferenceArea x1={PSD_BANDS.vlf.from} x2={PSD_BANDS.vlf.to} fill="#DC2626" fillOpacity={0.18} label={{ value: 'VLF', position: 'insideTop', fill: '#991B1B', fontSize: 11, fontWeight: 600 }} />
          <ReferenceArea x1={PSD_BANDS.lf.from} x2={PSD_BANDS.lf.to} fill="#F59E0B" fillOpacity={0.18} label={{ value: 'LF', position: 'insideTop', fill: '#92400E', fontSize: 11, fontWeight: 600 }} />
          <ReferenceArea x1={PSD_BANDS.hf.from} x2={PSD_BANDS.hf.to} fill="#4FA39A" fillOpacity={0.18} label={{ value: 'HF', position: 'insideTop', fill: '#115E59', fontSize: 11, fontWeight: 600 }} />
          {resonanceHz != null && resonanceHz > 0 && resonanceHz <= fMax && (
            <ReferenceLine
              x={+resonanceHz.toFixed(4)}
              stroke="#8B5CF6"
              strokeWidth={2}
              label={{ value: `risonanza ${resonanceHz.toFixed(3)} Hz`, position: 'top', fill: '#6D28D9', fontSize: 10, fontWeight: 700 }}
            />
          )}
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
