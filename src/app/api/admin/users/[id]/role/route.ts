import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { logAdminAction } from '@/lib/admin-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/users/[id]/role — cambio ruolo client ↔ professional in due
// passi: senza confirm ritorna l'ANTEPRIMA di cosa succederà (nessuna modifica),
// con confirm:true esegue. Body: { role: 'client'|'professional', confirm?: boolean }
//
// Regole:
//  • → professional: se manca la riga professional_profiles viene creata.
//  • → client: se l'utente ha clienti propri (clients.professionista_id = id)
//    l'anteprima include un warning esplicito con il conteggio — non blocca.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const userId = params.id
  const body = await req.json().catch(() => ({}))
  const targetRole = body.role
  if (targetRole !== 'client' && targetRole !== 'professional') {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
  }
  const admin = createAdminClient()

  const [{ data: profile }, { data: pp }, { count: ownedClients }, { count: activeLinks }] = await Promise.all([
    admin.from('profiles').select('id, role, nome, cognome, email').eq('id', userId).maybeSingle(),
    admin.from('professional_profiles').select('id').eq('id', userId).maybeSingle(),
    admin.from('clients').select('*', { count: 'exact', head: true }).eq('professionista_id', userId),
    admin.from('client_professional_links').select('*', { count: 'exact', head: true }).eq('professional_id', userId).eq('status', 'active'),
  ])
  if (!profile) return NextResponse.json({ error: 'user_not_found' }, { status: 404 })

  const p = profile as { id: string; role: string | null; nome: string | null; cognome: string | null; email: string | null }
  const currentRole = p.role ?? null
  if (currentRole === targetRole) {
    return NextResponse.json({ error: 'already_in_role' }, { status: 400 })
  }

  const warnings: string[] = []
  const willCreateProfessionalProfile = targetRole === 'professional' && !pp
  if (targetRole === 'client') {
    if ((ownedClients ?? 0) > 0) {
      warnings.push(
        `L'utente ha ${ownedClients} clienti in anagrafica: diventando cliente non li vedrà più dalla dashboard professionista.`,
      )
    }
    if ((activeLinks ?? 0) > 0) {
      warnings.push(`L'utente ha ${activeLinks} collegamenti attivi come professionista: valuta se revocarli.`)
    }
  }

  const preview = {
    user_id: userId,
    current_role: currentRole,
    target_role: targetRole,
    will_create_professional_profile: willCreateProfessionalProfile,
    owned_clients_count: ownedClients ?? 0,
    active_links_as_professional: activeLinks ?? 0,
    warnings,
  }

  if (!body.confirm) {
    return NextResponse.json({ preview })
  }

  // ── Esecuzione ──────────────────────────────────────────────────────────────
  const { error: roleErr } = await admin.from('profiles').update({ role: targetRole }).eq('id', userId)
  if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 })

  if (willCreateProfessionalProfile) {
    const { error: ppErr } = await admin
      .from('professional_profiles')
      .insert({ id: userId, nome: p.nome, cognome: p.cognome })
    if (ppErr) {
      // Il ruolo è già cambiato: segnala il problema senza mascherarlo.
      return NextResponse.json(
        { error: `ruolo aggiornato ma creazione professional_profiles fallita: ${ppErr.message}` },
        { status: 500 },
      )
    }
  }

  await logAdminAction(admin, guard.user, {
    action: 'change_role',
    target_type: 'user',
    target_id: userId,
    details: { from: currentRole, to: targetRole, created_professional_profile: willCreateProfessionalProfile, warnings },
  })

  return NextResponse.json({ ok: true, executed: preview })
}
