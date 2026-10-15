import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Cambia l'organizzazione attiva (`profiles.organization_id`) fra quelle
// dell'utente: owner oppure membro attivo, e viva (`merged_into_id is null`).
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const organizationId = typeof body?.organizationId === 'string' ? body.organizationId.trim() : ''
  if (!organizationId) return apiError('organization_required', 400)

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, owner_id')
    .eq('id', organizationId)
    .is('merged_into_id', null)
    .maybeSingle()
  if (orgErr) return apiError('generic', 500, { detail: orgErr.message })
  if (!org) return apiError('organization_not_found', 404)

  if (org.owner_id !== user.id) {
    const { data: membership, error: memberErr } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', org.id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
    if (memberErr) return apiError('generic', 500, { detail: memberErr.message })
    if (!membership || membership.length === 0) return apiError('forbidden', 403)
  }

  const { error } = await supabase
    .from('profiles')
    .update({ organization_id: org.id })
    .eq('id', user.id)
  if (error) return apiError('profile_update_failed', 500, { detail: error.message })

  return NextResponse.json({ ok: true, organizationId: org.id })
}
