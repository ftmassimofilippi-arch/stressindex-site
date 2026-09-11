import { Bed, Coffee, Dumbbell, Flower2, MoreHorizontal, Pill, Sun, Utensils, Wine, Zap, type LucideIcon } from 'lucide-react'
import type { MonitoringEventType } from '@/lib/monitoring-types'

// Icona per tipo di evento (MonitoringEventType.icon dell'app, resa con lucide).
const ICONS: Record<MonitoringEventType, LucideIcon> = {
  coffee: Coffee,
  meal: Utensils,
  alcohol: Wine,
  training: Dumbbell,
  stress: Zap,
  sleep_start: Bed,
  wake_up: Sun,
  supplement: Pill,
  relax: Flower2,
  other: MoreHorizontal,
}

export function EventIcon({ type, size = 14, className }: { type: MonitoringEventType; size?: number; className?: string }) {
  const Icon = ICONS[type] ?? MoreHorizontal
  return <Icon size={size} className={className} />
}
