import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { useTranslations } from 'next-intl'

type Severity = 'low' | 'medium' | 'high'

// L'etichetta (Alta / Media / Bassa) viene da `alerts.severity.<severity>`.
const STYLE: Record<Severity, { bg: string; text: string; ring: string; Icon: typeof AlertTriangle }> = {
  high: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-100', Icon: AlertCircle },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-100', Icon: AlertTriangle },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-100', Icon: Info },
}

export function AlertBadge({ severity, withLabel = false }: { severity: Severity; withLabel?: boolean }) {
  const t = useTranslations('alerts.severity')
  const s = STYLE[severity]
  const Icon = s.Icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      <Icon size={12} />
      {withLabel && t(severity)}
    </span>
  )
}

export function CountBadge({ count, tone = 'red' }: { count: number; tone?: 'red' | 'teal' | 'amber' }) {
  if (!count) return null
  const map = {
    red: 'bg-red-100 text-red-700',
    teal: 'bg-teal-light text-teal-dark',
    amber: 'bg-amber-100 text-amber-700',
  } as const
  return (
    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold ${map[tone]}`}>
      {count}
    </span>
  )
}
