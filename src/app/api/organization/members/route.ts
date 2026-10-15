import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Organizzazione su cui l'utente può gestire i membri: quella attiva del profilo
// se ne è owner o admin; altrimenti la prima viva di cui è owner, poi la prima in
// cui è admin. Mai `.maybeSingle()`: un utente può averne più di una (sito-043).
async function resolveAuthorizedOrgId(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ data: profile }, { data: ownedRows }, { data: adminRows }] = await Promise.all([
    supabase.from('profiles').select('organization_id').eq('id', userId).maybeSingle(),
    supabase
      .from('organizations')
      .select('id')
      .eq('owner_id', userId)
      .is('merged_into_id', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('role', 'admin'),
  ])
  const owned = (ownedRows ?? []).map((o) => o.id as string)
  const admin = (adminRows ?? []).map((m) => m.organization_id as string)
  const activeId = (profile?.organization_id as string | null | undefined) ?? null

  if (activeId && owned.includes(activeId)) return { orgId: activeId, role: 'owner' as const }
  if (activeId && admin.includes(activeId)) {
    const { data: live } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', activeId)
      .is('merged_into_id', null)
      .maybeSingle()
    if (live) return { orgId: activeId, role: 'admin' as const }
  }
  if (owned.length > 0) return { orgId: owned[0], role: 'owner' as const }
  if (admin.length > 0) {
    const { data: live } = await supabase
      .from('organizations')
      .select('id')
      .in('id', admin)
      .is('merged_into_id', null)
      .order('created_at', { ascending: true })
      .limit(1)
    if (live && live.length > 0) return { orgId: live[0].id as string, role: 'admin' as const }
  }
  return null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('unauthorized', 401)

  const auth = await resolveAuthorizedOrgId(user.id, supabase)
  if (!auth) return apiError('forbidden', 403)

  const { data: members } = await supabase
    .from('organization_members')
    .select('*')
    .eq('organization_id', auth.orgId)
    .order('invited_at', { ascending: true })

  return NextResponse.json({ members: members ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('unauthorized', 401)

  const auth = await resolveAuthorizedOrgId(user.id, supabase)
  if (!auth) return apiError('forbidden', 403)

  const body = await req.json().catch(() => ({}))
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = body?.role === 'admin' ? 'admin' : 'member'
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return apiError('invalid_email', 400)
  }

  const { data: existing } = await supabase
    .from('organization_members')
    .select('id, status')
    .eq('organization_id', auth.orgId)
    .eq('email', email)
    .maybeSingle()
  if (existing && existing.status !== 'revoked') {
    return apiError('already_invited', 409)
  }

  const payload = {
    organization_id: auth.orgId,
    email,
    role,
    status: 'pending' as const,
    invited_by: user.id,
    invited_at: new Date().toISOString(),
  }

  let invite
  if (existing) {
    const { data, error } = await supabase
      .from('organization_members')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    invite = data
  } else {
    const { data, error } = await supabase
      .from('organization_members')
      .insert(payload)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    invite = data
  }

  return NextResponse.json({ invite })
}
