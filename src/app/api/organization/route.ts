import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.organization_id) {
    return NextResponse.json({ organization: null, members: [], role: null })
  }

  const { data: organization } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', profile.organization_id)
    .maybeSingle()

  const { data: members } = await supabase
    .from('organization_members')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('invited_at', { ascending: true })

  const myMember = members?.find((m) => m.user_id === user.id) ?? null

  return NextResponse.json({
    organization,
    members: members ?? [],
    role: myMember?.role ?? null,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 })

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()
  if (existingProfile?.organization_id) {
    return NextResponse.json({ error: 'already_in_organization' }, { status: 409 })
  }

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({ name, owner_id: user.id })
    .select()
    .single()
  if (orgErr || !org) {
    return NextResponse.json({ error: orgErr?.message ?? 'create_failed' }, { status: 500 })
  }

  const { error: memberErr } = await supabase
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id: user.id,
      email: user.email ?? '',
      role: 'owner',
      status: 'active',
      accepted_at: new Date().toISOString(),
      invited_by: user.id,
    })
  if (memberErr) {
    return NextResponse.json({ error: memberErr.message }, { status: 500 })
  }

  await supabase
    .from('profiles')
    .upsert({ id: user.id, organization_id: org.id, email: user.email })

  return NextResponse.json({ organization: org })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body?.name === 'string' ? body.name.trim() : null
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!org) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('organizations')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', org.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
