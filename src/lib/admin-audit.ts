import type { SupabaseClient, User } from '@supabase/supabase-js'

// Audit trail delle operazioni privilegiate del pannello Super Admin.
// Scrive su admin_audit_log (migration 017) via service_role.
// Error-safe: se la tabella non esiste ancora l'operazione NON fallisce,
// si logga solo l'errore lato server — l'audit non deve mai bloccare l'azione.
export async function logAdminAction(
  admin: SupabaseClient,
  performedBy: User,
  entry: {
    action: string // es. 'change_role' | 'create_link' | 'merge_clients'
    target_type: string // es. 'user' | 'link' | 'client'
    target_id?: string | null
    details?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await admin.from('admin_audit_log').insert({
    performed_by: performedBy.id,
    performed_by_email: performedBy.email ?? null,
    action: entry.action,
    target_type: entry.target_type,
    target_id: entry.target_id ?? null,
    details: entry.details ?? {},
  })
  if (error) {
    console.error('[admin-audit] insert fallito (migration 017 applicata?)', { entry: entry.action, error })
  }
}
