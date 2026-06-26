import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { getAdminUsers } from '@/lib/admin-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/users — lista completa utenti (auth.users ⋈ profiles) con
// statistiche e indicatori orfano. Solo superadmin.
export async function GET() {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  try {
    const users = await getAdminUsers()
    return NextResponse.json({ users })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'errore'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
