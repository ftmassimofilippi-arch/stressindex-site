'use client'

type Props = {
  label: string
  value?: number | null // 0–100
  inverted?: boolean // se true: 100 = peggio (es. Stress)
  size?: 'sm' | 'md' | 'lg'
}

function colorFor(score: number, inverted = false): string {
  const v = inverted ? 100 - score : score
  if (v >= 70) return '#10B981' // emerald
  if (v >= 50) return '#4FA39A' // teal
  if (v >= 30) return '#F59E0B' // amber
  return '#EF4444' // red
}

export function ScoreGauge({ label, value, inverted = false, size = 'md' }: Props) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value))
  const hasValue = value != null
  const stroke = colorFor(v, inverted)

  const radius = size === 'lg' ? 56 : size === 'sm' ? 36 : 48
  const strokeWidth = size === 'lg' ? 10 : size === 'sm' ? 6 : 8
  const cx = radius + strokeWidth
  const cy = radius + strokeWidth
  const total = 2 * Math.PI * radius
  const arc = total * 0.75
  const offset = arc - (arc * v) / 100
  const svgSize = (radius + strokeWidth) * 2

  return (
    <div className="card p-5 flex flex-col items-center">
      <div className="text-xs font-medium text-anthracite-lighter uppercase tracking-wide">{label}</div>
      <div className="relative mt-2" style={{ width: svgSize, height: svgSize * 0.85 }}>
        <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`} className="-rotate-[135deg]">
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke="#E2E6EA"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${arc} ${total}`}
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={hasValue ? stroke : '#E2E6EA'}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${arc} ${total}`}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pt-2">
          <div className="text-center">
            <div className="text-3xl font-serif text-anthracite leading-none">
              {hasValue ? Math.round(v) : '—'}
            </div>
            <div className="text-[10px] text-anthracite-lighter mt-0.5">/ 100</div>
          </div>
        </div>
      </div>
    </div>
  )
}
