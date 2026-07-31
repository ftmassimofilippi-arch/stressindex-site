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
//
// Due convenzioni convivono nel database, distinte da `tz_offset_minutes`:
//
//   NULL          Riga scritta da una build PRE-FIX dell'app. `measured_at` /
//                 `started_at` contengono l'ora LOCALE del dispositivo con
//                 l'etichetta `+00`: l'app serializzava `DateTime.now()` senza
//                 `.toUtc()` e Postgres rileggeva i componenti come UTC.
//                 L'istante REALE si ottiene reinterpretando quei componenti
//                 nel fuso italiano.
//   valorizzato   Riga scritta da una build POST-FIX. Il timestamp è già
//                 l'istante UTC corretto, e il valore è l'offset del
//                 dispositivo al momento della misurazione.
//
// Il database espone anche le colonne normalizzate `measured_at_utc` /
// `started_at_utc`, mantenute da trigger (vedi tz_normalized_columns.sql):
// quando ci sono si usano direttamente, ed è la strada preferita perché la
// regola vive in un punto solo. Il ramo di calcolo qui sotto serve per le righe
// che arrivano da query che non le selezionano.
//
// ⚠️ ORDINAMENTI E FILTRI PER INTERVALLO non passano da qui: avvengono dentro
// Postgres e devono usare le colonne `_utc`. Vedi i commenti in dashboard-data.ts.
//
// Questo modulo è un DEBITO A TERMINE: si rimuove quando lo storico è corretto
// e nessuna build pre-fix è più attiva. Vedi docs/debiti-tecnici.md nel repo
// dell'app, voce "Ramo legacy della convenzione oraria".

const FUSO = 'Europe/Rome'

// Componenti calendariali di un istante nel fuso italiano. `Intl` con
// `timeZone` esplicito dà lo stesso risultato lato server (UTC) e lato browser,
// quindi non ci sono disallineamenti di idratazione.
function parteFuso(instant: Date): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant)
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return { y: n('year'), mo: n('month'), d: n('day'), h: n('hour') % 24, mi: n('minute'), s: n('second') }
}

// Offset del fuso italiano, in minuti, all'istante dato.
function offsetFuso(instant: Date): number {
  const p = parteFuso(instant)
  const comeUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s)
  return (comeUtc - instant.getTime()) / 60000
}

// Inverso di `parteFuso`: dai componenti di un orologio da parete italiano
// all'istante reale. Due passate perché l'offset dipende dall'istante che
// stiamo cercando — la seconda risolve i confini di ora legale.
function daOraItaliana(wallUtcMs: number): Date {
  let off = offsetFuso(new Date(wallUtcMs))
  const primo = new Date(wallUtcMs - off * 60000)
  off = offsetFuso(primo)
  return new Date(wallUtcMs - off * 60000)
}

/**
 * Riga con quanto serve a stabilire l'istante reale.
 *
 * Copre le tre tabelle che portano timestamp scritti dal client:
 * `measurement_analytics` (measured_at), `sessions` (started_at) e
 * `sport_sessions` (start_time). Tutte hanno il marcatore `tz_offset_minutes` e
 * la colonna normalizzata corrispondente.
 */
export type ConIstante = {
  measured_at?: string | null
  measured_at_utc?: string | null
  started_at?: string | null
  started_at_utc?: string | null
  start_time?: string | null
  start_time_utc?: string | null
  tz_offset_minutes?: number | null
}

/**
 * Istante REALE della misurazione.
 *
 * Da usare prima di QUALSIASI confronto, massimo, ordinamento o differenza
 * rispetto a `Date.now()`. Non usare mai `new Date(row.measured_at)` diretto:
 * su una riga pre-fix è spostato di due ore.
 */
export function measuredInstant(row: ConIstante | null | undefined): Date | null {
  if (!row) return null
  // Preferenza alla colonna normalizzata dal database, se la query la seleziona.
  const gia = row.measured_at_utc ?? row.started_at_utc ?? row.start_time_utc
  if (gia) return new Date(gia)

  const grezzo = row.measured_at ?? row.started_at ?? row.start_time
  if (!grezzo) return null
  const d = new Date(grezzo)
  if (Number.isNaN(d.getTime())) return null

  // Convenzione nuova: il timestamp è già l'istante corretto.
  if (row.tz_offset_minutes != null) return d

  // Convenzione pre-fix: i componenti UTC sono l'orologio da parete italiano.
  return daOraItaliana(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
             d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()),
  )
}

// Date i cui componenti LOCALI coincidono con l'orologio da parete italiano
// dell'istante dato. Serve solo per passarla a `format` di date-fns senza
// cambiare il formato di output esistente.
function oraDaParete(instant: Date): Date {
  const p = parteFuso(instant)
  return new Date(p.y, p.mo - 1, p.d, p.h, p.mi, p.s)
}

export function formatMeasuredAt(row: ConIstante | null | undefined): string {
  const i = measuredInstant(row)
  return i ? format(oraDaParete(i), "dd MMM yyyy 'alle' HH:mm", { locale: it }) : '—'
}

export function formatMeasuredDate(row: ConIstante | null | undefined, fmt = 'dd MMM yyyy'): string {
  const i = measuredInstant(row)
  return i ? format(oraDaParete(i), fmt, { locale: it }) : '—'
}

export function formatMeasuredTime(row: ConIstante | null | undefined): string {
  const i = measuredInstant(row)
  return i ? format(oraDaParete(i), 'HH:mm', { locale: it }) : '—'
}

/**
 * Giorno di calendario italiano della misurazione, come 'YYYY-MM-DD'.
 *
 * Sostituisce `measured_at.slice(0, 10)`, che prende la data dalla stringa
 * grezza: oggi coincide con la data locale solo perché il valore è spostato,
 * e smetterebbe di coincidere sulle righe della convenzione nuova.
 */
export function measuredDayKey(row: ConIstante | null | undefined): string | null {
  const i = measuredInstant(row)
  if (!i) return null
  const p = parteFuso(i)
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

/** Ora del giorno (0-23) italiana della misurazione. */
export function measuredHour(row: ConIstante | null | undefined): number | null {
  const i = measuredInstant(row)
  return i ? parteFuso(i).h : null
}

/** Giorno della settimana italiano, 0 = lunedì. */
export function measuredWeekday(row: ConIstante | null | undefined): number | null {
  const i = measuredInstant(row)
  if (!i) return null
  const p = parteFuso(i)
  return (new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay() + 6) % 7
}

/**
 * Formatta un istante GIÀ normalizzato (uscito da `measuredInstant`), nel fuso
 * italiano. Per i valori grezzi di database usare `formatMeasured*`.
 */
export function formatIstante(d: Date | string | null | undefined, fmt = 'dd MMM yyyy'): string {
  if (!d) return '—'
  const i = typeof d === 'string' ? new Date(d) : d
  return Number.isNaN(i.getTime()) ? '—' : format(oraDaParete(i), fmt, { locale: it })
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

// Coercizione numerica sicura per i valori che arrivano dal database.
// I tipi TypeScript dichiarano `number | null`, ma a runtime può arrivare altro:
// le colonne Postgres `text`/`numeric` sono serializzate come STRINGA da
// PostgREST, e i campi dentro le colonne jsonb hanno il tipo che ci ha scritto
// l'app Flutter. Un `.toFixed()` diretto su quei valori è un TypeError che
// abbatte l'intera pagina — caso reale in produzione:
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

export function num(value?: unknown, digits = 1): string {
  const n = toNum(value)
  return n === null ? '—' : n.toFixed(digits)
}

export function pct(value?: unknown): string {
  const n = toNum(value)
  if (n === null) return '—'
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}

export function todayLongIt(): string {
  return format(new Date(), "EEEE d MMMM yyyy", { locale: it })
}
