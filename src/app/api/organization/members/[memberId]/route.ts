import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
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
  if (!user) return apiError('unauthorized', 401)

  const orgId = await resolveOwnerOrgId(user.id, supabase)
  if (!orgId) return apiError('forbidden', 403)

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
    return apiError('nothing_to_update', 400)
  }

  const { data: target } = await supabase
    .from('organization_members')
    .select('id, organization_id, user_id')
    .eq('id', memberId)
    .maybeSingle()
  if (!target || target.organization_id !== orgId) {
    return apiError('not_found', 404)
  }
  if (target.user_id === user.id) {
    return apiError('cannot_modify_self', 400)
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
  if (!user) return apiError('unauthorized', 401)

  const orgId = await resolveOwnerOrgId(user.id, supabase)
  if (!orgId) return apiError('forbidden', 403)

  const { memberId } = ctx.params

  const { data: target } = await supabase
    .from('organization_members')
    .select('id, organization_id, user_id, role')
    .eq('id', memberId)
    .maybeSingle()
  if (!target || target.organization_id !== orgId) {
    return apiError('not_found', 404)
  }
  if (target.role === 'owner') {
    return apiError('cannot_remove_owner', 400)
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
