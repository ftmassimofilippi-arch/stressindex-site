import { MON } from '@/lib/monitoring-format'

// Gauge semicircolare 0-100 (MonitoringGauge dell'app): arco di fondo a 20
// spicchi colorati con la scala, arco pieno fino al valore, numero grande,
// etichetta, estremi della scala e, se richiesto, il segno del centro (50).

type Props = {
  value: number | null | undefined
  title: string
  label: string
  colorFor: (v: number) => string
  leftLabel?: string
  rightLabel?: string
  centerMark?: boolean
  compact?: boolean
}

export function MonitoringGauge({ value, title, label, colorFor, leftLabel, rightLabel, centerMark = false, compact = false }: Props) {
  const v = value == null || !Number.isFinite(value) ? null : Math.max(0, Math.min(100, value))
  const color = v == null ? MON.textMuted : colorFor(v)
  const W = 200
  const H = 96
  const cx = W / 2
  const cy = H - 6
  const r = 78
  const stroke = 12
  const segments = 20
  const arc = (from: number, to: number) => {
    const a0 = Math.PI + from * Math.PI
    const a1 = Math.PI + to * Math.PI
    const p0 = { x: cx + r * Math.cos(a0), y: cy + r * Math.sin(a0) }
    const p1 = { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) }
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${to - from > 0.5 ? 1 : 0} 1 ${p1.x} ${p1.y}`
  }
  return (
    <div className={`card flex flex-col items-center ${compact ? 'p-3' : 'p-4'}`}>
      <div className="text-xs font-semibold text-anthracite-lighter text-center">{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[220px] mt-1" role="img" aria-label={`${title}: ${v == null ? 'non disponibile' : Math.round(v)}`}>
        {Array.from({ length: segments }, (_, i) => (
          <path
            key={i}
            d={arc(i / segments, (i + 1) / segments + 0.002)}
            stroke={colorFor(((i + 0.5) / segments) * 100)}
            strokeOpacity={0.28}
            strokeWidth={stroke}
            fill="none"
          />
        ))}
        {v != null && v > 0 && (
          <path d={arc(0, v / 100)} stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="none" />
        )}
        {centerMark && (
          <line x1={cx} x2={cx} y1={cy - r - stroke / 2 - 2} y2={cy - r + stroke / 2 + 2} stroke={MON.textPrimary} strokeOpacity={0.6} strokeWidth={2} />
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={30} fontWeight={800} fill={color}>
          {v == null ? '—' : Math.round(v)}
        </text>
      </svg>
      {(leftLabel || rightLabel) && (
        <div className="w-full max-w-[220px] flex justify-between text-[9.5px] text-anthracite-lighter -mt-1">
          <span>{leftLabel ?? ''}</span>
          <span>{rightLabel ?? ''}</span>
        </div>
      )}
      <div className="mt-1 text-xs font-bold text-center" style={{ color }}>{label}</div>
    </div>
  )
}
