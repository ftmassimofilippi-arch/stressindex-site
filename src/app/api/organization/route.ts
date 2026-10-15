import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase-server'
import { getOrganizationContext } from '@/lib/dashboard-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PG_UNIQUE_VIOLATION = '23505'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('unauthorized', 401)

  // Stessa fonte della pagina: organizzazioni vive, attiva riallineata (sito-043).
  const ctx = await getOrganizationContext()
  return NextResponse.json(ctx)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return apiError('name_required', 400)

  // 1. Già dentro un'organizzazione (come owner o membro) tramite il profilo.
  const { data: existingProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()
  if (profileErr) return apiError('create_failed', 500, { detail: profileErr.message })
  if (existingProfile?.organization_id) {
    return apiError('already_in_organization', 409)
  }

  // 2. Già owner di un'organizzazione viva, anche se il profilo non la punta
  //    (è il caso del triplo submit del 27/05: il profilo era rimasto NULL).
  const { data: owned, error: ownedErr } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .is('merged_into_id', null)
    .limit(1)
  if (ownedErr) return apiError('create_failed', 500, { detail: ownedErr.message })
  if (owned && owned.length > 0) {
    return apiError('already_in_organization', 409)
  }

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({ name, owner_id: user.id })
    .select()
    .single()
  if (orgErr || !org) {
    // Indice unico (owner_id, nome) della sito-043: due submit in volo insieme.
    if (orgErr?.code === PG_UNIQUE_VIOLATION) return apiError('organization_exists', 409)
    return apiError('create_failed', 500, orgErr ? { detail: orgErr.message } : undefined)
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
    return apiError('create_failed', 500, { detail: memberErr.message })
  }

  const { error: profileUpdErr } = await supabase
    .from('profiles')
    .upsert({ id: user.id, organization_id: org.id, email: user.email })
  if (profileUpdErr) {
    return apiError('profile_update_failed', 500, { detail: profileUpdErr.message })
  }

  return NextResponse.json({ organization: org })
}

// Rinomina. `organizationId` facoltativo: senza, vale l'organizzazione attiva del
// profilo (o la prima di cui l'utente è owner). L'utente deve esserne owner.
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const name = typeof body?.name === 'string' ? body.name.trim() : null
  if (!name) return apiError('name_required', 400)
  let organizationId: string | null = typeof body?.organizationId === 'string' && body.organizationId ? body.organizationId : null

  if (!organizationId) {
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()
    if (profileErr) return apiError('generic', 500, { detail: profileErr.message })
    organizationId = (profile?.organization_id as string | null | undefined) ?? null
  }

  let ownedQuery = supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .is('merged_into_id', null)
    .order('created_at', { ascending: true })
    .limit(1)
  if (organizationId) ownedQuery = ownedQuery.eq('id', organizationId)
  const { data: owned, error: ownedErr } = await ownedQuery
  if (ownedErr) return apiError('generic', 500, { detail: ownedErr.message })
  const org = owned?.[0]
  if (!org) return apiError('forbidden', 403)

  const { error } = await supabase
    .from('organizations')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', org.id)
  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) return apiError('organization_exists', 409)
    return apiError('generic', 500, { detail: error.message })
  }

  return NextResponse.json({ ok: true })
}
