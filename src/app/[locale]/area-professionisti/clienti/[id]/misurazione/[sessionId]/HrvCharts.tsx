'use client'

import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Cell,
  Customized,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  type PieLabelRenderProps,
} from 'recharts'
import { useLocale, useTranslations } from 'next-intl'
import { intlTag, num, toNum } from '@/lib/format'
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
// al confine dei componenti, così ogni formattazione interna è sicura.
function toNumArray(values: unknown[] | null | undefined): number[] {
  if (!Array.isArray(values)) return []
  const out: number[] = []
  for (const v of values) {
    const n = toNum(v)
    if (n != null) out.push(n)
  }
  return out
}

// Numero intero per i tick degli assi: nella lingua della pagina ma senza
// separatore delle migliaia (su un asse "1.400 ms" si legge male).
function useAxisInt(locale: string) {
  return useMemo(
    () => new Intl.NumberFormat(intlTag(locale), { maximumFractionDigits: 0, useGrouping: false }),
    [locale],
  )
}

// Variazione con segno esplicito ("+12", "-3,5").
function signed(v: number, digits: number, locale: string): string {
  return `${v > 0 ? '+' : ''}${num(v, digits, locale)}`
}

// Modalità stampa (PDF A4 via Chrome headless): niente ResponsiveContainer
// (il grafico riceve width/height in px), niente tooltip, brush o comandi,
// scala fissa e nessuna animazione. `width` vale solo in stampa.
type PrintProps = { print?: boolean; width?: number }

// Dimensioni di default in stampa (px a 96 dpi; l'area utile di un A4 con
// margini normali è circa 680 px).
export const PRINT_SIZES = {
  poincare: 300,
  rhythmogram: { width: 680, height: 240 },
  psd: { width: 340, height: 220 },
  psdPie: 200,
} as const

// ============================================================================
// POINCARÉ — scatter quadrato 1:1 con linea identità, centroide ed ellisse SD1/SD2
// ============================================================================

export function PoincareScatter({
  rr: rawRr,
  sd1: rawSd1,
  sd2: rawSd2,
  print = false,
  width,
}: { rr: unknown[] | null; sd1: unknown; sd2: unknown } & PrintProps) {
  const locale = useLocale()
  const t = useTranslations('charts')
  const axisInt = useAxisInt(locale)
  // Coercizione al confine del componente: da qui in giù i valori sono number
  // garantiti, quindi tutte le formattazioni a valle sono sicure.
  const rr = toNumArray(rawRr)
  const sd1 = toNum(rawSd1)
  const sd2 = toNum(rawSd2)
  // Scala fissa di default (stessi valori dell'app: 400–1400 ms, estesa a
  // 300–1600), così due misurazioni — o le due fasi di un ortostatico — si
  // confrontano a colpo d'occhio. "Zoom" passa alla scala adattiva.
  const [zoomState, setZoom] = useState(false)
  const zoom = print ? false : zoomState
  if (rr.length < 2) {
    return <Placeholder text={t('poincare.noRr')} />
  }
  const allPoints = rr.slice(0, -1).map((v, i) => ({ x: v, y: rr[i + 1] }))
  const sample = allPoints.length > 1500
    ? allPoints.filter((_, i) => i % Math.ceil(allPoints.length / 1500) === 0)
    : allPoints

  const meanRr = rr.reduce((a, b) => a + b, 0) / rr.length

  const scale = zoom ? rrScaleAdaptive(rr) : rrScaleFor(rr)
  const min = scale.min
  const max = scale.max
  const size = width ?? PRINT_SIZES.poincare

  const chart = (
    <ScatterChart
      {...(print ? { width: size, height: size } : {})}
      margin={{ top: 12, right: 16, bottom: 32, left: 8 }}
    >
      <CartesianGrid stroke="#E2E6EA" />
      <XAxis
        type="number"
        dataKey="x"
        domain={[min, max]}
        stroke="#6B7280"
        fontSize={10}
        tickFormatter={(v) => axisInt.format(Number(v))}
        label={{ value: t('axes.rrN'), position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6B7280' }}
      />
      <YAxis
        type="number"
        dataKey="y"
        domain={[min, max]}
        stroke="#6B7280"
        fontSize={10}
        tickFormatter={(v) => axisInt.format(Number(v))}
        label={{ value: t('axes.rrN1'), angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }}
      />
      <ZAxis range={[14, 14]} />
      <ReferenceLine
        segment={[{ x: min, y: min }, { x: max, y: max }]}
        stroke="#94A3B8"
        strokeDasharray="4 4"
        ifOverflow="hidden"
      />
      {!print && (
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }}
          content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null
            const p = payload[0].payload as { x: number; y: number }
            const diff = p.y - p.x
            return (
              <div className="bg-white border border-surface-border rounded-xl shadow-elevated px-3 py-2 text-[11px]">
                <div className="text-anthracite">RR(n): <b>{num(p.x, 0, locale)}</b> ms</div>
                <div className="text-anthracite">RR(n+1): <b>{num(p.y, 0, locale)}</b> ms</div>
                <div className="text-anthracite-lighter">{t('poincare.diff')}: <b>{signed(diff, 0, locale)}</b> ms</div>
              </div>
            )
          }}
        />
      )}
      <Scatter data={sample} fill="#4FA39A" fillOpacity={0.4} isAnimationActive={false} />
      <Customized component={(props: unknown) => (
        <PoincareOverlay
          chart={props as ChartInternals}
          meanRr={meanRr}
          sd1={sd1}
          sd2={sd2}
          locale={locale}
        />
      )} />
    </ScatterChart>
  )

  return (
    <div>
      {!print && <ScaleToggle zoom={zoom} onToggle={() => setZoom((z) => !z)} extended={scale.extended} />}
      {print ? (
        <div style={{ width: size, height: size }}>{chart}</div>
      ) : (
        <div className="aspect-square w-full">
          <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
        </div>
      )}
      <PoincareLegend sd1={sd1} sd2={sd2} print={print} />
    </div>
  )
}

function PoincareLegend({ sd1, sd2, print = false }: { sd1: number | null; sd2: number | null; print?: boolean }) {
  const locale = useLocale()
  const t = useTranslations('charts.poincare')
  const ratio = sd1 != null && sd2 != null && sd2 > 0 ? sd1 / sd2 : null
  let interp: { label: string; tone: string } | null = null
  if (ratio != null) {
    if (ratio < 0.5) interp = { label: t('predLong'), tone: 'text-blue-700' }
    else if (ratio > 1.0) interp = { label: t('predShort'), tone: 'text-orange-700' }
    else interp = { label: t('balanced'), tone: 'text-emerald-700' }
  }
  return (
    <div className={`${print ? 'mt-2' : 'mt-3'} space-y-2 break-inside-avoid`}>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-surface-border bg-surface px-3 py-2 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-anthracite-lighter">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#F97316' }} />
            SD1
          </div>
          <div className="text-sm font-semibold text-anthracite mt-0.5">
            {num(sd1, 1, locale)} <span className="text-[10px] text-anthracite-lighter font-normal">ms</span>
          </div>
          <div className="text-[10px] text-anthracite-lighter mt-0.5 break-words">{t('shortTerm')}</div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface px-3 py-2 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-anthracite-lighter">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3B82F6' }} />
            SD2
          </div>
          <div className="text-sm font-semibold text-anthracite mt-0.5">
            {num(sd2, 1, locale)} <span className="text-[10px] text-anthracite-lighter font-normal">ms</span>
          </div>
          <div className="text-[10px] text-anthracite-lighter mt-0.5 break-words">{t('longTerm')}</div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface px-3 py-2 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-anthracite-lighter">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#2F343A' }} />
            SD1/SD2
          </div>
          <div className="text-sm font-semibold text-anthracite mt-0.5">
            {ratio == null ? '—' : num(ratio, 2, locale)}
          </div>
          {interp && <div className={`text-[10px] font-medium mt-0.5 break-words ${interp.tone}`}>{interp.label}</div>}
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

function PoincareOverlay({ chart, meanRr, sd1, sd2, locale }: { chart: ChartInternals; meanRr: number; sd1: number | null; sd2: number | null; locale: string }) {
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
            <text x={0} y={4} fontSize={10} fill="#1D4ED8" fontWeight={700}>SD2 {num(sd2Pos, 0, locale)} ms</text>
          </g>
          {/* label SD1 al tip dell'asse breve */}
          <g transform={`translate(0,${-ry - 6}) rotate(${-rotation})`}>
            <text x={4} y={0} fontSize={10} fill="#C2410C" fontWeight={700}>SD1 {num(sd1Pos, 0, locale)} ms</text>
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

export function Rhythmogram({
  rr: rawRr,
  print = false,
  width,
  height,
}: { rr: unknown[] | null; height?: number } & PrintProps) {
  const locale = useLocale()
  const t = useTranslations('charts')
  const axisInt = useAxisInt(locale)
  const rr = toNumArray(rawRr)
  // Asse Y fisso (400–1400 ms, esteso 300–1600) come nell'app; "Zoom" = adattivo.
  const [zoomState, setZoom] = useState(false)
  const zoom = print ? false : zoomState
  if (rr.length === 0) {
    return <Placeholder text={t('poincare.noRr')} />
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
  const w = width ?? PRINT_SIZES.rhythmogram.width
  const h = height ?? (print ? PRINT_SIZES.rhythmogram.height : 320)

  const chart = (
    <LineChart
      data={sample}
      {...(print ? { width: w, height: h } : {})}
      margin={{ top: 8, right: 20, bottom: 32, left: 8 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
      <XAxis
        dataKey="t"
        stroke="#6B7280"
        fontSize={10}
        type="number"
        domain={[0, 'dataMax']}
        ticks={Array.from({ length: Math.floor(totalSec / tickStep) + 1 }, (_, i) => i * tickStep)}
        tickFormatter={(v) => `${axisInt.format(Number(v))}s`}
        label={{ value: t('axes.timeS'), position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6B7280' }}
      />
      <YAxis
        stroke="#6B7280"
        fontSize={10}
        domain={[scale.min, scale.max]}
        allowDataOverflow
        tickFormatter={(v) => axisInt.format(Number(v))}
        label={{ value: t('axes.rrMs'), angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }}
      />
      <ReferenceLine y={meanRr} stroke="#9CA3AF" strokeDasharray="4 4" label={{ value: t('rhythmogram.mean', { value: num(meanRr, 0, locale) }), position: 'right', fontSize: 10, fill: '#6B7280' }} />
      {!print && (
        <Tooltip
          contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }}
          labelFormatter={(v) => t('rhythmogram.tooltipTime', { value: num(v, 1, locale) })}
          formatter={(v) => [`${num(v, 0, locale)} ms`, 'RR']}
        />
      )}
      <Line type="monotone" dataKey="rr" stroke="#4FA39A" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      {!print && (
        <Brush dataKey="t" height={26} stroke="#4FA39A" travellerWidth={8} tickFormatter={(v) => `${axisInt.format(Number(v))}s`} />
      )}
    </LineChart>
  )

  if (print) {
    return <div style={{ width: w, height: h }}>{chart}</div>
  }
  return (
    <div>
      <ScaleToggle zoom={zoom} onToggle={() => setZoom((z) => !z)} extended={scale.extended} />
      <ResponsiveContainer width="100%" height={h}>{chart}</ResponsiveContainer>
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
  print = false,
  width,
  height,
}: { vlf: unknown; lf: unknown; hf: unknown; lfHfRatio?: unknown; resonanceHz?: unknown; height?: number } & PrintProps) {
  const locale = useLocale()
  const t = useTranslations('charts')
  const axisInt = useAxisInt(locale)
  const vlf = toNum(rawVlf)
  const lf = toNum(rawLf)
  const hf = toNum(rawHf)
  const lfHfRatio = toNum(rawLfHfRatio)
  const resonanceHz = toNum(rawResonanceHz)
  // Asse Y logaritmico fisso (10 – 1.000.000 ms²/Hz, esteso 1 – 10.000.000,
  // tick solo sulle potenze di 10) e asse X 0 – 0,5 Hz, come nell'app.
  // "Zoom" torna alla scala lineare adattiva.
  const [zoomState, setZoom] = useState(false)
  const zoom = print ? false : zoomState
  if (vlf == null && lf == null && hf == null) return <Placeholder text={t('psd.noData')} />

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
  const w = width ?? PRINT_SIZES.psd.width
  const h = height ?? (print ? PRINT_SIZES.psd.height : 260)

  const chart = (
    <AreaChart
      data={data}
      {...(print ? { width: w, height: h } : {})}
      margin={{ top: 24, right: 16, bottom: 28, left: 8 }}
    >
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
        tickFormatter={(v) => num(v, 2, locale)}
        label={{ value: t('axes.freqHz'), position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6B7280' }}
      />
      {zoom ? (
        <YAxis
          stroke="#6B7280"
          fontSize={10}
          domain={[0, Math.ceil(maxPsd * 1.15)]}
          tickFormatter={(v) => axisInt.format(Number(v))}
          label={{ value: t('axes.psd'), angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }}
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
          label={{ value: t('axes.psd'), angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }}
        />
      )}
      <ReferenceArea x1={PSD_BANDS.vlf.from} x2={PSD_BANDS.vlf.to} fill={PSD_COLORS.vlf} fillOpacity={0.18} label={{ value: 'VLF', position: 'insideTop', fill: '#991B1B', fontSize: 11, fontWeight: 600 }} />
      <ReferenceArea x1={PSD_BANDS.lf.from} x2={PSD_BANDS.lf.to} fill={PSD_COLORS.lf} fillOpacity={0.18} label={{ value: 'LF', position: 'insideTop', fill: '#92400E', fontSize: 11, fontWeight: 600 }} />
      <ReferenceArea x1={PSD_BANDS.hf.from} x2={PSD_BANDS.hf.to} fill={PSD_COLORS.hf} fillOpacity={0.18} label={{ value: 'HF', position: 'insideTop', fill: '#115E59', fontSize: 11, fontWeight: 600 }} />
      {resonanceHz != null && resonanceHz > 0 && resonanceHz <= fMax && (
        <ReferenceLine
          x={+resonanceHz.toFixed(4)}
          stroke="#8B5CF6"
          strokeWidth={2}
          label={{ value: t('psd.resonance', { value: num(resonanceHz, 3, locale) }), position: 'top', fill: '#6D28D9', fontSize: 10, fontWeight: 700 }}
        />
      )}
      {!print && (
        <Tooltip
          contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }}
          labelFormatter={(v) => t('psd.tooltipFreq', { value: num(v, 3, locale) })}
          formatter={(v) => [`${num(v, 1, locale)} ms²/Hz`, 'PSD']}
        />
      )}
      <Area type="monotone" dataKey="psd" stroke="#2F343A" strokeWidth={1.8} fill="url(#psd-fill)" isAnimationActive={false} />
    </AreaChart>
  )

  return (
    <div className={print ? 'break-inside-avoid' : undefined}>
      {!print && <ScaleToggle zoom={zoom} onToggle={() => setZoom((z) => !z)} extended={scale.extended} />}
      {print ? (
        <div style={{ width: w, height: h }}>{chart}</div>
      ) : (
        <ResponsiveContainer width="100%" height={h}>{chart}</ResponsiveContainer>
      )}
      <div className={`grid ${print ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'} gap-2 ${print ? 'mt-2' : 'mt-3'}`}>
        <PowerCell label="VLF" value={vlf} color={PSD_COLORS.vlf} unit="ms²" locale={locale} />
        <PowerCell label="LF" value={lf} color={PSD_COLORS.lf} unit="ms²" locale={locale} />
        <PowerCell label="HF" value={hf} color={PSD_COLORS.hf} unit="ms²" locale={locale} />
        <PowerCell label="LF/HF" value={lfHfRatio ?? (lf != null && hf ? lf / hf : null)} color="#2F343A" locale={locale} />
      </div>
    </div>
  )
}

// ============================================================================
// TORTA VLF / LF / HF — quota di ogni banda sulla potenza totale
// ============================================================================

// Stessi colori delle bande dello spettro PSD.
export const PSD_COLORS = { vlf: '#DC2626', lf: '#F59E0B', hf: '#4FA39A' } as const

type PieSlice = { key: 'vlf' | 'lf' | 'hf'; label: string; value: number; color: string; pct: number }

export function PsdPie({
  vlf: rawVlf,
  lf: rawLf,
  hf: rawHf,
  print = false,
  size,
}: { vlf: unknown; lf: unknown; hf: unknown; print?: boolean; size?: number }) {
  const locale = useLocale()
  const t = useTranslations('charts')
  const tDetail = useTranslations('measurement.detail')
  const vlf = toNum(rawVlf)
  const lf = toNum(rawLf)
  const hf = toNum(rawHf)
  const total = (vlf ?? 0) + (lf ?? 0) + (hf ?? 0)
  if ((vlf == null && lf == null && hf == null) || !(total > 0)) return <Placeholder text={t('psd.noData')} />

  const slices: PieSlice[] = (
    [
      { key: 'vlf', label: 'VLF', value: vlf, color: PSD_COLORS.vlf },
      { key: 'lf', label: 'LF', value: lf, color: PSD_COLORS.lf },
      { key: 'hf', label: 'HF', value: hf, color: PSD_COLORS.hf },
    ] as const
  )
    .filter((s): s is typeof s & { value: number } => s.value != null && s.value > 0)
    .map((s) => ({ ...s, pct: (s.value / total) * 100 }))

  const px = size ?? PRINT_SIZES.psdPie
  const outer = Math.floor(px / 2) - 20

  // Etichetta percentuale dentro la fetta (a metà raggio), solo se la fetta è
  // abbastanza grande da contenerla.
  const RAD = Math.PI / 180
  const renderLabel = (p: PieLabelRenderProps) => {
    const pct = (p.percent ?? 0) * 100
    if (pct < 6) return null
    const cx = Number(p.cx ?? 0)
    const cy = Number(p.cy ?? 0)
    const ir = Number(p.innerRadius ?? 0)
    const or = Number(p.outerRadius ?? outer)
    const r = ir + (or - ir) * 0.55
    const mid = Number(p.midAngle ?? 0)
    const x = cx + r * Math.cos(-mid * RAD)
    const y = cy + r * Math.sin(-mid * RAD)
    return (
      <text x={x} y={y} fill="#fff" fontSize={11} fontWeight={700} textAnchor="middle" dominantBaseline="central">
        {num(pct, 0, locale)}%
      </text>
    )
  }

  const chart = (
    <PieChart {...(print ? { width: px, height: px } : {})} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
      <Pie
        data={slices}
        dataKey="value"
        nameKey="label"
        cx="50%"
        cy="50%"
        outerRadius={outer}
        stroke="#fff"
        strokeWidth={2}
        isAnimationActive={false}
        labelLine={false}
        label={renderLabel}
      >
        {slices.map((s) => <Cell key={s.key} fill={s.color} />)}
      </Pie>
      {!print && (
        <Tooltip
          contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }}
          formatter={(v, name) => [`${num(v, 1, locale)} ms²`, String(name)]}
        />
      )}
    </PieChart>
  )

  return (
    <div className={`flex ${print ? 'flex-row items-center gap-4 break-inside-avoid' : 'flex-col sm:flex-row items-center gap-4'}`}>
      {print ? (
        <div style={{ width: px, height: px }} className="flex-shrink-0">{chart}</div>
      ) : (
        <div style={{ width: px, height: px }} className="flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
        </div>
      )}
      <dl className="flex-1 min-w-0 w-full space-y-1.5 text-xs">
        {slices.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <dt className="w-8 font-medium text-anthracite">{s.label}</dt>
            <dd className="tabular-nums text-anthracite">
              <span className="font-semibold">{num(s.pct, 0, locale)}%</span>
              <span className="text-anthracite-lighter ml-1.5">{num(s.value, 1, locale)} ms²</span>
            </dd>
          </div>
        ))}
        <div className="pt-1.5 border-t border-surface-border text-[11px] text-anthracite-lighter">
          {tDetail('psdPieTotal', { value: num(total, 1, locale) })}
        </div>
      </dl>
    </div>
  )
}

function PowerCell({ label, value, color, unit, locale }: { label: string; value: number | null; color: string; unit?: string; locale: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface px-3 py-2 min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-anthracite-lighter">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </div>
      <div className="text-sm font-semibold text-anthracite mt-0.5">
        {value == null ? '—' : num(value, 1, locale)}{unit ? <span className="text-[10px] text-anthracite-lighter font-normal ml-1">{unit}</span> : null}
      </div>
    </div>
  )
}

function Placeholder({ text }: { text: string }) {
  return <div className="h-[260px] flex items-center justify-center text-sm text-anthracite-lighter bg-surface rounded-xl">{text}</div>
}
