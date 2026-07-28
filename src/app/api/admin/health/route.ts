import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/health — report di salute dei dati in una sola chiamata.
// Delega alla RPC admin_data_health (migration 017): ogni indicatore è una
// query aggregata lato DB, nessun N+1. Se la migration non è ancora applicata
// ritorna { migration_required: true } invece di errore.
export async function GET() {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('admin_data_health')

  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      return NextResponse.json({ migration_required: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ report: data })
}
