import { useLocale, useTranslations } from 'next-intl'
import { Bed, Clock, Infinity as InfinityIcon, Moon, Sun, SunMoon, Wifi, type LucideIcon } from 'lucide-react'
import type { MonitoringType, RecordingProfile } from '@/lib/monitoring-types'
import {
  LEVEL_COLOR,
  MON,
  artifactColor,
  coverageColor,
  fmtNum,
  levelLabel,
  profileLabel,
  signalQualityColor,
  signalQualityLabel,
  typeChip,
  type IndexLevel,
} from '@/lib/monitoring-format'

// Chip colorato con testo, come MonitoringChip dell'app: sfondo al 14 %,
// bordo al 45 %, testo pieno. Componenti senza stato: usabili sia lato
// server sia lato client. Il testo viene troncato se il contenitore è
// stretto (il tedesco è più lungo).

type ChipProps = {
  label: string
  color: string
  icon?: LucideIcon
  title?: string
  size?: 'sm' | 'md'
  className?: string
}

export function Chip({ label, color, icon: Icon, title, size = 'md', className = '' }: ChipProps) {
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-[11px]'
  return (
    <span
      title={title ?? label}
      className={`inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap border max-w-full min-w-0 ${pad} ${className}`}
      style={{ color, backgroundColor: `${color}24`, borderColor: `${color}73` }}
    >
      {Icon && <Icon size={size === 'sm' ? 11 : 13} className="flex-shrink-0" />}
      <span className="truncate">{label}</span>
    </span>
  )
}

export function TypeChip({ type, size }: { type: MonitoringType; size?: 'sm' | 'md' }) {
  const t = useTranslations('monitoring')
  const sleep = type === 'sleep'
  return <Chip label={typeChip(type, t)} color={sleep ? MON.sleep : MON.accent} icon={sleep ? Bed : SunMoon} size={size} />
}

const PROFILE_ICON: Record<RecordingProfile, LucideIcon> = {
  breve: Clock,
  giornata: Sun,
  notte: Moon,
  giorno_notte: SunMoon,
  ciclo_completo: InfinityIcon,
}

export function ProfileChip({ profile, estimated, size }: { profile: RecordingProfile; estimated?: boolean; size?: 'sm' | 'md' }) {
  const t = useTranslations('monitoring')
  const locale = useLocale()
  return (
    <Chip
      label={`${profileLabel(profile, locale)}${estimated ? ' *' : ''}`}
      color={MON.accentDark}
      icon={PROFILE_ICON[profile]}
      size={size}
      title={estimated ? t('chips.estimatedProfileTitle') : undefined}
    />
  )
}

export function QualityChip({ quality, coverage, size }: { quality: string | null; coverage: number | null; size?: 'sm' | 'md' }) {
  const t = useTranslations('monitoring')
  return (
    <span className="inline-flex flex-wrap items-center gap-1 min-w-0">
      <Chip label={signalQualityLabel(quality, t)} color={signalQualityColor(quality)} icon={Wifi} size={size} />
      {coverage != null && <Chip label={t('validDataPct', { pct: Math.round(coverage) })} color={coverageColor(coverage)} size={size} />}
    </span>
  )
}

export function ArtifactChip({ pct, size }: { pct: number | null; size?: 'sm' | 'md' }) {
  const t = useTranslations('monitoring')
  const locale = useLocale()
  if (pct == null) return null
  return <Chip label={t('artifactsPct', { pct: fmtNum(pct, 1, locale) })} color={artifactColor(pct)} size={size} />
}

export function LevelChip({ level, size }: { level: IndexLevel; size?: 'sm' | 'md' }) {
  const locale = useLocale()
  return <Chip label={levelLabel(level, locale)} color={LEVEL_COLOR[level]} size={size} />
}

/** Titolo di sezione con il colore accento del modulo. */
export function SectionTitle({ children, sleep, sub }: { children: React.ReactNode; sleep?: boolean; sub?: string }) {
  return (
    <div className="mb-3 min-w-0">
      <h2 className="font-serif text-lg break-words" style={{ color: sleep ? MON.sleepDark : MON.accentDark }}>{children}</h2>
      {sub && <p className="text-xs text-anthracite-lighter mt-0.5">{sub}</p>}
    </div>
  )
}
