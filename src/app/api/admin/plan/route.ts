import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/admin/plan — cambia il piano ('base' | 'pro') di un professionista.
// Riservato al superadmin: la verifica è doppia, lato app (qui) e lato DB
// (policy RLS "superadmin_update_profiles" della migration 013).
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Verifica superadmin sul profilo del chiamante.
  const { data: me } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .maybeSingle()
  if (!(me as { is_superadmin?: boolean } | null)?.is_superadmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const userId = typeof body?.userId === 'string' ? body.userId : null
  const plan = body?.plan
  if (!userId) return NextResponse.json({ error: 'missing_user' }, { status: 400 })
  if (plan !== 'base' && plan !== 'pro') {
    return NextResponse.json({ error: 'invalid_plan' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ plan })
    .eq('id', userId)
    .select('id, plan')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ profile: data })
}
