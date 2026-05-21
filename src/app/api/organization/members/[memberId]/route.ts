import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function resolveOwnerOrgId(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()
  return org?.id as string | undefined
}

export async function PATCH(req: NextRequest, ctx: { params: { memberId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const orgId = await resolveOwnerOrgId(user.id, supabase)
  if (!orgId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { memberId } = ctx.params
  const body = await req.json().catch(() => ({}))

  const update: Record<string, unknown> = {}
  if (typeof body?.role === 'string' && ['owner', 'admin', 'member'].includes(body.role)) {
    update.role = body.role
  }
  if (typeof body?.status === 'string' && ['pending', 'active', 'revoked'].includes(body.status)) {
    update.status = body.status
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
  }

  const { data: target } = await supabase
    .from('organization_members')
    .select('id, organization_id, user_id')
    .eq('id', memberId)
    .maybeSingle()
  if (!target || target.organization_id !== orgId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (target.user_id === user.id) {
    return NextResponse.json({ error: 'cannot_modify_self' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('organization_members')
    .update(update)
    .eq('id', memberId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (update.status === 'revoked' && target.user_id) {
    await supabase
      .from('profiles')
      .update({ organization_id: null })
      .eq('id', target.user_id)
      .eq('organization_id', orgId)
  }

  return NextResponse.json({ member: data })
}

export async function DELETE(_req: NextRequest, ctx: { params: { memberId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const orgId = await resolveOwnerOrgId(user.id, supabase)
  if (!orgId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { memberId } = ctx.params

  const { data: target } = await supabase
    .from('organization_members')
    .select('id, organization_id, user_id, role')
    .eq('id', memberId)
    .maybeSingle()
  if (!target || target.organization_id !== orgId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (target.role === 'owner') {
    return NextResponse.json({ error: 'cannot_remove_owner' }, { status: 400 })
  }

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (target.user_id) {
    await supabase
      .from('profiles')
      .update({ organization_id: null })
      .eq('id', target.user_id)
      .eq('organization_id', orgId)
  }

  return NextResponse.json({ ok: true })
}
