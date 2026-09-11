import { Bed, Clock, Infinity as InfinityIcon, Moon, Sun, SunMoon, Wifi, type LucideIcon } from 'lucide-react'
import type { MonitoringType, RecordingProfile } from '@/lib/monitoring-types'
import {
  LEVEL_COLOR,
  LEVEL_LABEL,
  MON,
  PROFILE_LABEL,
  artifactColor,
  coverageColor,
  signalQualityColor,
  signalQualityLabel,
  typeChip,
  type IndexLevel,
} from '@/lib/monitoring-format'

// Chip colorato con testo, come MonitoringChip dell'app: sfondo al 14 %,
// bordo al 45 %, testo pieno. Componenti senza stato: usabili sia lato
// server sia lato client.

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
      title={title}
      className={`inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap border ${pad} ${className}`}
      style={{ color, backgroundColor: `${color}24`, borderColor: `${color}73` }}
    >
      {Icon && <Icon size={size === 'sm' ? 11 : 13} />}
      {label}
    </span>
  )
}

export function TypeChip({ type, size }: { type: MonitoringType; size?: 'sm' | 'md' }) {
  const sleep = type === 'sleep'
  return <Chip label={typeChip(type)} color={sleep ? MON.sleep : MON.accent} icon={sleep ? Bed : SunMoon} size={size} />
}

const PROFILE_ICON: Record<RecordingProfile, LucideIcon> = {
  breve: Clock,
  giornata: Sun,
  notte: Moon,
  giorno_notte: SunMoon,
  ciclo_completo: InfinityIcon,
}

export function ProfileChip({ profile, estimated, size }: { profile: RecordingProfile; estimated?: boolean; size?: 'sm' | 'md' }) {
  return (
    <Chip
      label={`${PROFILE_LABEL[profile]}${estimated ? ' *' : ''}`}
      color={MON.accentDark}
      icon={PROFILE_ICON[profile]}
      size={size}
      title={estimated ? 'Profilo stimato: la riga è stata analizzata con una versione precedente dell\'app e non porta il profilo. Derivato da durata e notte con la stessa regola dell\'app.' : undefined}
    />
  )
}

export function QualityChip({ quality, coverage, size }: { quality: string | null; coverage: number | null; size?: 'sm' | 'md' }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Chip label={signalQualityLabel(quality)} color={signalQualityColor(quality)} icon={Wifi} size={size} />
      {coverage != null && <Chip label={`Dati validi ${Math.round(coverage)}%`} color={coverageColor(coverage)} size={size} />}
    </span>
  )
}

export function ArtifactChip({ pct, size }: { pct: number | null; size?: 'sm' | 'md' }) {
  if (pct == null) return null
  return <Chip label={`Artefatti ${pct.toFixed(1)}%`} color={artifactColor(pct)} size={size} />
}

export function LevelChip({ level, size }: { level: IndexLevel; size?: 'sm' | 'md' }) {
  return <Chip label={LEVEL_LABEL[level]} color={LEVEL_COLOR[level]} size={size} />
}

/** Titolo di sezione con il colore accento del modulo. */
export function SectionTitle({ children, sleep, sub }: { children: React.ReactNode; sleep?: boolean; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-serif text-lg" style={{ color: sleep ? MON.sleepDark : MON.accentDark }}>{children}</h2>
      {sub && <p className="text-xs text-anthracite-lighter mt-0.5">{sub}</p>}
    </div>
  )
}
