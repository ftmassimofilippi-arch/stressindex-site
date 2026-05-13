// Helper di formattazione condivisi
import { differenceInDays, format, formatDistanceToNow, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

export function formatDate(date: string | Date, fmt = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt, { locale: it })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, "dd MMM yyyy 'alle' HH:mm", { locale: it })
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'HH:mm', { locale: it })
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(d, { locale: it, addSuffix: true })
}

export function daysSince(date: string | Date | null | undefined): number | null {
  if (!date) return null
  const d = typeof date === 'string' ? parseISO(date) : date
  return differenceInDays(new Date(), d)
}

export function formatGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Buonanotte'
  if (hour < 12) return 'Buongiorno'
  if (hour < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

export function fullName(p?: { nome?: string | null; cognome?: string | null } | null): string {
  if (!p) return ''
  return [p.nome, p.cognome].filter(Boolean).join(' ').trim()
}

export function initials(p?: { nome?: string | null; cognome?: string | null } | null): string {
  if (!p) return '?'
  const a = (p.nome || '').charAt(0).toUpperCase()
  const b = (p.cognome || '').charAt(0).toUpperCase()
  return (a + b) || '?'
}

export function age(birthDate?: string | null): number | null {
  if (!birthDate) return null
  const today = new Date()
  const d = parseISO(birthDate)
  let years = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) years--
  return years
}

export function num(value?: number | null, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toFixed(digits)
}

export function pct(value?: number | null): string {
  if (value === null || value === undefined) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function todayLongIt(): string {
  return format(new Date(), "EEEE d MMMM yyyy", { locale: it })
}
