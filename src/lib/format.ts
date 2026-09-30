// Helper di formattazione condivisi
//
// Tutte le funzioni accettano una `locale` finale facoltativa ('it' | 'en' | 'de').
// Se omessa vale l'italiano: nei componenti si passa SEMPRE `useLocale()` (client)
// o `await getLocale()` (server), così date e numeri seguono la lingua della
// pagina (it-IT, en-US, de-DE). I formati di default usano `Intl`; chi passa un
// pattern `fmt` esplicito continua a usare date-fns con la locale giusta.
import { differenceInDays, format, formatDistanceToNow, parseISO } from 'date-fns'
import { it, enUS, de } from 'date-fns/locale'
import type { Locale as DateFnsLocale } from 'date-fns'
import type { Tr } from '@/i18n/types'
import { defaultLocale, intlLocale, isLocale, type Locale } from '@/i18n/routing'
import { FUSO, measuredInstant, oraDaParete, type ConIstante } from './measured-time'

function loc(locale?: string): Locale {
  return isLocale(locale) ? locale : defaultLocale
}

const DF: Record<Locale, DateFnsLocale> = { it, en: enUS, de }

export function dateFnsLocale(locale?: string): DateFnsLocale {
  return DF[loc(locale)]
}

/** Tag BCP 47 per `Intl` (it-IT, en-US, de-DE). */
export function intlTag(locale?: string): string {
  return intlLocale[loc(locale)]
}

function intlDate(d: Date, locale: string | undefined, opts: Intl.DateTimeFormatOptions, tz?: string): string {
  return new Intl.DateTimeFormat(intlTag(locale), { ...opts, ...(tz ? { timeZone: tz } : {}) }).format(d)
}

const OPT_DATE: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
const OPT_DATETIME: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
const OPT_TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }

/** Data breve (es. "29 set 2026" / "Sep 29, 2026" / "29. Sept. 2026"). Con `fmt` usa un pattern date-fns. */
export function formatDate(date: string | Date, fmt?: string, locale?: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (fmt) return format(d, fmt, { locale: dateFnsLocale(locale) })
  return intlDate(d, locale, OPT_DATE)
}

export function formatDateTime(date: string | Date, locale?: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return intlDate(d, locale, OPT_DATETIME)
}

export function formatTime(date: string | Date, locale?: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return intlDate(d, locale, OPT_TIME)
}

// ── Timestamp delle misurazioni ──────────────────────────────────────────────
//
// La regola oraria (da quale colonna si prende l'istante, dove cadono i confini
// di giornata italiana) vive in `measured-time.ts`: modulo senza dipendenze,
// coperto da `format.test.ts`. Qui restano solo i formattatori, che hanno
// bisogno della lingua. Si riesporta tutto perché i chiamanti continuano a
// importare da `@/lib/format`.
export {
  conIstanteSessione,
  fineGiornoIta,
  giornoItaFa,
  inizioGiornoIta,
  inizioGiornoItaFa,
  intervalloGiorniIta,
  measuredDayKey,
  measuredHour,
  measuredInstant,
  measuredWeekday,
  oggiIta,
  type ConIstante,
  type ConIstanteSessione,
} from './measured-time'

export function formatMeasuredAt(row: ConIstante | null | undefined, locale?: string): string {
  const i = measuredInstant(row)
  return i ? intlDate(i, locale, OPT_DATETIME, FUSO) : '—'
}

export function formatMeasuredDate(row: ConIstante | null | undefined, fmt?: string, locale?: string): string {
  const i = measuredInstant(row)
  if (!i) return '—'
  if (fmt) return format(oraDaParete(i), fmt, { locale: dateFnsLocale(locale) })
  return intlDate(i, locale, OPT_DATE, FUSO)
}

export function formatMeasuredTime(row: ConIstante | null | undefined, locale?: string): string {
  const i = measuredInstant(row)
  return i ? intlDate(i, locale, OPT_TIME, FUSO) : '—'
}

/**
 * Formatta un istante GIÀ normalizzato (uscito da `measuredInstant`), nel fuso
 * italiano. Per i valori grezzi di database usare `formatMeasured*`.
 */
export function formatIstante(d: Date | string | null | undefined, fmt?: string, locale?: string): string {
  if (!d) return '—'
  const i = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(i.getTime())) return '—'
  if (fmt) return format(oraDaParete(i), fmt, { locale: dateFnsLocale(locale) })
  return intlDate(i, locale, OPT_DATE, FUSO)
}

export function formatRelative(date: string | Date, locale?: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(d, { locale: dateFnsLocale(locale), addSuffix: true })
}

export function daysSince(date: string | Date | null | undefined): number | null {
  if (!date) return null
  const d = typeof date === 'string' ? parseISO(date) : date
  return differenceInDays(new Date(), d)
}

/** Saluto in base all'ora: le stringhe vengono dal namespace `dashboard.greeting`. */
export function formatGreeting(t: Tr): string {
  const hour = new Date().getHours()
  if (hour < 5) return t('night')
  if (hour < 12) return t('morning')
  if (hour < 18) return t('afternoon')
  return t('evening')
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

// Coercizione numerica sicura per i valori che arrivano dal database.
// I tipi TypeScript dichiarano `number | null`, ma a runtime può arrivare altro:
// le colonne Postgres `text`/`numeric` sono serializzate come STRINGA da
// PostgREST, e i campi dentro le colonne jsonb hanno il tipo che ci ha scritto
// l'app Flutter. Un `.toFixed()` diretto su quei valori è un TypeError che
// abbatte l'intera pagina, caso reale in produzione:
// measurement_analytics.signal_quality è `text` e contiene "good".
// Accetta solo number e string: booleani, array e oggetti danno null (Number([])
// varrebbe 0, che sarebbe peggio di "nessun dato").
export function toNum(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }
  return null
}

// Valore testuale non numerico (es. signal_quality): normalizza a string | null.
export function toStr(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() === '' ? null : value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

/** Numero con `digits` decimali nel formato della lingua (virgola in it/de, punto in en). */
export function num(value?: unknown, digits = 1, locale?: string): string {
  const n = toNum(value)
  if (n === null) return '—'
  return new Intl.NumberFormat(intlTag(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
}

/** Numero "grezzo" con i decimali, senza separatori di lingua (per chiavi, CSV, URL). */
export function numRaw(value?: unknown, digits = 1): string {
  const n = toNum(value)
  return n === null ? '—' : n.toFixed(digits)
}

export function pct(value?: unknown, locale?: string): string {
  const n = toNum(value)
  if (n === null) return '—'
  const s = new Intl.NumberFormat(intlTag(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)
  return `${n > 0 ? '+' : ''}${s}%`
}

/** Prezzo in euro nel formato della lingua: 49,90 € / €49.90 / 49,90 €. */
export function formatEur(value: number, locale?: string): string {
  return new Intl.NumberFormat(intlTag(locale), { style: 'currency', currency: 'EUR' }).format(value)
}

/** Data odierna per esteso (es. "martedì 29 settembre 2026"). */
export function todayLong(locale?: string): string {
  return intlDate(new Date(), locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
