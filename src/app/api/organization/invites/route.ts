import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Lista degli inviti pendenti per l'utente corrente (matchati per email)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!user.email) return NextResponse.json({ invites: [] })

  const { data: invites } = await supabase
    .from('organization_members')
    .select('id, organization_id, email, role, status, invited_at')
    .eq('email', user.email.toLowerCase())
    .eq('status', 'pending')

  if (!invites || invites.length === 0) return NextResponse.json({ invites: [] })

  const orgIds = invites.map((i) => i.organization_id)
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name')
    .in('id', orgIds)
  const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name as string]))

  return NextResponse.json({
    invites: invites.map((i) => ({ ...i, organization_name: orgMap.get(i.organization_id) ?? null })),
  })
}

// Accetta o rifiuta un invito
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const inviteId = typeof body?.inviteId === 'string' ? body.inviteId : null
  const action = body?.action === 'reject' ? 'reject' : 'accept'
  if (!inviteId) return NextResponse.json({ error: 'invite_required' }, { status: 400 })

  if (action === 'accept') {
    const { error } = await supabase.rpc('accept_organization_invite', { p_invite_id: inviteId })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // Reject: marca come revoked solo se l'invito è davvero per l'utente corrente
  const { data: invite } = await supabase
    .from('organization_members')
    .select('id, email, status')
    .eq('id', inviteId)
    .maybeSingle()
  if (!invite || invite.status !== 'pending') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (user.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const { error } = await supabase
    .from('organization_members')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
