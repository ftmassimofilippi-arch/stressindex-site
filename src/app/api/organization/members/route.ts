import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function resolveAuthorizedOrgId(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: ownerOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()
  if (ownerOrg?.id) return { orgId: ownerOrg.id as string, role: 'owner' as const }

  const { data: adminMember } = await supabase
    .from('organization_members')
    .select('organization_id, role, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (adminMember?.role === 'admin') {
    return { orgId: adminMember.organization_id as string, role: 'admin' as const }
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
