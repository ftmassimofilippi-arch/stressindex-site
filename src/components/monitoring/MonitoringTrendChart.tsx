'use client'

import { useMemo, useState } from 'react'
import { Brush, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MonitoringEvent, MonitoringNight, MonitoringState, MonitoringWindow } from '@/lib/monitoring-types'
import { MON, STATE_COLOR, STATE_LABEL, hm } from '@/lib/monitoring-format'
import { StateLegend } from './MonitoringTimeline'

// Andamento (MonitoringTrendChart dell'app): grafico a linee sull'intero
// periodo con selettore del parametro, sfondo a bande per stato, fascia della
// notte, marcatori degli eventi con tooltip, tratti non validi come
// interruzioni della linea, Brush di Recharts per zoomare.

export interface ParamOption { key: keyof MonitoringWindow; label: string; unit: string; proOnly?: boolean; digits: number }

export const PARAM_OPTIONS: ParamOption[] = [
  { key: 'hr', label: 'HR', unit: 'bpm', digits: 0 },
  { key: 'rmssd', label: 'RMSSD', unit: 'ms', digits: 1 },
  { key: 'ln_rmssd', label: 'ln RMSSD', unit: '', proOnly: true, digits: 2 },
  { key: 'sdnn', label: 'SDNN', unit: 'ms', proOnly: true, digits: 1 },
  { key: 'lf_hf', label: 'LF/HF', unit: '', proOnly: true, digits: 2 },
  { key: 'si', label: 'Baevsky', unit: '', proOnly: true, digits: 0 },
  { key: 'dfa', label: 'DFA α1', unit: '', proOnly: true, digits: 2 },
  { key: 'br', label: 'Respiro stimato', unit: 'atti/min', digits: 0 },
]

type Props = {
  windows: MonitoringWindow[]
  start: string
  end: string
  tz: number
  events?: MonitoringEvent[]
  night?: MonitoringNight | null
  pro?: boolean
  height?: number
}

type Point = { t: number; v: number | null; state: MonitoringState; valid: boolean }

export function MonitoringTrendChart({ windows, start, end, tz, events = [], night, pro = true, height = 300 }: Props) {
  const options = PARAM_OPTIONS.filter((o) => pro || !o.proOnly)
  const [key, setKey] = useState<ParamOption['key']>('hr')
  const opt = options.find((o) => o.key === key) ?? options[0]
  const startMs = new Date(start).getTime()
  const totalMin = Math.max(1, (new Date(end).getTime() - startMs) / 60_000)
  const toMin = (iso: string) => (new Date(iso).getTime() - startMs) / 60_000
  const toIso = (min: number) => new Date(startMs + min * 60_000).toISOString()

  const data = useMemo<Point[]>(() => {
    const pts = windows.map((w) => ({
      t: Math.round(toMin(w.s) * 10) / 10,
      v: w.valid ? (w[opt.key] as number | null) ?? null : null,
      state: w.state,
      valid: w.valid,
    }))
    // DFA α1 c'è solo una finestra ogni 5: si tengono solo i punti presenti.
    return opt.key === 'dfa' ? pts.filter((p) => p.v != null) : pts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windows, opt.key, startMs])

  const bands = useMemo(() => {
    const out: Array<{ x1: number; x2: number; state: MonitoringState }> = []
    for (const w of windows) {
      if (w.state === 'invalid' || w.state === 'neutral') continue
      const x1 = toMin(w.s)
      const x2 = x1 + 1
      const last = out[out.length - 1]
      if (last && last.state === w.state && Math.abs(last.x2 - x1) < 0.6) last.x2 = x2
      else out.push({ x1, x2, state: w.state })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windows, startMs])

  const hours = totalMin / 60
  const tickStep = hours > 18 ? 240 : hours > 8 ? 120 : hours > 3 ? 60 : 30
  const ticks = useMemo(() => {
    const out: number[] = []
    for (let m = 0; m <= totalMin; m += tickStep) out.push(m)
    return out
  }, [totalMin, tickStep])

  const values = data.map((p) => p.v).filter((v): v is number => v != null)
  const yMax = values.length ? Math.max(...values) : 100
  const yMin = values.length ? Math.min(...values) : 0

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setKey(o.key)}
            className="px-3 py-1.5 rounded-full text-xs font-bold border transition-colors"
            style={o.key === opt.key ? { backgroundColor: MON.accent, color: '#fff', borderColor: MON.accent } : { color: MON.textSecondary, borderColor: MON.borderLight, backgroundColor: '#fff' }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="text-xs font-bold text-anthracite mb-2">
        {opt.label}{opt.unit ? ` (${opt.unit})` : ''} · finestre di 5 minuti{opt.key === 'dfa' ? ', una ogni 5' : ''}
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 22, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={MON.borderLight} />
              {bands.map((b, i) => (
                <ReferenceArea key={i} x1={b.x1} x2={b.x2} fill={STATE_COLOR[b.state]} fillOpacity={0.16} strokeOpacity={0} ifOverflow="hidden" />
              ))}
              {night && (
                <ReferenceArea x1={toMin(night.night_start)} x2={toMin(night.night_end)} fill={MON.accentDark} fillOpacity={0.08} stroke={MON.accentDark} strokeOpacity={0.35} strokeDasharray="4 3" ifOverflow="hidden" />
              )}
              <XAxis
                dataKey="t"
                type="number"
                domain={[0, totalMin]}
                ticks={ticks}
                tickFormatter={(v) => hm(toIso(Number(v)), tz)}
                stroke={MON.textSecondary}
                fontSize={10}
              />
              <YAxis stroke={MON.textSecondary} fontSize={10} domain={['auto', 'auto']} width={44} tickFormatter={(v) => Number(v).toFixed(opt.digits)} />
              <Tooltip
                contentStyle={{ background: '#fff', borderRadius: 12, border: `1px solid ${MON.borderLight}`, fontSize: 11 }}
                labelFormatter={(v) => hm(toIso(Number(v)), tz)}
                formatter={(v: unknown, _name, item) => {
                  const p = item?.payload as Point | undefined
                  const val = v == null ? '—' : `${Number(v).toFixed(opt.digits)}${opt.unit ? ' ' + opt.unit : ''}`
                  return [`${val} · ${p ? STATE_LABEL[p.state] : ''}`, opt.label]
                }}
              />
              <Line type="monotone" dataKey="v" stroke={MON.accentDark} strokeWidth={1.6} dot={false} connectNulls={opt.key === 'dfa'} isAnimationActive={false} />
              {events.map((e) => {
                const t = toMin(e.timestamp)
                if (t < 0 || t > totalMin) return null
                return (
                  <ReferenceDot
                    key={e.id}
                    x={t}
                    y={yMax}
                    r={0}
                    ifOverflow="extendDomain"
                    shape={(props: { cx?: number; cy?: number }) => (
                      <g transform={`translate(${(props.cx ?? 0) - 9}, ${Math.max(0, (props.cy ?? 0) - 22)})`}>
                        <title>{`${e.label} · ${hm(e.timestamp, tz)}${e.response ? ` → ${e.response.label}` : ''}`}</title>
                        <circle cx={9} cy={9} r={8.5} fill="#fff" stroke={MON.accent} strokeWidth={1.2} />
                        <text x={9} y={12.5} textAnchor="middle" fontSize={9} fontWeight={700} fill={MON.accent}>{e.label.slice(0, 1).toUpperCase()}</text>
                        <line x1={9} x2={9} y1={18} y2={height} stroke={MON.accent} strokeOpacity={0.35} strokeDasharray="2 3" />
                      </g>
                    )}
                  />
                )
              })}
              <Brush dataKey="t" height={24} stroke={MON.accent} travellerWidth={8} tickFormatter={(v) => hm(toIso(Number(v)), tz)} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <StateLegend compact />
        <span className="text-[10px] text-anthracite-lighter">valori {Number.isFinite(yMin) ? yMin.toFixed(opt.digits) : '—'}–{Number.isFinite(yMax) ? yMax.toFixed(opt.digits) : '—'}</span>
      </div>
      <p className="mt-1 text-[10.5px] text-anthracite-lighter">
        Passa sul grafico per leggere un valore, sull&apos;icona per l&apos;evento. La fascia scura è la notte; i tratti vuoti sono interruzioni. Trascina il selettore sotto il grafico per zoomare.
      </p>
    </div>
  )
}
