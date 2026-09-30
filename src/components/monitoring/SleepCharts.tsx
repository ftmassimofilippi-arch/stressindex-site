'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Brush, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SleepDesaturationEvent, SleepWindow } from '@/lib/monitoring-types'
import { MON, SLEEP_PARAMS, SLEEP_STATE_COLOR, SLEEP_STATE_ORDER, STATE_COLOR, fmtNum, hm, sleepStateLabel } from '@/lib/monitoring-format'
import { sleepT } from '@/lib/sleep-strings'

// Grafici del modulo Sonno (Spo2NightChart, PrNightChart, DesaturationStrip
// dell'app) sulle finestre da 1 minuto già calcolate dall'app: le finestre
// non valide spezzano la linea. Nessun valore è ricalcolato.
// `print`: pagina di stampa A4, dimensioni fisse (`width`), senza tooltip né brush.

type Pt = { t: number; v: number | null; min: number | null }

type PrintProps = { print?: boolean; width?: number }

function usePoints(windows: SleepWindow[], pick: (w: SleepWindow) => number | null) {
  return useMemo(() => {
    if (windows.length === 0) return { pts: [] as Pt[], start: 0, total: 1 }
    const start = new Date(windows[0].s).getTime()
    const total = Math.max(1, (new Date(windows[windows.length - 1].e).getTime() - start) / 60_000)
    const pts: Pt[] = windows.map((w) => ({
      t: (new Date(w.s).getTime() - start) / 60_000 + 0.5,
      v: w.state === 'nonValido' ? null : pick(w),
      min: w.spo2_min,
    }))
    return { pts, start, total }
  }, [windows, pick])
}

function hourTicks(total: number): number[] {
  const step = total <= 240 ? 30 : total <= 600 ? 60 : 120
  const out: number[] = []
  for (let m = step; m < total; m += step) out.push(m)
  return out
}

const TIP = { background: '#fff', borderRadius: 12, border: `1px solid ${MON.borderLight}`, fontSize: 11 }

/** SpO₂ media per minuto; banda rossa sotto il 90 %; punti rossi sui nadir degli eventi. */
export function Spo2NightChart({ windows, events, tz, height = 220, print = false, width = 620 }: { windows: SleepWindow[]; events: SleepDesaturationEvent[]; tz: number; height?: number } & PrintProps) {
  const tc = useTranslations('common')
  const { pts, start, total } = usePoints(windows, (w) => w.spo2)
  if (pts.length === 0) return <div className="text-sm text-anthracite-lighter">{tc('noData')}</div>
  const toIso = (m: number) => new Date(start + m * 60_000).toISOString()
  let minY = 100
  for (const p of pts) { const v = p.min ?? p.v; if (v != null && v < minY) minY = v }
  for (const e of events) if (e.nadir < minY) minY = e.nadir
  const yMin = Math.max(50, Math.floor(minY - 3) - (Math.floor(minY - 3) % 2))
  const chart = (
    <LineChart data={pts} {...(print ? { width, height } : {})} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={MON.borderLight} vertical={false} />
      <ReferenceArea y1={yMin} y2={SLEEP_PARAMS.t90Threshold} fill={MON.error} fillOpacity={0.1} strokeOpacity={0} />
      <ReferenceLine y={SLEEP_PARAMS.t90Threshold} stroke={MON.error} strokeOpacity={0.55} strokeDasharray="4 4" label={{ value: '90 %', position: 'insideTopRight', fontSize: 9, fill: MON.error }} />
      <XAxis dataKey="t" type="number" domain={[0, total]} ticks={hourTicks(total)} tickFormatter={(v) => hm(toIso(Number(v)), tz)} stroke={MON.textSecondary} fontSize={10} />
      <YAxis domain={[yMin, 100]} stroke={MON.textSecondary} fontSize={10} width={34} tickFormatter={(v) => `${Math.round(Number(v))}`} />
      {!print && <Tooltip contentStyle={TIP} labelFormatter={(v) => hm(toIso(Number(v)), tz)} formatter={(v: unknown) => [v == null ? '—' : `${Math.round(Number(v))} %`, 'SpO₂']} />}
      <Line type="linear" dataKey="v" stroke={MON.sleep} strokeWidth={1.6} dot={false} connectNulls={false} isAnimationActive={false} />
      {events.map((e, i) => (
        <ReferenceDot key={i} x={(new Date(e.nadir_time).getTime() - start) / 60_000} y={e.nadir} r={events.length > 120 ? 1.6 : 2.6} fill={STATE_COLOR.stress} stroke="none" ifOverflow="hidden" />
      ))}
      {!print && <Brush dataKey="t" height={22} stroke={MON.sleep} travellerWidth={8} tickFormatter={(v) => hm(toIso(Number(v)), tz)} />}
    </LineChart>
  )
  if (print) return <div style={{ width, height }}>{chart}</div>
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <ResponsiveContainer width="100%" height={height}>{chart}</ResponsiveContainer>
      </div>
    </div>
  )
}

/** Polso medio per minuto; linea verde tratteggiata = polso basale; punti gialli = eventi con surge ≥ 6 bpm. */
export function PrNightChart({ windows, events, prBasal, tz, height = 200, print = false, width = 620 }: { windows: SleepWindow[]; events: SleepDesaturationEvent[]; prBasal: number | null; tz: number; height?: number } & PrintProps) {
  const t = useTranslations('monitoring')
  const tc = useTranslations('common')
  const locale = useLocale()
  const { pts, start, total } = usePoints(windows, (w) => w.pr)
  if (pts.length === 0) return <div className="text-sm text-anthracite-lighter">{tc('noData')}</div>
  const toIso = (m: number) => new Date(start + m * 60_000).toISOString()
  const vals = pts.map((p) => p.v).filter((v): v is number => v != null)
  let minY = vals.length ? Math.min(...vals) : 40
  const maxY = vals.length ? Math.max(...vals) : 100
  if (prBasal != null) minY = Math.min(minY, prBasal)
  const yMin = Math.floor((minY - 5) / 5) * 5
  const yMax = Math.ceil((maxY + 5) / 5) * 5
  const markers = events.filter((e) => (e.surge_bpm ?? 0) >= SLEEP_PARAMS.surgeThresholdBpm)
  const chart = (
    <LineChart data={pts} {...(print ? { width, height } : {})} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={MON.borderLight} vertical={false} />
      {prBasal != null && (
        <ReferenceLine y={prBasal} stroke={STATE_COLOR.recovery} strokeOpacity={0.7} strokeDasharray="4 4" label={{ value: t('sleep.basalLine', { v: Math.round(prBasal) }), position: 'insideTopRight', fontSize: 9, fill: STATE_COLOR.recovery }} />
      )}
      <XAxis dataKey="t" type="number" domain={[0, total]} ticks={hourTicks(total)} tickFormatter={(v) => hm(toIso(Number(v)), tz)} stroke={MON.textSecondary} fontSize={10} />
      <YAxis domain={[yMin, yMax]} stroke={MON.textSecondary} fontSize={10} width={34} tickFormatter={(v) => `${Math.round(Number(v))}`} />
      {!print && <Tooltip contentStyle={TIP} labelFormatter={(v) => hm(toIso(Number(v)), tz)} formatter={(v: unknown) => [v == null ? '—' : `${Math.round(Number(v))} bpm`, sleepT('pr', locale as 'it' | 'en' | 'de')]} />}
      <Line type="linear" dataKey="v" stroke={STATE_COLOR.stress} strokeWidth={1.6} dot={false} connectNulls={false} isAnimationActive={false} />
      {markers.map((e, i) => (
        <ReferenceDot key={i} x={(new Date(e.nadir_time).getTime() - start) / 60_000} y={prBasal ?? yMin + 1} r={markers.length > 120 ? 1.4 : 2.2} fill={MON.warning} stroke="none" ifOverflow="hidden" />
      ))}
      {!print && <Brush dataKey="t" height={22} stroke={STATE_COLOR.stress} travellerWidth={8} tickFormatter={(v) => hm(toIso(Number(v)), tz)} />}
    </LineChart>
  )
  if (print) return <div style={{ width, height }}>{chart}</div>
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <ResponsiveContainer width="100%" height={height}>{chart}</ResponsiveContainer>
      </div>
    </div>
  )
}

/** Striscia della notte: sfondo per stato del minuto e tacche sugli eventi, alte in proporzione al calo. `print`: senza scroll orizzontale. */
export function DesaturationStrip({ windows, events, tz, height = 64, print = false }: { windows: SleepWindow[]; events: SleepDesaturationEvent[]; tz: number; height?: number; print?: boolean }) {
  const t = useTranslations('monitoring')
  const locale = useLocale()
  if (windows.length === 0) return null
  const W = 1000
  const labelH = 14
  const plotH = height - labelH
  const startMs = new Date(windows[0].s).getTime()
  const endMs = new Date(windows[windows.length - 1].e).getTime()
  const total = Math.max(1, endMs - startMs)
  const x = (iso: string) => ((new Date(iso).getTime() - startMs) / total) * W
  const runs: Array<{ x0: number; x1: number; state: SleepWindow['state'] }> = []
  for (const w of windows) {
    const x0 = x(w.s), x1 = x(w.e)
    const last = runs[runs.length - 1]
    if (last && last.state === w.state) last.x1 = x1
    else runs.push({ x0, x1, state: w.state })
  }
  const ticks: Array<{ x: number; label: string }> = []
  const step = total > 10 * 3_600_000 ? 2 : 1
  const startWall = startMs + tz * 60_000
  let tk = Math.ceil(startWall / 3_600_000) * 3_600_000
  while (tk - tz * 60_000 < endMs) {
    ticks.push({ x: ((tk - tz * 60_000 - startMs) / total) * W, label: String(new Date(tk).getUTCHours()).padStart(2, '0') + ':00' })
    tk += step * 3_600_000
  }
  return (
    <div className={print ? '' : 'overflow-x-auto'}>
      <svg viewBox={`0 0 ${W} ${height}`} className={`w-full block ${print ? '' : 'min-w-[520px]'}`} style={{ height }} role="img" aria-label={t('sleep.nightTimeline')}>
        {runs.map((r, i) => <rect key={i} x={r.x0} y={0} width={Math.max(0.5, r.x1 - r.x0)} height={plotH} fill={SLEEP_STATE_COLOR[r.state]} />)}
        {events.map((e, i) => {
          const h = Math.max(0.35, Math.min(1, 0.35 + (((e.drop ?? 3) - 3) / 7) * 0.65)) * plotH
          const px = x(e.start)
          return (
            <line key={`e${i}`} x1={px} x2={px} y1={plotH} y2={plotH - h} stroke={STATE_COLOR.stress} strokeWidth={events.length > 200 ? 1 : 1.5}>
              <title>{t('sleep.eventTitle', { time: hm(e.start, tz), drop: fmtNum(e.drop, 1, locale), nadir: e.nadir, sec: e.duration_sec })}</title>
            </line>
          )
        })}
        <rect x={0.4} y={0.4} width={W - 0.8} height={plotH - 0.8} rx={4} fill="none" stroke={MON.borderMedium} strokeWidth={0.8} />
        {ticks.map((tk, i) => (
          <g key={i}>
            <line x1={tk.x} x2={tk.x} y1={plotH} y2={plotH + 3} stroke={MON.textMuted} />
            <text x={tk.x} y={plotH + 12} fontSize={8} textAnchor="middle" fill={MON.textMuted}>{tk.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export function SleepStateLegend({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('monitoring')
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-1 ${compact ? 'text-[10px]' : 'text-[11px]'} text-anthracite-lighter`}>
      {SLEEP_STATE_ORDER.map((s) => (
        <span key={s} className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: SLEEP_STATE_COLOR[s], border: s === 'nonValido' || s === 'normale' ? `1px solid ${MON.borderMedium}` : undefined }} />
          {sleepStateLabel(s, t)}
        </span>
      ))}
    </div>
  )
}
