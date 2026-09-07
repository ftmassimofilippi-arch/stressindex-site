import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { getAdminClients } from '@/lib/admin-data'
import { logAdminAction } from '@/lib/admin-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/clients — anagrafica clienti con professionista e stato accesso.
export async function GET() {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  try {
    const clients = await getAdminClients()
    return NextResponse.json({ clients })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'errore'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/admin/clients — crea una scheda cliente e la associa a un professionista.
// Body: { professional_id, nome, cognome, email?, telefono?, data_nascita?, sesso?,
//         createAccess?: boolean, password? }
//
// Collegamento dell'account:
//  • se l'email corrisponde a un utente già registrato → link attivo con quell'account
//    (e clients.client_user_id valorizzato: ponte esplicito)
//  • se createAccess && email e l'utente non esiste → crea auth user + profilo + link attivo
//  • altrimenti → solo la scheda CRM, nessun link (un link senza account non serve a nulla:
//    è la situazione normale di un cliente seguito in studio senza app)
export async function POST(req: NextRequest) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()

  const professionalId = typeof body.professional_id === 'string' ? body.professional_id : ''
  const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
  const cognome = typeof body.cognome === 'string' ? body.cognome.trim() : ''
  if (!professionalId) return NextResponse.json({ error: 'missing_professional' }, { status: 400 })
  if (!nome && !cognome) return NextResponse.json({ error: 'missing_name' }, { status: 400 })

  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim().toLowerCase() : null
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }

  // Verifica che il professionista esista.
  const { data: prof } = await admin.from('profiles').select('id').eq('id', professionalId).maybeSingle()
  if (!prof) return NextResponse.json({ error: 'professional_not_found' }, { status: 404 })

  // Doppione sotto lo stesso professionista (stessa email)?
  if (email) {
    const { data: dup } = await admin.from('clients').select('id').eq('professionista_id', professionalId).ilike('email', email).limit(1)
    if ((dup ?? []).length > 0) {
      return NextResponse.json({ error: 'duplicate_client', message: 'Questo professionista ha già una scheda con questa email.' }, { status: 409 })
    }
  }

  // 1. Account del cliente: esistente (per email) oppure da creare.
  let clientUserId: string | null = null
  let accessError: string | null = null
  let accountCreated = false
  if (email) {
    const { data } = await admin.from('profiles').select('id').ilike('email', email).limit(1)
    clientUserId = ((data ?? []) as Array<{ id: string }>)[0]?.id ?? null
  }
  if (!clientUserId && body.createAccess && email) {
    const password = typeof body.password === 'string' && body.password.length >= 8 ? body.password : randomUUID()
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, cognome, role: 'client' },
    })
    if (authErr) {
      accessError = authErr.message
    } else if (created.user) {
      clientUserId = created.user.id
      accountCreated = true
      await admin.from('profiles').upsert({
        id: clientUserId,
        email,
        nome: nome || null,
        cognome: cognome || null,
        role: 'client',
      })
    }
  }

  // 2. Inserisci la scheda (clients.id è TEXT → UUID stringa), col ponte esplicito.
  const clientId = randomUUID()
  const clientRow: Record<string, unknown> = {
    id: clientId,
    professionista_id: professionalId,
    nome: nome || null,
    cognome: cognome || null,
    email,
    client_user_id: clientUserId,
  }
  if (typeof body.telefono === 'string' && body.telefono.trim()) clientRow.telefono = body.telefono.trim()
  if (typeof body.data_nascita === 'string' && body.data_nascita) clientRow.data_nascita = body.data_nascita
  if (body.sesso === 'M' || body.sesso === 'F' || body.sesso === 'X') clientRow.sesso = body.sesso

  const { error: clientErr } = await admin.from('clients').insert(clientRow)
  if (clientErr) return NextResponse.json({ error: `client: ${clientErr.message}` }, { status: 500 })

  // 3. Collegamento account↔professionista (solo se c'è un account).
  let linkId: string | null = null
  let linkWarning: string | null = null
  if (clientUserId) {
    const { data: existing } = await admin
      .from('client_professional_links')
      .select('id')
      .eq('professional_id', professionalId)
      .eq('client_user_id', clientUserId)
      .limit(1)
    const ex = ((existing ?? []) as Array<{ id: string }>)[0]
    if (ex) {
      const { error } = await admin
        .from('client_professional_links')
        .update({ status: 'active', client_id: clientId, updated_at: new Date().toISOString() })
        .eq('id', ex.id)
      if (error) linkWarning = `link: ${error.message}`
      else linkId = ex.id
    } else {
      const { data, error } = await admin
        .from('client_professional_links')
        .insert({ client_id: clientId, professional_id: professionalId, client_user_id: clientUserId, status: 'active' })
        .select('id')
        .single()
      if (error) linkWarning = `link: ${error.message}`
      else linkId = (data as { id: string }).id
    }
  }

  await logAdminAction(admin, guard.user, {
    action: 'create_client',
    target_type: 'client',
    target_id: clientId,
    details: { professional_id: professionalId, email, client_user_id: clientUserId, account_created: accountCreated, link_id: linkId },
  })

  return NextResponse.json({
    ok: true,
    client_id: clientId,
    client_user_id: clientUserId,
    account_created: accountCreated,
    linked: !!linkId,
    warning: linkWarning,
    accessError,
  })
}
