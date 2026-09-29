import { useTranslations } from 'next-intl'
import {
  measurementTypeDescription,
  measurementTypeLabel,
  measurementTypeMeta,
  measurementTypeShortLabel,
} from '@/lib/measurement-type'

// Badge del tipo di misurazione (Misurazione standard, Test ortostatico,
// Respirazione di coerenza, test sport...). `dot` mostra una variante compatta
// con solo pallino colorato + testo, adatta alle righe fitte della tabella
// misurazioni; nelle varianti compatte (`dot`, `size="sm"`) si usa la forma
// breve del nome ("Standard", "Ortostatico", "Coerenza").
export function MeasurementTypeBadge({
  testType,
  size = 'md',
  dot = false,
}: {
  testType: string | null | undefined
  size?: 'sm' | 'md'
  dot?: boolean
}) {
  const t = useTranslations('measurement.types')
  const meta = measurementTypeMeta(testType)
  const compact = dot || size === 'sm'
  const label = compact ? measurementTypeShortLabel(testType, t) : measurementTypeLabel(testType, t)
  if (dot) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-anthracite">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.dotColor }} />
        {label}
      </span>
    )
  }
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${pad} ${meta.badgeClass}`}
      title={measurementTypeDescription(testType, t)}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.dotColor }} />
      {label}
    </span>
  )
}
