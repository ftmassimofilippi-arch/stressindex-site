import type { CosinorSummary, HourPattern, MseSummary, PrsaSummary, TimeToMinHr } from '@/lib/monitoring-types'
import { MON, STATE_COLOR, wallDate } from '@/lib/monitoring-format'

// Grafici della pagina "Ritmo e complessità" e della Notte (painter dell'app
// resi in SVG): cosinor sui dati orari, curva MSE, curve PRSA, discesa HR.

const AX = { fontSize: 9, fill: MON.textSecondary }

/** Cosinor: punti orari (mediane) e sinusoide stimata, con MESOR, acrofase (rosso) e batifase (verde). */
export function CosinorChart({ hours, fit, tz, pick, height = 180 }: { hours: HourPattern[]; fit: CosinorSummary; tz: number; pick: (h: HourPattern) => number | null; height?: number }) {
  const W = 1000
  const left = 40, bottom = 18, top = 8
  const plotW = W - left, plotH = height - bottom - top
  const pts = hours
    .map((h) => {
      const v = pick(h)
      const d = wallDate(h.h, tz)
      return v == null || !d ? null : { t: d.getUTCHours() + d.getUTCMinutes() / 60 + 0.5, v }
    })
    .filter((p): p is { t: number; v: number } => p != null)
  if (pts.length === 0 || fit.mesor == null || fit.amp == null || fit.acro == null) return null
  let vMin = Math.min(...pts.map((p) => p.v), fit.mesor - fit.amp)
  let vMax = Math.max(...pts.map((p) => p.v), fit.mesor + fit.amp)
  if (vMax - vMin < 1e-6) { vMax += 1; vMin -= 1 }
  const pad = (vMax - vMin) * 0.1
  vMin -= pad; vMax += pad
  const x = (clock: number) => left + (clock / 24) * plotW
  const y = (v: number) => top + plotH - ((v - vMin) / (vMax - vMin)) * plotH
  const sine = Array.from({ length: 97 }, (_, i) => {
    const t = i / 4
    const v = fit.mesor! + fit.amp! * Math.cos((2 * Math.PI * (t - fit.acro!)) / 24)
    return `${i === 0 ? 'M' : 'L'}${x(t).toFixed(1)},${y(v).toFixed(1)}`
  }).join(' ')
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full min-w-[520px] block" style={{ height }} role="img" aria-label="Orologio interno: cosinor">
        {[0, 1, 2, 3, 4].map((i) => {
          const v = vMin + ((vMax - vMin) * i) / 4
          return (
            <g key={i}>
              <line x1={left} x2={W} y1={y(v)} y2={y(v)} stroke={MON.borderLight} />
              <text x={0} y={y(v) + 3} {...AX}>{v >= 100 ? Math.round(v) : v.toFixed(1)}</text>
            </g>
          )
        })}
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
          <text key={h} x={x(h) - 6} y={top + plotH + 13} {...AX}>{String(h).padStart(2, '0')}</text>
        ))}
        <path d={sine} fill="none" stroke={MON.accent} strokeWidth={2} />
        <line x1={left} x2={W} y1={y(fit.mesor)} y2={y(fit.mesor)} stroke={MON.accent} strokeOpacity={0.5} />
        <line x1={x(fit.acro % 24)} x2={x(fit.acro % 24)} y1={top} y2={top + plotH} stroke={STATE_COLOR.stress} strokeWidth={1.2} />
        {fit.bathy != null && <line x1={x(fit.bathy % 24)} x2={x(fit.bathy % 24)} y1={top} y2={top + plotH} stroke={STATE_COLOR.recovery} strokeWidth={1.2} />}
        {pts.map((p, i) => <circle key={i} cx={x(p.t)} cy={y(p.v)} r={2.8} fill={MON.accentDark} />)}
      </svg>
    </div>
  )
}

/** Curva MSE: SampEn per scala 1..20 con l'area (Complexity Index). */
export function MseChart({ mse, height = 130 }: { mse: MseSummary; height?: number }) {
  const W = 500
  const left = 30, bottom = 16, top = 6
  const plotW = W - left, plotH = height - bottom - top
  const vals = mse.e
  const present = vals.filter((v): v is number => v != null)
  if (present.length === 0) return null
  const vMax = Math.max(0.5, Math.max(...present) * 1.15)
  const x = (scale: number) => left + ((scale - 1) / Math.max(1, vals.length - 1)) * plotW
  const y = (v: number) => top + plotH - (v / vMax) * plotH
  let line = ''
  let area = `M${x(1)},${y(0)} `
  vals.forEach((v, i) => {
    if (v == null) return
    line += `${line ? 'L' : 'M'}${x(i + 1).toFixed(1)},${y(v).toFixed(1)} `
    area += `L${x(i + 1).toFixed(1)},${y(v).toFixed(1)} `
  })
  area += `L${x(vals.length)},${y(0)} Z`
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full block" style={{ height }} role="img" aria-label="Curva MSE">
      {[0, 1, 2, 3].map((i) => {
        const v = (vMax * i) / 3
        return (
          <g key={i}>
            <line x1={left} x2={W} y1={y(v)} y2={y(v)} stroke={MON.borderLight} />
            <text x={0} y={y(v) + 3} {...AX}>{v.toFixed(1)}</text>
          </g>
        )
      })}
      <path d={area} fill={MON.accent} fillOpacity={0.15} />
      <path d={line} fill="none" stroke={MON.accentDark} strokeWidth={2} />
      {vals.map((v, i) => v == null ? null : <circle key={i} cx={x(i + 1)} cy={y(v)} r={2.4} fill={MON.accentDark} />)}
      {vals.map((_, i) => ((i + 1) % 5 === 0 || i === 0) ? <text key={`t${i}`} x={x(i + 1) - 4} y={top + plotH + 12} {...AX}>{i + 1}</text> : null)}
    </svg>
  )
}

/** Curve PRSA medie di decelerazione (verde) e accelerazione (rosso) attorno all'ancoraggio. */
export function PrsaChart({ prsa, height = 130 }: { prsa: PrsaSummary; height?: number }) {
  const W = 500
  const left = 40, bottom = 14, top = 6
  const plotW = W - left, plotH = height - bottom - top
  const d = prsa.curve_dec.map((v) => v ?? 0), a = prsa.curve_acc.map((v) => v ?? 0)
  if (d.length < 4 || a.length < 4) return null
  const all = [...d, ...a]
  let vMin = Math.min(...all), vMax = Math.max(...all)
  if (vMax - vMin < 1e-6) { vMax += 1; vMin -= 1 }
  const pad = (vMax - vMin) * 0.15
  vMin -= pad; vMax += pad
  const n = d.length
  const L = Math.floor(n / 2)
  const x = (k: number) => left + (k / (n - 1)) * plotW
  const y = (v: number) => top + plotH - ((v - vMin) / (vMax - vMin)) * plotH
  const path = (c: number[]) => c.map((v, k) => `${k === 0 ? 'M' : 'L'}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full block" style={{ height }} role="img" aria-label="Curve PRSA">
      <line x1={x(L)} x2={x(L)} y1={top} y2={top + plotH} stroke={MON.borderMedium} />
      <path d={path(d)} fill="none" stroke={STATE_COLOR.recovery} strokeWidth={1.8} />
      <path d={path(a)} fill="none" stroke={STATE_COLOR.stress} strokeWidth={1.8} />
      <text x={0} y={top + 8} {...AX}>{Math.round(vMax)} ms</text>
      <text x={0} y={top + plotH} {...AX}>{Math.round(vMin)} ms</text>
      <text x={left} y={top + plotH + 11} {...AX}>−{L}</text>
      <text x={x(L) - 2} y={top + plotH + 11} {...AX}>0</text>
      <text x={W - 16} y={top + plotH + 11} {...AX}>+{L}</text>
    </svg>
  )
}

/** Curva di discesa della HR notturna (C8). */
export function DescentChart({ ttm, height = 100 }: { ttm: TimeToMinHr; height?: number }) {
  const pts = ttm.descent.filter((p): p is [number, number] => p[1] != null)
  if (pts.length < 2) return null
  const W = 500
  const left = 30, bottom = 14, top = 4
  const plotW = W - left, plotH = height - bottom - top
  const mMax = Math.max(pts[pts.length - 1][0], 10)
  let vMin = Math.min(...pts.map((p) => p[1])), vMax = Math.max(...pts.map((p) => p[1]))
  if (vMax - vMin < 1) { vMax += 1; vMin -= 1 }
  const x = (m: number) => left + (m / mMax) * plotW
  const y = (v: number) => top + plotH - ((v - vMin) / (vMax - vMin)) * plotH
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full block" style={{ height }} role="img" aria-label="Curva di discesa della frequenza cardiaca">
      <path d={path} fill="none" stroke={MON.accentDark} strokeWidth={2} />
      <circle cx={x(last[0])} cy={y(last[1])} r={3.5} fill={STATE_COLOR.recovery} />
      <text x={0} y={top + 8} {...AX}>{Math.round(vMax)}</text>
      <text x={0} y={top + plotH} {...AX}>{Math.round(vMin)}</text>
      <text x={left} y={top + plotH + 11} {...AX}>0 min</text>
      <text x={W - 40} y={top + plotH + 11} {...AX}>{mMax} min</text>
    </svg>
  )
}
