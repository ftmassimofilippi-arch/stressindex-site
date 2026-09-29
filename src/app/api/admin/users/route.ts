import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { getAdminUsers } from '@/lib/admin-data'
import { getCatalogo } from '@/lib/admin-commerciale'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/users — lista completa utenti (auth.users ⋈ profiles) con
// statistiche e indicatori orfano. Solo superadmin.
export async function GET() {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  try {
    const [users, catalogo] = await Promise.all([getAdminUsers(), getCatalogo(createAdminClient())])
    // catalogo null = migration 024 non applicata: il pannello nasconde stato/moduli
    return NextResponse.json({ users, catalogo })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'generic'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
