'use client'

import { useLocale, useTranslations } from 'next-intl'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { intlTag, num } from '@/lib/format'
import { DFA_ZONES, dfaZoneLabel, formatClock, zoneForAlpha1 } from '@/lib/sport-format'
import type { DfaWindow, SportTag } from '@/lib/sport-data'

const TOOLTIP_STYLE = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #E2E6EA',
  fontSize: 11,
} as const

function Placeholder({ text, height = 260 }: { text: string; height?: number }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-anthracite-lighter bg-surface rounded-xl"
      style={{ height }}
    >
      {text}
    </div>
  )
}

// Giorno e mese numerici nella lingua della pagina (29/09, 09/29, 29.09.).
// Le chiavi arrivano come 'YYYY-MM-DD' (lunedì ISO) o ISO completo.
function dayFormatter(locale: string): (iso: string) => string {
  const f = new Intl.DateTimeFormat(intlTag(locale), { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
  return (iso) => {
    const d = new Date(iso.length <= 10 ? iso + 'T00:00:00Z' : iso)
    return Number.isNaN(d.getTime()) ? iso : f.format(d)
  }
}

// ============================================================================
// SESSIONI PER SETTIMANA — BarChart 12 settimane
// ============================================================================

export function WeeklySessionsBar({ data }: { data: Array<{ week: string; count: number }> }) {
  const t = useTranslations('sport')
  const locale = useLocale()
  const fmtDay = dayFormatter(locale)
  if (!data.length || data.every((d) => d.count === 0)) {
    return <Placeholder text={t('charts.noWeeklySessions')} height={240} />
  }
  const rows = data.map((d) => ({ ...d, label: fmtDay(d.week) }))
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
        <XAxis dataKey="label" stroke="#6B7280" fontSize={10} tickLine={false} />
        <YAxis stroke="#6B7280" fontSize={10} allowDecimals={false} width={28} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: '#E8F4F3' }}
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(v) => t('charts.weekOf', { date: String(v) })}
          formatter={(v) => [t('charts.sessionsValue', { count: Number(v) }), '']}
        />
        <Bar dataKey="count" fill="#4FA39A" radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ============================================================================
// DFA ALPHA1 nel tempo — LineChart con 5 bande colorate + marker tag
// ============================================================================

export function DfaAlpha1Chart({ windows, tags = [] }: { windows: DfaWindow[]; tags?: SportTag[] }) {
  const t = useTranslations('sport')
  const locale = useLocale()
  const data = windows
    .filter((w) => w.alpha1 != null)
    .map((w) => ({ t: w.window_start_ms / 1000, alpha1: w.alpha1 as number }))
  if (data.length === 0) return <Placeholder text={t('charts.noDfa')} />

  // Asse Y dinamico (come l'app): 1.5 di default, esteso a step di 0.5 se i
  // valori superano 1.5, così la zona Recupero (>1.0) resta sempre visibile.
  const maxAlpha = data.reduce((m, d) => Math.max(m, d.alpha1), 0)
  const yMax = maxAlpha > 1.5 ? Math.ceil(maxAlpha / 0.5) * 0.5 : 1.5
  const yTicks: number[] = []
  for (let v = 0; v <= yMax + 1e-9; v += 0.25) yTicks.push(+v.toFixed(2))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 28, left: 0 }}>
        {DFA_ZONES.map((z) => (
          <ReferenceArea
            key={z.id}
            y1={z.min}
            y2={Math.min(z.max, yMax)}
            fill={z.color}
            fillOpacity={0.12}
            ifOverflow="hidden"
          />
        ))}
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          domain={[0, 'dataMax']}
          stroke="#6B7280"
          fontSize={10}
          tickFormatter={(v) => formatClock(Number(v) * 1000)}
          label={{ value: t('charts.timeAxis'), position: 'insideBottom', offset: -6, fontSize: 11, fill: '#6B7280' }}
        />
        <YAxis
          domain={[0, yMax]}
          ticks={yTicks}
          stroke="#6B7280"
          fontSize={10}
          width={34}
          tickFormatter={(v) => num(v, 2, locale)}
          label={{ value: 'DFA α1', angle: -90, position: 'insideLeft', offset: 18, fontSize: 11, fill: '#6B7280' }}
        />
        {tags
          .filter((tag) => tag.t_ms != null)
          .map((tag, i) => (
            <ReferenceLine
              key={`${tag.label}-${i}`}
              x={(tag.t_ms as number) / 1000}
              stroke="#2F343A"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              label={{ value: tag.label, position: 'top', fontSize: 9, fill: '#2F343A' }}
            />
          ))}
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(v) => t('charts.tAt', { time: formatClock(Number(v) * 1000) })}
          formatter={(v) => {
            const z = zoneForAlpha1(Number(v))
            return [`${num(v, 2, locale)}${z ? ` · ${dfaZoneLabel(z, t)}` : ''}`, 'DFA α1']
          }}
        />
        <Line type="monotone" dataKey="alpha1" stroke="#2F343A" strokeWidth={1.6} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Barra orizzontale stacked: tempo speso per zona (minuti + %)
export function DfaZoneBar({ windows }: { windows: DfaWindow[] }) {
  const t = useTranslations('sport')
  const locale = useLocale()
  // Stima durata di ogni finestra dal passo temporale mediano.
  const sorted = [...windows].sort((a, b) => a.window_start_ms - b.window_start_ms)
  const steps: number[] = []
  for (let i = 1; i < sorted.length; i++) steps.push(sorted[i].window_start_ms - sorted[i - 1].window_start_ms)
  const stepMs = steps.length ? median(steps) : 5000

  // La zona viene ricalcolata dall'alpha1 con le soglie a 5 zone dell'app,
  // ignorando il campo `zone` salvato (che può seguire la vecchia scala a 4).
  const perZone = new Map<number, number>()
  for (const w of sorted) {
    const z = zoneForAlpha1(w.alpha1)?.id ?? null
    if (z == null) continue
    perZone.set(z, (perZone.get(z) ?? 0) + stepMs)
  }
  const totalMs = Array.from(perZone.values()).reduce((a, b) => a + b, 0)
  if (totalMs === 0) return <Placeholder text={t('charts.noZones')} height={120} />

  const zones = DFA_ZONES.slice().sort((a, b) => a.id - b.id)

  return (
    <div>
      <div className="flex h-8 w-full overflow-hidden rounded-lg">
        {zones.map((z) => {
          const ms = perZone.get(z.id) ?? 0
          const pct = (ms / totalMs) * 100
          if (pct === 0) return null
          return (
            <div
              key={z.id}
              className="flex items-center justify-center text-[10px] font-semibold text-white"
              style={{ width: `${pct}%`, backgroundColor: z.color }}
              title={t('charts.zoneTooltip', { label: dfaZoneLabel(z, t), minutes: num(ms / 60000, 1, locale), pct: pct.toFixed(0) })}
            >
              {pct >= 8 ? `${pct.toFixed(0)}%` : ''}
            </div>
          )
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {zones.map((z) => {
          const ms = perZone.get(z.id) ?? 0
          const pct = (ms / totalMs) * 100
          return (
            <div key={z.id} className="rounded-lg border border-surface-border bg-surface px-3 py-2 min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-anthracite-lighter">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: z.color }} />
                <span className="truncate">{z.short} · {dfaZoneLabel(z, t)}</span>
              </div>
              <div className="text-sm font-semibold text-anthracite mt-0.5">
                {num(ms / 60000, 1, locale)} <span className="text-[10px] font-normal text-anthracite-lighter">{t('charts.min')}</span>
                <span className="text-[11px] font-normal text-anthracite-lighter ml-1.5">{pct.toFixed(0)}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// ============================================================================
// HR e RMSSD nel tempo — LineChart da dfa_windows
// ============================================================================

export function HrChart({ windows }: { windows: DfaWindow[] }) {
  const t = useTranslations('sport')
  const data = windows
    .filter((w) => w.hr_mean != null)
    .map((w) => ({ t: w.window_start_ms / 1000, hr: w.hr_mean as number }))
  if (data.length === 0) return <Placeholder text={t('charts.noHr')} />
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 28, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          domain={[0, 'dataMax']}
          stroke="#6B7280"
          fontSize={10}
          tickFormatter={(v) => formatClock(Number(v) * 1000)}
          label={{ value: t('charts.timeAxis'), position: 'insideBottom', offset: -6, fontSize: 11, fill: '#6B7280' }}
        />
        <YAxis stroke="#6B7280" fontSize={10} width={34} domain={['auto', 'auto']}
          label={{ value: t('charts.hrAxis'), angle: -90, position: 'insideLeft', offset: 18, fontSize: 11, fill: '#6B7280' }} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(v) => t('charts.tAt', { time: formatClock(Number(v) * 1000) })}
          formatter={(v) => [`${Math.round(Number(v))} bpm`, 'HR']}
        />
        <Line type="monotone" dataKey="hr" stroke="#EF4444" strokeWidth={1.6} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function RmssdChart({ windows }: { windows: DfaWindow[] }) {
  const t = useTranslations('sport')
  const locale = useLocale()
  const data = windows
    .filter((w) => w.rmssd != null)
    .map((w) => ({ t: w.window_start_ms / 1000, rmssd: w.rmssd as number }))
  if (data.length === 0) return <Placeholder text={t('charts.noRmssd')} />
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 28, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          domain={[0, 'dataMax']}
          stroke="#6B7280"
          fontSize={10}
          tickFormatter={(v) => formatClock(Number(v) * 1000)}
          label={{ value: t('charts.timeAxis'), position: 'insideBottom', offset: -6, fontSize: 11, fill: '#6B7280' }}
        />
        <YAxis stroke="#6B7280" fontSize={10} width={34} domain={['auto', 'auto']}
          label={{ value: t('charts.rmssdAxis'), angle: -90, position: 'insideLeft', offset: 18, fontSize: 11, fill: '#6B7280' }} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(v) => t('charts.tAt', { time: formatClock(Number(v) * 1000) })}
          formatter={(v) => [`${num(v, 1, locale)} ms`, 'RMSSD']}
        />
        <Line type="monotone" dataKey="rmssd" stroke="#4FA39A" strokeWidth={1.6} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ============================================================================
// ln(RMSSD) 60 giorni — punti + baseline rolling 7gg + banda SWC
// ============================================================================

export function LnRmssdChart({ points }: { points: Array<{ date: string; ln: number }> }) {
  const t = useTranslations('sport')
  const locale = useLocale()
  const fmtDay = dayFormatter(locale)
  if (points.length < 2) {
    return <Placeholder text={t('charts.needTwoSessions')} />
  }
  // Baseline: media mobile 7 giorni (centrata sui punti precedenti).
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const DAY = 86_400_000
  const baseline = sorted.map((p, i) => {
    const ts = new Date(p.date).getTime()
    const window = sorted.slice(0, i + 1).filter((q) => ts - new Date(q.date).getTime() <= 7 * DAY)
    const mean = window.reduce((a, q) => a + q.ln, 0) / window.length
    return mean
  })

  // Banda SWC: ±0.5 × CV × |mean| sugli ultimi 30 punti.
  const last30 = sorted.slice(-30).map((p) => p.ln)
  const mean30 = last30.reduce((a, b) => a + b, 0) / last30.length
  const sd30 = Math.sqrt(last30.reduce((a, b) => a + (b - mean30) ** 2, 0) / last30.length)
  const cv30 = mean30 !== 0 ? sd30 / Math.abs(mean30) : 0
  const swcHalf = 0.5 * cv30 * Math.abs(mean30) // = 0.5 * sd30

  const data = sorted.map((p, i) => {
    const base = baseline[i]
    const upper = base + swcHalf
    const lower = base - swcHalf
    let status: 'up' | 'in' | 'down' = 'in'
    if (p.ln > upper) status = 'up'
    else if (p.ln < lower) status = 'down'
    return {
      date: p.date,
      ln: p.ln,
      baseline: +base.toFixed(4),
      bandLow: +lower.toFixed(4),
      bandSpan: +(upper - lower).toFixed(4),
      up: status === 'up' ? p.ln : null,
      in: status === 'in' ? p.ln : null,
      down: status === 'down' ? p.ln : null,
    }
  })

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="#6B7280"
          fontSize={10}
          tickFormatter={(v) => fmtDay(String(v))}
          minTickGap={28}
        />
        <YAxis stroke="#6B7280" fontSize={10} width={36} domain={['auto', 'auto']}
          tickFormatter={(v) => num(v, 1, locale)}
          label={{ value: 'ln(RMSSD)', angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }} />
        {/* banda SWC come area impilata trasparente + colorata */}
        <Area dataKey="bandLow" stackId="band" stroke="none" fill="none" isAnimationActive={false} />
        <Area dataKey="bandSpan" stackId="band" stroke="none" fill="#4FA39A" fillOpacity={0.14} isAnimationActive={false} />
        <Line type="monotone" dataKey="baseline" stroke="#2E746C" strokeWidth={1.6} strokeDasharray="5 4" dot={false} isAnimationActive={false} name={t('charts.baseline7d')} />
        <Line type="monotone" dataKey="ln" stroke="#94A3B8" strokeWidth={1} dot={false} isAnimationActive={false} legendType="none" />
        <Scatter dataKey="up" fill="#10B981" isAnimationActive={false} />
        <Scatter dataKey="in" fill="#F59E0B" isAnimationActive={false} />
        <Scatter dataKey="down" fill="#EF4444" isAnimationActive={false} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(v) => fmtDay(String(v))}
          formatter={(value, name) => {
            if (value == null) return [] as unknown as [string, string]
            const label = name === 'baseline' ? t('charts.baseline7d') : t('charts.lnRmssd')
            return [num(value, 3, locale), label]
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ============================================================================
// Performance Management Chart — CTL / ATL / TSB
// ============================================================================

export function PmcChart({ data }: { data: Array<{ date: string; ctl: number | null; atl: number | null; tsb: number | null }> }) {
  const t = useTranslations('sport')
  const locale = useLocale()
  const fmtDay = dayFormatter(locale)
  if (data.length < 1) return <Placeholder text={t('charts.noLoad')} />
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
        <XAxis dataKey="date" stroke="#6B7280" fontSize={10} tickFormatter={(v) => fmtDay(String(v))} minTickGap={28} />
        <YAxis stroke="#6B7280" fontSize={10} width={34} />
        {/* zona ottimale gara: TSB +5 a +25 */}
        <ReferenceArea y1={5} y2={25} fill="#10B981" fillOpacity={0.08} />
        <ReferenceLine y={0} stroke="#CBD5E1" strokeWidth={1} />
        <Line type="monotone" dataKey="ctl" stroke="#3B82F6" strokeWidth={1.8} dot={false} isAnimationActive={false} name={t('charts.ctl')} />
        <Line type="monotone" dataKey="atl" stroke="#EF4444" strokeWidth={1.6} dot={false} isAnimationActive={false} name={t('charts.atl')} />
        <Line type="monotone" dataKey="tsb" stroke="#10B981" strokeWidth={1.6} dot={false} isAnimationActive={false} name={t('charts.tsb')} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(v) => fmtDay(String(v))}
          formatter={(value, name) => [value == null ? '—' : num(value, 1, locale), String(name)]}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
