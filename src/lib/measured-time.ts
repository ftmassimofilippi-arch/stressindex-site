// =============================================================================
// L'istante di una misurazione, e i confini di giornata italiana
// =============================================================================
//
// Modulo VOLUTAMENTE senza dipendenze e senza alias `@/`: è il punto unico
// della regola oraria, lo importano sia i componenti server sia quelli client,
// ed è coperto da `format.test.ts` con `node --test`. La formattazione vera e
// propria (lingua, pattern) sta in `format.ts`, che riesporta tutto da qui.
//
// REGOLA UNICA: l'istante di una misurazione si legge SOLO dalle colonne `_utc`
// (`sessions.started_at_utc`, `sport_sessions.start_time_utc`,
// `measurement_analytics.measured_at_utc`). Le colonne senza suffisso non sono
// istanti: contengono l'orologio da parete italiano etichettato `+00`, quindi
// sono due ore avanti da aprile a ottobre.
//
// Perché `started_at` NON si usa mai. Il trigger `set_started_at_compat` su
// `sessions` tiene le due colonne così:
//   started_at      forma LEGACY (ora italiana etichettata UTC) su TUTTE le
//                   righe, anche quelle scritte dalle build nuove: il trigger
//                   la riscrive apposta perché le app vecchie continuino a
//                   leggerla.
//   started_at_utc  istante reale, su TUTTE le righe.
// Verificato in produzione il 30 settembre 2026: 3736 righe su 3736 hanno
// `started_at_utc` valorizzato e sfasato di +120 minuti rispetto a `started_at`.
// `tz_offset_minutes` NON distingue le due forme e non va usato per decidere.
//
// ⚠️ measurement_analytics.measured_at_utc NON è affidabile finché non viene
// applicata la migration 029. Il trigger di sincronizzazione (007) copia in
// `measured_at` la forma legacy di `sessions.started_at` portandosi dietro
// `tz_offset_minutes`, e `set_measured_at_utc` conclude che il valore è già
// UTC: 986 righe su 3736 hanno `measured_at_utc` due ore avanti (istante di
// misurazione successivo al proprio `created_at`, impossibile).
// Per questo, quando il chiamante ha in mano anche la riga `sessions`, si usa
// `conIstanteSessione()` e vince `started_at_utc`.
//
// ⚠️ ORDINAMENTI, FILTRI PER INTERVALLO e RAGGRUPPAMENTI PER GIORNO non passano
// da `measuredInstant`: gli ordinamenti e i filtri avvengono dentro Postgres e
// devono usare le colonne `_utc`; i confini di giornata si costruiscono con
// `inizioGiornoIta` / `fineGiornoIta`, mai con la mezzanotte UTC.

export const FUSO = 'Europe/Rome'

// Componenti calendariali di un istante nel fuso italiano. `Intl` con
// `timeZone` esplicito dà lo stesso risultato lato server (UTC) e lato browser,
// quindi non ci sono disallineamenti di idratazione.
export function parteFuso(instant: Date): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant)
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return { y: n('year'), mo: n('month'), d: n('day'), h: n('hour') % 24, mi: n('minute'), s: n('second') }
}

// Offset del fuso italiano, in minuti interi, all'istante dato.
// `parteFuso` arriva al secondo: senza l'arrotondamento i millisecondi
// dell'istante rientrerebbero nell'offset e verrebbero contati due volte.
function offsetFuso(instant: Date): number {
  const p = parteFuso(instant)
  const comeUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s)
  return Math.round((comeUtc - instant.getTime()) / 60000)
}

// Inverso di `parteFuso`: dai componenti di un orologio da parete italiano
// all'istante reale. Due passate perché l'offset dipende dall'istante che
// stiamo cercando: la seconda risolve i confini di ora legale.
export function daOraItaliana(wallUtcMs: number): Date {
  let off = offsetFuso(new Date(wallUtcMs))
  const primo = new Date(wallUtcMs - off * 60000)
  off = offsetFuso(primo)
  return new Date(wallUtcMs - off * 60000)
}

// Date i cui componenti LOCALI coincidono con l'orologio da parete italiano
// dell'istante dato. Serve solo per passarla a `format` di date-fns (pattern
// espliciti) senza cambiare il formato di output esistente.
export function oraDaParete(instant: Date): Date {
  const p = parteFuso(instant)
  return new Date(p.y, p.mo - 1, p.d, p.h, p.mi, p.s)
}

/**
 * Riga con quanto serve a stabilire l'istante reale.
 *
 * Copre le tre tabelle che portano timestamp scritti dal client:
 * `measurement_analytics` (measured_at), `sessions` (started_at) e
 * `sport_sessions` (start_time), ciascuna con la colonna normalizzata
 * corrispondente.
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
 * quella colonna è due ore avanti.
 */
export function measuredInstant(row: ConIstante | null | undefined): Date | null {
  if (!row) return null
  // Ordine di preferenza: la sessione prima di tutto. `started_at_utc` è
  // corretta su tutte le righe, `measured_at_utc` no (vedi il commento sopra),
  // quindi su una riga che porta entrambe vince la sessione.
  const gia = row.started_at_utc ?? row.start_time_utc ?? row.measured_at_utc
  if (gia) {
    const d = new Date(gia)
    if (!Number.isNaN(d.getTime())) return d
  }

  const grezzo = row.started_at ?? row.start_time ?? row.measured_at
  if (!grezzo) return null
  const d = new Date(grezzo)
  if (Number.isNaN(d.getTime())) return null

  // Nessuna colonna `_utc` selezionata: il valore grezzo è nella forma legacy
  // (orologio da parete italiano etichettato UTC) indipendentemente da
  // `tz_offset_minutes`, che NON distingue le due convenzioni.
  return daOraItaliana(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
             d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()),
  )
}

/**
 * Riga `sessions` da cui prendere l'istante autoritativo.
 * `sessions.started_at_utc` è l'unica colonna corretta su tutte le righe.
 */
export type ConIstanteSessione = {
  started_at?: string | null
  started_at_utc?: string | null
}

/**
 * Attacca a una riga `measurement_analytics` l'istante della sua sessione.
 *
 * Da usare in OGNI punto che unisce le due tabelle: `measured_at_utc` è
 * sbagliata su 986 righe finché non viene applicata la migration 029, mentre
 * `started_at_utc` è corretta ovunque. Dopo questa chiamata tutte le
 * `formatMeasured*` e `measuredInstant` sulla riga unita danno l'ora giusta.
 */
export function conIstanteSessione<T extends object>(
  ma: T,
  s: ConIstanteSessione | null | undefined,
): T & ConIstanteSessione {
  if (!s?.started_at_utc) return ma as T & ConIstanteSessione
  return { ...ma, started_at_utc: s.started_at_utc }
}

/**
 * Giorno di calendario italiano della misurazione, come 'YYYY-MM-DD'.
 *
 * Sostituisce `measured_at.slice(0, 10)`, che prende la data dalla stringa
 * grezza e sbaglia giornata per le misurazioni serali.
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

// ── Confini di giornata italiana ─────────────────────────────────────────────
//
// Un filtro per periodo o un raggruppamento per giorno deve tagliare a
// mezzanotte ITALIANA, non a mezzanotte UTC: con i confini UTC una misurazione
// fatta dopo le 22:00 italiane finisce nel giorno successivo (e una fatta prima
// delle 02:00 nel precedente), il che falsa trend, riepiloghi e report.

/** Istante ISO dell'inizio (00:00:00 italiane) del giorno `YYYY-MM-DD`. */
export function inizioGiornoIta(day: string): string {
  const [y, mo, d] = day.split('-').map(Number)
  return daOraItaliana(Date.UTC(y, (mo ?? 1) - 1, d ?? 1, 0, 0, 0)).toISOString()
}

/** Istante ISO della fine (23:59:59.999 italiane) del giorno `YYYY-MM-DD`. */
export function fineGiornoIta(day: string): string {
  const [y, mo, d] = day.split('-').map(Number)
  const i = daOraItaliana(Date.UTC(y, (mo ?? 1) - 1, d ?? 1, 23, 59, 59))
  return new Date(i.getTime() + 999).toISOString()
}

/** Estremi ISO di un intervallo di giorni italiani, estremi inclusi. */
export function intervalloGiorniIta(from: string, to: string): { fromIso: string; toIso: string } {
  return { fromIso: inizioGiornoIta(from), toIso: fineGiornoIta(to) }
}

/** Giorno italiano di un istante (o di adesso) come `YYYY-MM-DD`. */
export function oggiIta(now: Date = new Date()): string {
  const p = parteFuso(now)
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

/** Giorno italiano di `n` giorni fa come `YYYY-MM-DD`. */
export function giornoItaFa(n: number, now: Date = new Date()): string {
  const p = parteFuso(now)
  const d = new Date(Date.UTC(p.y, p.mo - 1, p.d) - n * 86_400_000)
  return d.toISOString().slice(0, 10)
}

/** Istante ISO dell'inizio della giornata italiana di `n` giorni fa. */
export function inizioGiornoItaFa(n: number, now: Date = new Date()): string {
  return inizioGiornoIta(giornoItaFa(n, now))
}
