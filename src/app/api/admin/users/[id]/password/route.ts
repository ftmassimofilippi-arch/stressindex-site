import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/users/[id]/password
// Body: { action: 'reset' }            → invia email di reset password
//       { action: 'set', password }    → imposta manualmente una nuova password
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const userId = params.id
  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()

  if (body.action === 'set') {
    const password = typeof body.password === 'string' ? body.password : ''
    if (password.length < 8) {
      return NextResponse.json({ error: 'password_too_short' }, { status: 400 })
    }
    const { error } = await admin.auth.admin.updateUserById(userId, { password })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'reset') {
    // Recupera l'email dell'utente.
    const { data, error: getErr } = await admin.auth.admin.getUserById(userId)
    if (getErr || !data.user?.email) {
      return NextResponse.json({ error: getErr?.message ?? 'no_email' }, { status: 400 })
    }
    // Usa un client anon per inviare l'email di reset (resetPasswordForEmail).
    const anon = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stressindex.io'
    const { error } = await anon.auth.resetPasswordForEmail(data.user.email, {
      redirectTo: `${siteUrl}/area-professionisti/recupera-password`,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, email: data.user.email })
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
}
