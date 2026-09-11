import type { MonitoringNight } from '@/lib/monitoring-types'
import { MON, STATE_COLOR, hm } from '@/lib/monitoring-format'

// Grafico della notte (MonitoringNightChart dell'app): barre orarie di RMSSD
// su sfondo colorato per stato prevalente dell'ora, linea HR sovrapposta.
export function MonitoringNightChart({ night, tz, height = 190 }: { night: MonitoringNight; tz: number; height?: number }) {
  const hours = night.hourly ?? []
  if (hours.length === 0) return <div className="text-sm text-anthracite-lighter">Nessuna ora con dati.</div>
  const W = 1000
  const left = 34, right = 34, top = 8, bottom = 18
  const plotW = W - left - right
  const plotH = height - top - bottom
  const n = hours.length
  const colW = plotW / n
  const rmssdMax = Math.max(20, Math.max(...hours.map((h) => h.rmssd ?? 0)) * 1.15)
  const hrVals = hours.map((h) => h.mean_hr).filter((v): v is number => v != null)
  const hrMin = hrVals.length ? Math.floor(Math.min(...hrVals) - 5) : 40
  const hrMax = hrVals.length ? Math.ceil(Math.max(...hrVals) + 5) : 80
  const yHr = (v: number) => top + plotH - ((v - hrMin) / Math.max(1, hrMax - hrMin)) * plotH
  const segments: string[] = []
  let cur = ''
  hours.forEach((h, i) => {
    if (h.mean_hr == null) { if (cur) segments.push(cur); cur = ''; return }
    const px = left + i * colW + colW / 2
    cur += `${cur ? 'L' : 'M'}${px.toFixed(1)},${yHr(h.mean_hr).toFixed(1)} `
  })
  if (cur) segments.push(cur)

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full min-w-[520px] block" style={{ height }} role="img" aria-label="RMSSD per ora e frequenza cardiaca della notte">
        {hours.map((h, i) => (
          <rect key={`bg${i}`} x={left + i * colW} y={top} width={colW} height={plotH} fill={STATE_COLOR[h.state]} fillOpacity={0.18} />
        ))}
        {hours.map((h, i) => {
          if (h.rmssd == null) return null
          const bh = (h.rmssd / rmssdMax) * plotH
          return <rect key={`b${i}`} x={left + i * colW + colW * 0.2} y={top + plotH - bh} width={colW * 0.6} height={bh} rx={3} fill={MON.accent} />
        })}
        {segments.map((d, i) => <path key={`l${i}`} d={d} fill="none" stroke={STATE_COLOR.stress} strokeWidth={2} />)}
        {hours.map((h, i) => h.mean_hr == null ? null : (
          <circle key={`c${i}`} cx={left + i * colW + colW / 2} cy={yHr(h.mean_hr)} r={2.5} fill={STATE_COLOR.stress} />
        ))}
        <text x={0} y={top + 8} fontSize={9} fill={MON.accent}>RMSSD</text>
        <text x={0} y={top + 20} fontSize={9} fill={MON.textMuted}>{Math.round(rmssdMax)}</text>
        <text x={0} y={top + plotH} fontSize={9} fill={MON.textMuted}>0</text>
        <text x={W - right + 4} y={top + 8} fontSize={9} fill={STATE_COLOR.stress}>HR</text>
        <text x={W - right + 4} y={top + 20} fontSize={9} fill={MON.textMuted}>{hrMax}</text>
        <text x={W - right + 4} y={top + plotH} fontSize={9} fill={MON.textMuted}>{hrMin}</text>
        {hours.map((h, i) => (n > 8 && i % 2 === 1) ? null : (
          <text key={`t${i}`} x={left + i * colW + 2} y={top + plotH + 12} fontSize={9} fill={MON.textMuted}>{hm(h.hour_start, tz)}</text>
        ))}
      </svg>
    </div>
  )
}
