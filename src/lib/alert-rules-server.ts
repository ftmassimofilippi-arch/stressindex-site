// =============================================================================
// alert_rules / alert_events — letture lato server
// =============================================================================
// Separato da alert-rules.ts (puro, importabile dai componenti client) perché
// il client Supabase server usa next/headers, che non può entrare in un bundle
// client.

import { createClient as createServerClient } from './supabase-server'
import type { Alert } from './types'
import type { AlertRule } from './alert-rules'

/** Tutte le regole del professionista loggato (generali + override). La RLS
 *  filtra su professionista_id. Error-safe: tabella assente → []. */
export async function listAlertRules(): Promise<AlertRule[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('alert_rules')
    .select('id, professionista_id, client_id, alert_type, enabled, threshold_value, created_at')
    .order('created_at', { ascending: true })
  if (error) {
    console.error('[listAlertRules] error', error.message)
    return []
  }
  return (data ?? []) as AlertRule[]
}

// ── Eventi generati dall'app (alert_events) ──────────────────────────────────

interface AlertEventRow {
  id: string
  professionista_id: string
  client_id: string
  alert_type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  session_id: string | null
  read: boolean
  created_at: string
}

/** Un evento dell'app nella forma degli alert della dashboard, così le due
 *  liste si mostrano insieme. severity info/warning/critical → low/medium/high;
 *  read → seen, altrimenti new. */
function eventToAlert(e: AlertEventRow): Alert {
  return {
    id: e.id,
    professional_id: e.professionista_id,
    client_id: e.client_id,
    type: e.alert_type,
    severity: e.severity === 'critical' ? 'high' : e.severity === 'warning' ? 'medium' : 'low',
    message: e.message,
    triggering_value: null,
    triggering_metric: e.session_id,
    status: e.read ? 'seen' : 'new',
    created_at: e.created_at,
    source: 'app',
  }
}

/** Eventi alert scritti dall'app (valutati sulle regole con la precedenza per
 *  cliente). Error-safe: tabella assente → []. */
export async function listAlertEvents(opts?: { clientId?: string; unreadOnly?: boolean; limit?: number; days?: number }): Promise<Alert[]> {
  const supabase = await createServerClient()
  let q = supabase
    .from('alert_events')
    .select('id, professionista_id, client_id, alert_type, severity, title, message, session_id, read, created_at')
    .order('created_at', { ascending: false })
  if (opts?.clientId) q = q.eq('client_id', opts.clientId)
  if (opts?.unreadOnly) q = q.eq('read', false)
  if (opts?.days) {
    const since = new Date(Date.now() - opts.days * 86_400_000).toISOString()
    q = q.gte('created_at', since)
  }
  if (opts?.limit) q = q.limit(opts.limit)
  const { data, error } = await q
  if (error) {
    console.error('[listAlertEvents] error', error.message)
    return []
  }
  return ((data ?? []) as AlertEventRow[]).map(eventToAlert)
}

