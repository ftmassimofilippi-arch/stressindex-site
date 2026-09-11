import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { getAdminClients } from '@/lib/admin-data'
import { logAdminAction } from '@/lib/admin-audit'
import { linkViaRpc, nextClientCardId } from '@/lib/collegamenti'

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
// Regole (flusso unico, migration 019):
//  • l'id della scheda è nel formato dell'app (epoch ms in TEXT): i vecchi id
//    uuid creati qui erano invisibili all'app, che carica le schede per id numerico;
//  • se l'email corrisponde a un utente registrato (o se createAccess crea
//    l'account) il collegamento passa da link_client_to_professional, che
//    scrive il ponte clients.client_user_id, unisce doppioni e crea il link.
//    Nessun insert diretto in client_professional_links, mai client_id uuid;
//  • senza account: solo la scheda (nessun link possibile).
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

  // Doppione sotto lo stesso professionista (stessa email, schede non archiviate)?
  if (email) {
    const { data: dup } = await admin.from('clients').select('id').eq('professionista_id', professionalId).ilike('email', email).is('merged_into_client_id', null).limit(1)
    if ((dup ?? []).length > 0) {
      return NextResponse.json({ error: 'duplicate_client', message: 'Questo professionista ha già una scheda con questa email.' }, { status: 409 })
    }
  }

  // 1. Account del cliente: esistente (per email) oppure da creare.
  let clientUserId: string | null = null
  let accessError: string | null = null
  let accountCreated = false
  if (email) {
    const { data } = await admin.from('profiles').select('id, role').ilike('email', email).limit(5)
    const rows = (data ?? []) as Array<{ id: string; role: string | null }>
    clientUserId = (rows.find((r) => r.role === 'client') ?? (rows.length === 1 ? rows[0] : undefined))?.id ?? null
  }
  if (!clientUserId && body.createAccess && email) {
    const password = typeof body.password === 'string' && body.password.length >= 8 ? body.password : crypto.randomUUID()
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
      const { error: profErr } = await admin.from('profiles').upsert({
        id: clientUserId,
        email,
        nome: nome || null,
        cognome: cognome || null,
        role: 'client',
      })
      if (profErr) accessError = `profilo: ${profErr.message}`
    }
  }

  // 2. Scheda con id epoch (formato app) e ponte esplicito.
  const clientId = await nextClientCardId(admin)
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

  // 3. Collegamento account↔professionista (solo se c'è un account): la RPC
  //    trova la scheda appena creata dal ponte e crea/riattiva il link.
  let linkId: string | null = null
  let linkWarning: string | null = null
  if (clientUserId) {
    const rpc = await linkViaRpc(admin, clientUserId, professionalId, 'admin:crea_scheda')
    if (rpc.ok) linkId = rpc.result.link_id ?? null
    else linkWarning = `link: ${rpc.error}`
  }

  await logAdminAction(admin, guard.user, {
    action: 'create_client',
    target_type: 'client',
    target_id: clientId,
    details: { professional_id: professionalId, email, client_user_id: clientUserId, account_created: accountCreated, link_id: linkId, link_warning: linkWarning },
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
