import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

type Props = {
  label: string
  value: string | number
  unit?: string
  trend?: number | null // % variazione
  hint?: string
  inverted?: boolean // true se valore basso = positivo
}

export function MetricCard({ label, value, unit, trend, hint, inverted }: Props) {
  const trendColor = trend == null
    ? 'text-anthracite-lighter'
    : (inverted ? trend < 0 : trend > 0) ? 'text-emerald-600' : (trend === 0 ? 'text-anthracite-lighter' : 'text-red-500')

  const TrendIcon = trend == null ? Minus : trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus

  return (
    <div className="card p-5">
      <div className="text-xs font-medium text-anthracite-lighter uppercase tracking-wide">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-serif text-anthracite">{value}</span>
        {unit && <span className="text-sm text-anthracite-lighter">{unit}</span>}
      </div>
      {(trend != null || hint) && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          {trend != null && (
            <span className={`flex items-center gap-0.5 font-medium ${trendColor}`}>
              <TrendIcon size={14} />
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {hint && <span className="text-anthracite-lighter">{hint}</span>}
        </div>
      )}
    </div>
  )
}
