import type { PostgrestError } from '@supabase/supabase-js'
import { createAdminClient } from './supabase-admin'
import { selectWithMissingColumnFallback } from './safe-select'
import { parseMonitoringRow } from './monitoring-data'
import type { MonitoringSession } from './monitoring-types'

// ============================================================================
// SUPER ADMIN — monitoraggi di tutti gli utenti (service_role)
// ----------------------------------------------------------------------------
// Da chiamare SOLO da route protette da requireSuperadmin(). Bypassa le RLS.
// Le liste non caricano `windows`; il dettaglio passa dalla pagina normale
// con ?professionista=<titolare>, che il superadmin può aprire in sola lettura.
// ============================================================================

const COLUMNS = [
  'id', 'user_id', 'professionista_id', 'client_id', 'monitoring_type', 'source', 'device_name',
  'start_time', 'end_time', 'tz_offset_minutes', 'duration_minutes', 'rr_count', 'artifact_percentage',
  'signal_quality', 'ectopic_count', 'valid_coverage_percentage', 'night', 'summary', 'algorithm_version',
  'rr_storage_path', 'created_at', 'updated_at', 'recording_profile', 'sleep_score', 'device_serial',
  'sample_interval_seconds', 'events_modified_on_web',
] as const

type RawRow = Record<string, unknown>

/** Riga della lista admin: sessione (senza finestre) + email dell'account che ha registrato. */
export type AdminMonitoringRow = MonitoringSession & { user_email: string | null }

async function loadRows(filter?: (q: ReturnType<ReturnType<typeof createAdminClient>['from']>) => unknown): Promise<RawRow[]> {
  const admin = createAdminClient()
  const { data, error } = await selectWithMissingColumnFallback<RawRow>(
    COLUMNS,
    (cols) => {
      let q = admin.from('monitoring_sessions').select(cols).order('start_time', { ascending: false })
      if (filter) q = filter(q as unknown as ReturnType<ReturnType<typeof createAdminClient>['from']>) as typeof q
      return q as unknown as PromiseLike<{ data: RawRow[] | null; error: PostgrestError | null }>
    },
    { label: 'monitoring_sessions (admin)', required: ['id', 'user_id', 'start_time', 'monitoring_type'] },
  )
  if (error) {
    // Tabella assente (migrazione dell'app non applicata) o altro errore: lista vuota, mai un crash del pannello.
    console.error('[admin-monitoring] lettura fallita', error)
    return []
  }
  return (data ?? []) as RawRow[]
}

async function enrich(rows: RawRow[]): Promise<AdminMonitoringRow[]> {
  const admin = createAdminClient()
  const sessions = rows.map((r) => parseMonitoringRow({ ...r, windows: undefined }))
  const clientIds = Array.from(new Set(sessions.map((s) => s.client_id).filter((v): v is string => !!v)))
  const userIds = Array.from(new Set(sessions.flatMap((s) => [s.user_id, s.professionista_id]).filter((v): v is string => !!v)))
  const [clientsRes, profilesRes, ppRes] = await Promise.all([
    clientIds.length ? admin.from('clients').select('id, nome, cognome').in('id', clientIds) : Promise.resolve({ data: [] }),
    userIds.length ? admin.from('profiles').select('id, nome, cognome, email').in('id', userIds) : Promise.resolve({ data: [] }),
    userIds.length ? admin.from('professional_profiles').select('id, nome, cognome').in('id', userIds) : Promise.resolve({ data: [] }),
  ])
  const clientName = new Map<string, string>()
  for (const c of (clientsRes.data ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) clientName.set(c.id, `${c.nome ?? ''} ${c.cognome ?? ''}`.trim() || 'Cliente')
  const profile = new Map<string, { nome: string | null; cognome: string | null; email: string | null }>()
  for (const p of (profilesRes.data ?? []) as Array<{ id: string; nome: string | null; cognome: string | null; email: string | null }>) profile.set(p.id, p)
  const pp = new Map<string, { nome: string | null; cognome: string | null }>()
  for (const p of (ppRes.data ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) pp.set(p.id, p)
  const name = (id: string | null) => {
    if (!id) return null
    const a = pp.get(id), b = profile.get(id)
    return `${a?.nome ?? b?.nome ?? ''} ${a?.cognome ?? b?.cognome ?? ''}`.trim() || b?.email || null
  }
  return sessions.map((s) => ({
    ...s,
    client_name: (s.client_id && clientName.get(s.client_id)) || name(s.user_id) || 'Cliente',
    professional_name: name(s.professionista_id),
    user_email: profile.get(s.user_id)?.email ?? null,
  }))
}

/** Tutti i monitoraggi del database (senza finestre), più recenti prima. */
export async function getAdminMonitoringSessions(limit = 2000): Promise<AdminMonitoringRow[]> {
  const rows = await loadRows((q) => (q as unknown as { limit: (n: number) => unknown }).limit(limit))
  return enrich(rows)
}

/** Monitoraggi di un utente: registrati da lui (user_id) o con lui come professionista di riferimento. */
export async function getAdminMonitoringForUser(userId: string): Promise<AdminMonitoringRow[]> {
  const rows = await loadRows((q) => (q as unknown as { or: (f: string) => unknown }).or(`user_id.eq.${userId},professionista_id.eq.${userId}`))
  return enrich(rows)
}

/** Conteggi per utente registrante, per professionista di riferimento e per scheda CRM. */
export async function getAdminMonitoringCounts(): Promise<{ byUser: Map<string, number>; byProfessional: Map<string, number>; byClient: Map<string, number> }> {
  const byUser = new Map<string, number>()
  const byProfessional = new Map<string, number>()
  const byClient = new Map<string, number>()
  const admin = createAdminClient()
  const { data, error } = await admin.from('monitoring_sessions').select('user_id, professionista_id, client_id')
  if (error) {
    console.error('[admin-monitoring] conteggi non disponibili', error.message)
    return { byUser, byProfessional, byClient }
  }
  for (const r of (data ?? []) as Array<{ user_id: string | null; professionista_id: string | null; client_id: string | null }>) {
    if (r.user_id) byUser.set(r.user_id, (byUser.get(r.user_id) ?? 0) + 1)
    if (r.professionista_id) byProfessional.set(r.professionista_id, (byProfessional.get(r.professionista_id) ?? 0) + 1)
    if (r.client_id) byClient.set(r.client_id, (byClient.get(r.client_id) ?? 0) + 1)
  }
  return { byUser, byProfessional, byClient }
}
