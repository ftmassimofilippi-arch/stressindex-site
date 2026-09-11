'use client'

import { useMemo, useState } from 'react'
import type { MonitoringEvent, MonitoringNight, MonitoringWindow, ReserveCurve } from '@/lib/monitoring-types'
import { MON, STATE_COLOR, STATE_LABEL, STATE_ORDER, hm, wallDate } from '@/lib/monitoring-format'
import { EventIcon } from './EventIcon'

// Timeline orizzontale dell'intero periodo (MonitoringTimeline dell'app):
// una finestra = un minuto colorato per stato, tratteggio sulle zone non
// valide, bordo scuro sulla notte, marcatori degli eventi sopra con l'icona
// del tipo, asse orario sotto, e — se c'è — la curva della Riserva allineata
// sullo stesso asse. Hover/tap su un punto: ora, stato, HR, RMSSD.

type Props = {
  windows: MonitoringWindow[]
  start: string
  end: string
  tz: number
  events?: MonitoringEvent[]
  night?: MonitoringNight | null
  reserve?: ReserveCurve | null
  height?: number
}

const W = 1000 // larghezza logica dell'SVG (viewBox)

export function MonitoringTimeline({ windows, start, end, tz, events = [], night, reserve, height = 34 }: Props) {
  const startMs = new Date(start).getTime()
  const totalMs = Math.max(1, new Date(end).getTime() - startMs)
  const x = (iso: string) => Math.min(W, Math.max(0, ((new Date(iso).getTime() - startMs) / totalMs) * W))
  const [picked, setPicked] = useState<MonitoringWindow | null>(null)

  const runs = useMemo(() => {
    // Finestre contigue dello stesso stato fuse in un rettangolo solo (1436 rect → poche decine).
    const out: Array<{ x0: number; x1: number; state: MonitoringWindow['state'] }> = []
    for (const w of windows) {
      const x0 = x(w.s)
      const x1 = Math.max(x0 + 0.8, x(new Date(new Date(w.s).getTime() + 60_000).toISOString()))
      const last = out[out.length - 1]
      if (last && last.state === w.state && Math.abs(last.x1 - x0) < 0.6) last.x1 = x1
      else out.push({ x0, x1, state: w.state })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windows, startMs, totalMs])

  const ticks = useMemo(() => {
    const hours = totalMs / 3_600_000
    const step = hours > 18 ? 4 : hours > 8 ? 2 : 1
    const out: Array<{ x: number; label: string }> = []
    const s = wallDate(start, tz)
    if (!s) return out
    // prima ora piena dopo l'inizio (orologio del dispositivo)
    let t = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), s.getUTCHours()) + 3_600_000
    while (new Date(t).getUTCHours() % step !== 0) t += 3_600_000
    const endWall = t + totalMs // limite approssimato
    const endMs = (wallDate(end, tz)?.getTime() ?? endWall)
    while (t <= endMs) {
      const instantMs = t - tz * 60_000
      out.push({ x: ((instantMs - startMs) / totalMs) * W, label: String(new Date(t).getUTCHours()).padStart(2, '0') })
      t += step * 3_600_000
    }
    return out
  }, [start, end, tz, startMs, totalMs])

  const reservePath = useMemo(() => {
    if (!reserve || reserve.pts.length < 2) return null
    const pts = reserve.pts.filter((p) => p[1] != null) as Array<[string, number]>
    if (pts.length < 2) return null
    let vMin = Math.min(0, reserve.min ?? 0)
    let vMax = Math.max(0, reserve.max ?? 0)
    if (vMax - vMin < 1e-6) { vMax += 1; vMin -= 1 }
    const pad = (vMax - vMin) * 0.1
    vMin -= pad; vMax += pad
    const H = 56
    const y = (v: number) => H - ((v - vMin) / (vMax - vMin)) * H
    const zero = y(0)
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ')
    const up = `M${x(pts[0][0]).toFixed(1)},${zero} ` + pts.map((p) => `L${x(p[0]).toFixed(1)},${Math.min(y(p[1]), zero).toFixed(1)}`).join(' ') + ` L${x(pts[pts.length - 1][0]).toFixed(1)},${zero} Z`
    const down = `M${x(pts[0][0]).toFixed(1)},${zero} ` + pts.map((p) => `L${x(p[0]).toFixed(1)},${Math.max(y(p[1]), zero).toFixed(1)}`).join(' ') + ` L${x(pts[pts.length - 1][0]).toFixed(1)},${zero} Z`
    return {
      H, zero, line, up, down,
      min: reserve.min_t && (reserve.min ?? 0) < 0 ? { x: x(reserve.min_t), y: y(reserve.min ?? 0) } : null,
      max: reserve.max_t && (reserve.max ?? 0) > 0 ? { x: x(reserve.max_t), y: y(reserve.max ?? 0) } : null,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reserve, startMs, totalMs])

  function pick(clientX: number, target: SVGSVGElement) {
    const rect = target.getBoundingClientRect()
    const frac = (clientX - rect.left) / rect.width
    const t = startMs + frac * totalMs
    const w = windows.find((win) => {
      const a = new Date(win.s).getTime()
      return a <= t && t < a + 60_000
    })
    setPicked(w ?? null)
  }

  const visibleEvents = events.filter((e) => {
    const t = new Date(e.timestamp).getTime()
    return t >= startMs && t <= startMs + totalMs
  })

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* marcatori eventi */}
        <div className="relative h-6">
          {visibleEvents.map((e) => (
            <div
              key={e.id}
              className="absolute top-0 -translate-x-1/2 w-5 h-5 rounded-full bg-white border flex items-center justify-center"
              style={{ left: `${(x(e.timestamp) / W) * 100}%`, borderColor: MON.accent, color: MON.accent }}
              title={`${e.label} · ${hm(e.timestamp, tz)}${e.response ? ` → ${e.response.label}` : ''}`}
            >
              <EventIcon type={e.type} size={11} />
            </div>
          ))}
        </div>

        {reservePath && (
          <svg viewBox={`0 0 ${W} ${reservePath.H}`} preserveAspectRatio="none" className="w-full block" style={{ height: reservePath.H }} aria-label="Curva della Riserva">
            <line x1={0} x2={W} y1={reservePath.zero} y2={reservePath.zero} stroke={MON.borderMedium} strokeWidth={1} />
            <path d={reservePath.up} fill={STATE_COLOR.recovery} fillOpacity={0.22} />
            <path d={reservePath.down} fill={STATE_COLOR.stress} fillOpacity={0.22} />
            <path d={reservePath.line} fill="none" stroke={MON.accentDark} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
            {reservePath.min && <circle cx={reservePath.min.x} cy={reservePath.min.y} r={3.2} fill={STATE_COLOR.stress} />}
            {reservePath.max && <circle cx={reservePath.max.x} cy={reservePath.max.y} r={3.2} fill={STATE_COLOR.recovery} />}
          </svg>
        )}

        <svg
          viewBox={`0 0 ${W} ${height}`}
          preserveAspectRatio="none"
          className="w-full block rounded-md cursor-crosshair"
          style={{ height }}
          onMouseMove={(ev) => pick(ev.clientX, ev.currentTarget)}
          onMouseLeave={() => setPicked(null)}
          onClick={(ev) => pick(ev.clientX, ev.currentTarget)}
          role="img"
          aria-label="Timeline degli stati"
        >
          <defs>
            <pattern id="mon-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke={MON.borderMedium} strokeWidth="1.2" />
            </pattern>
          </defs>
          <rect x={0} y={0} width={W} height={height} fill={STATE_COLOR.invalid} />
          {runs.map((r, i) => (
            <rect
              key={i}
              x={r.x0}
              y={0}
              width={Math.max(0.8, r.x1 - r.x0)}
              height={height}
              fill={r.state === 'invalid' ? 'url(#mon-hatch)' : STATE_COLOR[r.state]}
            />
          ))}
          {night && (
            <>
              <line x1={x(night.night_start)} x2={x(night.night_end)} y1={1.5} y2={1.5} stroke={MON.accentDark} strokeWidth={3} />
              <line x1={x(night.night_start)} x2={x(night.night_end)} y1={height - 1.5} y2={height - 1.5} stroke={MON.accentDark} strokeWidth={3} />
            </>
          )}
          {picked && (
            <line x1={x(picked.s) + 0.4} x2={x(picked.s) + 0.4} y1={0} y2={height} stroke={MON.textPrimary} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        <div className="relative h-4 mt-1 text-[10px] text-anthracite-lighter">
          {ticks.map((t) => (
            <span key={t.label + t.x} className="absolute -translate-x-1/2" style={{ left: `${(t.x / W) * 100}%` }}>
              <span className="block w-px h-1 bg-surface-border mx-auto" />
              {t.label}
            </span>
          ))}
        </div>

        <div className="mt-2 min-h-[28px]">
          {picked ? (
            <div className="inline-block px-2.5 py-1.5 rounded-lg text-[11px] font-medium" style={{ backgroundColor: MON.accentLight, color: MON.accentDark }}>
              {pickedLabel(picked, tz)}
            </div>
          ) : (
            <div className="text-[10.5px] text-anthracite-lighter">Passa il mouse (o tocca) sulla barra per leggere ora e valori di quel minuto.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function pickedLabel(p: MonitoringWindow, tz: number): string {
  const when = `${hm(p.s, tz)}–${hm(p.e, tz)}`
  if (!p.valid) return `${when} · dato non valido (fascia staccata o segnale disturbato)`
  return `${when} · ${STATE_LABEL[p.state]} · HR ${p.hr == null ? '—' : Math.round(p.hr)} bpm · RMSSD ${p.rmssd == null ? '—' : Math.round(p.rmssd)} ms${p.br == null ? '' : ` · respiro ~${Math.round(p.br)}/min`}`
}

/** Legenda degli stati (MonitoringStateLegend). */
export function StateLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-1 ${compact ? 'text-[10px]' : 'text-[11px]'} text-anthracite-lighter`}>
      {STATE_ORDER.map((s) => (
        <span key={s} className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: STATE_COLOR[s], border: s === 'invalid' ? `1px solid ${MON.borderMedium}` : undefined }} />
          {STATE_LABEL[s]}
        </span>
      ))}
    </div>
  )
}
