import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/users/[id]/sessions — sessioni dell'utente e a chi sono
// attribuite (cliente + professionista). Per un professionista: le proprie
// sessioni; per un cliente: le sessioni dei clients a lui collegati.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const userId = params.id
  const admin = createAdminClient()

  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  const role = (profile as { role?: string } | null)?.role ?? null

  let query = admin
    .from('sessions')
    .select('id, client_id, professionista_id, started_at, created_at, test_type, duration_seconds')
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(50)

  if (role === 'client') {
    const { data: links } = await admin
      .from('client_professional_links')
      .select('client_id')
      .eq('client_user_id', userId)
    const clientIds = (links ?? []).map((l) => (l as { client_id: string }).client_id)
    if (clientIds.length === 0) return NextResponse.json({ sessions: [] })
    query = query.in('client_id', clientIds)
  } else {
    query = query.eq('professionista_id', userId)
  }

  const { data: sessRows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const sessions = (sessRows ?? []) as Array<{
    id: string
    client_id: string
    professionista_id: string
    started_at: string | null
    created_at: string | null
    test_type: string | null
    duration_seconds: number | null
  }>

  // Risolvi nomi cliente + professionista.
  const clientIds = Array.from(new Set(sessions.map((s) => s.client_id)))
  const profIds = Array.from(new Set(sessions.map((s) => s.professionista_id)))
  const [clientsRes, profilesRes] = await Promise.all([
    clientIds.length ? admin.from('clients').select('id, nome, cognome').in('id', clientIds) : Promise.resolve({ data: [] }),
    profIds.length ? admin.from('profiles').select('id, nome, cognome, email').in('id', profIds) : Promise.resolve({ data: [] }),
  ])
  const clientName = new Map<string, string>()
  for (const c of (clientsRes.data ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) {
    clientName.set(c.id, `${c.nome ?? ''} ${c.cognome ?? ''}`.trim() || 'Cliente')
  }
  const profName = new Map<string, string>()
  for (const p of (profilesRes.data ?? []) as Array<{ id: string; nome: string | null; cognome: string | null; email: string | null }>) {
    profName.set(p.id, `${p.nome ?? ''} ${p.cognome ?? ''}`.trim() || p.email || 'Professionista')
  }

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      measured_at: s.started_at ?? s.created_at,
      test_type: s.test_type,
      duration_seconds: s.duration_seconds,
      client_id: s.client_id,
      client_name: clientName.get(s.client_id) ?? 'Cliente',
      professional_id: s.professionista_id,
      professional_name: profName.get(s.professionista_id) ?? 'Professionista',
    })),
  })
}
