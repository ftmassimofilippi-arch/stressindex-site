type Props = {
  value?: number | null // 0–100
  inverted?: boolean // se true: 100 = peggio
  showValue?: boolean
}

function colorFor(score: number, inverted = false): string {
  const v = inverted ? 100 - score : score
  if (v >= 70) return 'bg-emerald-500'
  if (v >= 50) return 'bg-teal'
  if (v >= 30) return 'bg-amber-500'
  return 'bg-red-500'
}

export function ScoreBar({ value, inverted, showValue = true }: Props) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value))
  const hasValue = value != null
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 bg-surface-border/60 rounded-full overflow-hidden">
        {hasValue && (
          <div
            className={`h-full rounded-full ${colorFor(v, inverted)} transition-all duration-300`}
            style={{ width: `${v}%` }}
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
