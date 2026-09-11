import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/users/[id]/sessions — sessioni dell'utente e a chi sono
// attribuite (cliente + professionista). Per un professionista: le proprie
// sessioni; per un cliente: le sessioni in studio delle sue schede (ponte
// clients.client_user_id) PIÙ le sessioni remote fatte dalla sua app
// (professionista_id = suo uid, client_id NULL), attribuite ai professionisti
// con cui ha un link active. Prima si passava da client_professional_links.
// client_id, colonna mai valorizzata dall'app: per i clienti usciva sempre [].
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
    .order('started_at_utc', { ascending: false, nullsFirst: false })
    .limit(50)

  type Sess = {
    id: string
    client_id: string | null
    professionista_id: string
    started_at: string | null
    created_at: string | null
    test_type: string | null
    duration_seconds: number | null
    remote?: boolean
    linked_professionals?: string[]
  }
  let sessions: Sess[] = []
  if (role === 'client') {
    const [{ data: cards }, { data: links }] = await Promise.all([
      admin.from('clients').select('id, professionista_id').eq('client_user_id', userId).is('merged_into_client_id', null),
      admin.from('client_professional_links').select('professional_id').eq('client_user_id', userId).eq('status', 'active'),
    ])
    const cardIds = (cards ?? []).map((c) => (c as { id: string }).id)
    const linkedPros = (links ?? []).map((l) => (l as { professional_id: string }).professional_id)
    const [studio, remote] = await Promise.all([
      cardIds.length ? query.in('client_id', cardIds) : Promise.resolve({ data: [], error: null }),
      admin
        .from('sessions')
        .select('id, client_id, professionista_id, started_at, created_at, test_type, duration_seconds')
        .eq('professionista_id', userId)
        .is('client_id', null)
        .order('started_at_utc', { ascending: false, nullsFirst: false })
        .limit(50),
    ])
    if (studio.error) return NextResponse.json({ error: studio.error.message }, { status: 500 })
    if (remote.error) return NextResponse.json({ error: remote.error.message }, { status: 500 })
    sessions = [
      ...((studio.data ?? []) as Sess[]),
      ...((remote.data ?? []) as Sess[]).map((s) => ({ ...s, remote: true, linked_professionals: linkedPros })),
    ]
      .sort((a, b) => new Date(b.started_at ?? b.created_at ?? 0).getTime() - new Date(a.started_at ?? a.created_at ?? 0).getTime())
      .slice(0, 50)
  } else {
    const { data: sessRows, error } = await query.eq('professionista_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    sessions = (sessRows ?? []) as Sess[]
  }

  // Risolvi nomi cliente + professionista.
  const clientIds = Array.from(new Set(sessions.map((s) => s.client_id).filter((v): v is string => !!v)))
  const profIds = Array.from(new Set([...sessions.map((s) => s.professionista_id), ...sessions.flatMap((s) => s.linked_professionals ?? [])]))
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
      client_name: s.remote ? 'Misurazione remota (dalla sua app)' : (s.client_id && clientName.get(s.client_id)) || 'Cliente',
      professional_id: s.remote ? (s.linked_professionals?.[0] ?? null) : s.professionista_id,
      professional_name: s.remote
        ? s.linked_professionals?.length
          ? s.linked_professionals.map((id) => profName.get(id) ?? id.slice(0, 8)).join(', ')
          : 'nessun professionista collegato: invisibile'
        : profName.get(s.professionista_id) ?? 'Professionista',
      remote: !!s.remote,
    })),
  })
}
