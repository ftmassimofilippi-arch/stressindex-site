// =============================================================================
// Notifiche della campanella: elenco unito e stato di lettura per utente
// =============================================================================
//
// La campanella mette insieme due sorgenti che restano separate nel database:
//   'cron'  public.alerts       — alert del cron del sito
//   'app'   public.alert_events — eventi valutati dall'app sulle regole
//
// LA LETTURA NON TOCCA LE DUE TABELLE. Si aggiunge soltanto una riga in
// `notification_reads` (migration sito-030): chiave (user_id, source,
// notification_id), campo `read_at`. Motivi in testa alla migration; in breve:
// `alert_events.read` è dell'app, `alerts.status` è il ciclo di vita
// dell'alert, e la stessa riga può essere visibile a più utenti (superadmin,
// viste di organizzazione), quindi un flag globale farebbe sparire il
// contatore al professionista titolare.
//
// Finché la sito-030 non è applicata tutto continua a funzionare: il conteggio
// ricade sullo stato delle sorgenti e la marcatura risponde `reads_unavailable`
// senza rompere la pagina.

import { cache } from 'react'
import { createClient } from './supabase-server'
import { listAlerts } from './dashboard-data'
import { listAlertEvents } from './alert-rules-server'
import { mergeAlerts } from './alert-rules'
import type { Alert } from './types'

/** Sorgente di una notifica: decide in quale tabella sta l'originale. */
export type NotificationSource = 'cron' | 'app'

export type Notification = Alert & {
  source: NotificationSource
  /** Data della PRIMA lettura di questo utente, null se non letta. */
  readAt: string | null
  unread: boolean
}

export type NotificationList = {
  items: Notification[]
  unread: number
  /** false quando `notification_reads` non esiste ancora (sito-030 non
   *  applicata): la marcatura come letto non è disponibile. */
  readsAvailable: boolean
}

/** Quanti giorni indietro guarda la campanella, e quante notifiche al massimo. */
const GIORNI = 30
const LIMITE = 30

function sourceOf(a: Alert): NotificationSource {
  return a.source === 'app' ? 'app' : 'cron'
}

/**
 * Le notifiche dell'utente loggato, con lo stato di lettura.
 *
 * Versione NON memoizzata: da usare solo subito dopo aver scritto delle
 * letture, quando serve lo stato aggiornato nella stessa richiesta. Negli
 * altri casi si usa `loadNotifications`.
 */
export async function readNotifications(): Promise<NotificationList> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { items: [], unread: 0, readsAvailable: false }

  const [cronAlerts, appEvents] = await Promise.all([
    listAlerts({ status: ['new', 'seen'], limit: LIMITE }),
    listAlertEvents({ days: GIORNI, limit: LIMITE }),
  ])
  const merged = mergeAlerts(cronAlerts, appEvents, LIMITE)
  if (merged.length === 0) return { items: [], unread: 0, readsAvailable: true }

  // Letture di QUESTO utente (la RLS non ne mostra altre). Error-safe: tabella
  // assente → nessuna lettura registrata e marcatura non disponibile.
  const { data: reads, error } = await supabase
    .from('notification_reads')
    .select('source, notification_id, read_at')
    .in('notification_id', merged.map((a) => a.id))
  if (error) {
    console.error('[loadNotifications] notification_reads non leggibile', error.message)
  }
  const readsAvailable = !error

  const readAtBy = new Map<string, string>()
  for (const r of (reads ?? []) as Array<{ source: string; notification_id: string; read_at: string }>) {
    readAtBy.set(`${r.source}:${r.notification_id}`, r.read_at)
  }

  const items: Notification[] = merged.map((a) => {
    const source = sourceOf(a)
    const readAt = readAtBy.get(`${source}:${a.id}`) ?? null
    // Una notifica che la sorgente dà già per vista resta letta anche senza
    // riga in `notification_reads`: è lo stato che la dashboard mostrava prima
    // e non va riportato indietro. Per gli eventi dell'app `status` viene da
    // `read`, che scrive l'app; per gli alert del cron nessuno scrive mai
    // 'seen', quindi in pratica decide solo la riga di lettura.
    const vistaDallaSorgente = a.status !== 'new'
    return { ...a, source, readAt, unread: readAt === null && !vistaDallaSorgente }
  })

  return { items, unread: items.filter((i) => i.unread).length, readsAvailable }
}

/**
 * Come `readNotifications`, memoizzata per richiesta (React cache): il layout
 * la usa per il contatore della campanella e la route /api/notifiche per
 * l'elenco, con una sola lettura del database.
 */
export const loadNotifications = cache(readNotifications)

/**
 * Segna come lette le notifiche indicate, per l'utente loggato.
 *
 * Solo INSERT: `read_at` è la prima lettura e non si riscrive, quindi un
 * secondo passaggio sulla stessa notifica non cambia la data. Nessuna riga di
 * `alerts` o `alert_events` viene toccata.
 *
 * `ids` vuoto significa "tutte quelle visibili adesso".
 */
export async function markNotificationsRead(
  ids?: Array<{ source: NotificationSource; id: string }>,
): Promise<{ ok: true; marked: number; unread: number } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthorized' }

  let target = ids ?? []
  if (target.length === 0) {
    const { items } = await loadNotifications()
    target = items.filter((i) => i.unread).map((i) => ({ source: i.source, id: i.id }))
  }
  if (target.length === 0) return { ok: true, marked: 0, unread: 0 }

  const righe = target.map((t) => ({
    user_id: user.id,
    source: t.source,
    notification_id: t.id,
  }))
  // ignoreDuplicates: la prima lettura vince, le successive non riscrivono
  // `read_at` (e il trigger append-only della sito-030 rifiuterebbe l'UPDATE).
  const { error } = await supabase
    .from('notification_reads')
    .upsert(righe, { onConflict: 'user_id,source,notification_id', ignoreDuplicates: true })
  if (error) {
    console.error('[markNotificationsRead] insert fallito', error.message)
    return { ok: false, error: 'reads_unavailable' }
  }
  // `unread` si rilegge dal database, non si sottrae: `righe` conta le
  // notifiche inviate, non quelle davvero inserite (i duplicati sono ignorati).
  const { unread } = await readNotifications()
  return { ok: true, marked: righe.length, unread }
}
