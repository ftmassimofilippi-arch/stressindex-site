import { scoreZoneColor, type GaugeColorScheme } from '@/lib/gauge-zones'

type Props = {
  value?: number | null // 0–100
  /** Scala di colore dello score (fasce e colori di gauge-zones). Per lo score
   *  composito si passa `COMPOSITE_SCHEME` (scala positiva 25/45/65/85). */
  scheme?: GaugeColorScheme
  showValue?: boolean
}

export function ScoreBar({ value, scheme = 'recovery', showValue = true }: Props) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value))
  const hasValue = value != null
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 bg-surface-border/60 rounded-full overflow-hidden">
        {hasValue && (
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${v}%`, backgroundColor: scoreZoneColor(scheme, v) }}
          />
        )}
      </div>
      {showValue && (
        <span className="text-xs font-medium text-anthracite tabular-nums w-8 text-right">
          {hasValue ? Math.round(v) : '—'}
        </span>
      )}
    </div>
  )
}
