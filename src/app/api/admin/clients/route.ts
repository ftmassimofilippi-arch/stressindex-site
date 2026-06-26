import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { getAdminClients } from '@/lib/admin-data'

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

// POST /api/admin/clients — crea un nuovo cliente e lo associa a un professionista.
// Body: { professional_id, nome, cognome, email?, telefono?, data_nascita?, sesso?,
//         createAccess?: boolean, password? }
// Se createAccess && email: crea anche l'utente auth del cliente + collegamento attivo
// (riproduce la logica della Edge Function create-client-access).
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

  // 1. Inserisci il cliente (clients.id è TEXT → usiamo un UUID stringa).
  const clientId = randomUUID()
  const clientRow: Record<string, unknown> = {
    id: clientId,
    professionista_id: professionalId,
    nome: nome || null,
    cognome: cognome || null,
    email,
  }
  if (typeof body.telefono === 'string' && body.telefono.trim()) clientRow.telefono = body.telefono.trim()
  if (typeof body.data_nascita === 'string' && body.data_nascita) clientRow.data_nascita = body.data_nascita
  if (body.sesso === 'M' || body.sesso === 'F' || body.sesso === 'X') clientRow.sesso = body.sesso

  const { error: clientErr } = await admin.from('clients').insert(clientRow)
  if (clientErr) return NextResponse.json({ error: `client: ${clientErr.message}` }, { status: 500 })

  // 2. (Opzionale) crea l'accesso del cliente: utente auth + profilo + collegamento.
  let clientUserId: string | null = null
  let accessError: string | null = null
  if (body.createAccess && email) {
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
      await admin.from('profiles').upsert({
        id: clientUserId,
        email,
        nome: nome || null,
        cognome: cognome || null,
        role: 'client',
      })
    }
  }

  // 3. Crea il collegamento cliente↔professionista (status attivo).
  const linkRow: Record<string, unknown> = {
    client_id: clientId,
    professional_id: professionalId,
    status: 'active',
  }
  if (clientUserId) linkRow.client_user_id = clientUserId
  const { error: linkErr } = await admin.from('client_professional_links').insert(linkRow)
  if (linkErr) {
    // il cliente è creato ma il link no: segnala senza fallire del tutto
    return NextResponse.json({ ok: true, client_id: clientId, warning: `link: ${linkErr.message}`, accessError })
  }

  return NextResponse.json({ ok: true, client_id: clientId, client_user_id: clientUserId, accessError })
}
