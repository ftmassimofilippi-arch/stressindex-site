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

// ── Timestamp delle misurazioni ──────────────────────────────────────────────
// L'app Flutter salva `started_at` (→ `measured_at`) da `DateTime.now()` SENZA
// `.toUtc()`: la stringa ISO non ha offset, quindi Postgres (timestamptz) la
// memorizza come se i componenti wall-clock fossero UTC. In pratica il valore
// salvato è l'ora LOCALE a cui è stata fatta la misurazione, etichettata `+00`.
// Riconvertirla al fuso del browser la sposterebbe in avanti (8:07 → 10:07 in
// estate): vogliamo invece mostrare verbatim l'orario a cui è avvenuta la
// misurazione. `wallClock` ricostruisce una Date i cui componenti LOCALI
// coincidono con i componenti UTC dell'istante salvato, così la formattazione
// è identica sia lato server (UTC) sia lato browser (Europe/Rome).
function wallClock(date: string | Date): Date {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
  )
}

export function formatMeasuredAt(date: string | Date): string {
  return format(wallClock(date), "dd MMM yyyy 'alle' HH:mm", { locale: it })
}

export function formatMeasuredDate(date: string | Date, fmt = 'dd MMM yyyy'): string {
  return format(wallClock(date), fmt, { locale: it })
}

export function formatMeasuredTime(date: string | Date): string {
  return format(wallClock(date), 'HH:mm', { locale: it })
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
