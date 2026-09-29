import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireProfessional } from '@/lib/professional-guard'
import { linkViaRpc, nextClientCardId } from '@/lib/collegamenti'
import { logAccessAction } from '@/lib/client-access'
import { apiError } from '@/lib/api-error'
import { rigaClients, validaClientForm, type ClientFormData, type ErroriForm } from '@/lib/client-form'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =============================================================================
// POST /api/clienti — il professionista crea un suo cliente dal sito
// =============================================================================
//
// Replica il flusso dell'app Flutter (client_form_screen._save + Edge Function
// create-client-access + RPC link_client_to_professional), nello stesso ordine e
// con le stesse regole:
//
//   1. validazione identica al form dell'app (src/lib/client-form.ts);
//   2. DOPPIONE PER EMAIL, prima di scrivere qualsiasi cosa: se questo
//      professionista ha già una scheda non archiviata con quella email non se
//      ne crea una seconda, si risponde 409 con l'id di quella esistente e il
//      sito propone di aprirla — come fa l'app con _openExistingCard;
//   3. account del cliente: se l'email è già di un utente registrato NON si
//      crea un duplicato e non si tocca la sua password, si collega quello che
//      c'è. Altrimenti, e solo se richiesto, si crea: invito via email oppure
//      password temporanea scelta dal professionista;
//   4. scheda `clients` con id epoch-millis (il formato che l'app sa leggere) e
//      il ponte `client_user_id` già valorizzato;
//   5. collegamento via RPC link_client_to_professional, unico punto di verità
//      per client_professional_links.
//
// La service_role serve ai passi 3 e 5 e non lascia mai il server. Il
// professionista è quello del cookie di sessione, mai un id preso dal body.

type Body = Partial<ClientFormData>

function testo(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function boolOrNull(v: unknown): boolean | null {
  return v === true || v === false ? v : null
}

/** Body grezzo → ClientFormData, così la validazione è la stessa del browser. */
function leggiForm(body: Body): ClientFormData {
  const mode = body.accessMode
  return {
    nome: testo(body.nome),
    cognome: testo(body.cognome),
    data_nascita: testo(body.data_nascita),
    sesso: testo(body.sesso),
    peso: testo(body.peso),
    altezza: testo(body.altezza),
    fumatore: boolOrNull(body.fumatore),
    atleta: boolOrNull(body.atleta),
    livello_attivita: testo(body.livello_attivita),
    email: testo(body.email),
    telefono: testo(body.telefono),
    note: testo(body.note),
    sport: testo(body.sport),
    competitive_level: testo(body.competitive_level),
    current_goal: testo(body.current_goal),
    hr_max: testo(body.hr_max),
    ftp_estimated: testo(body.ftp_estimated),
    accessMode: mode === 'invito' || mode === 'password' || mode === 'nessuno' ? mode : 'nessuno',
    password: testo(body.password),
  }
}

/** L'utente auth con questa email, se esiste. Prima i profili, poi l'elenco auth. */
async function trovaUtentePerEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const { data } = await admin.from('profiles').select('id, role').ilike('email', email).limit(5)
  const righe = (data ?? []) as Array<{ id: string; role: string | null }>
  const client = righe.find((r) => r.role === 'client')
  if (client) return client.id
  if (righe.length === 1) return righe[0].id

  // Utente auth senza profilo: capita per gli account nati fuori dall'app.
  let pagina = 1
  while (pagina <= 20) {
    const { data: lista, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 500 })
    if (error || !lista?.users?.length) break
    const trovato = lista.users.find((u) => (u.email ?? '').toLowerCase() === email)
    if (trovato) return trovato.id
    if (lista.users.length < 500) break
    pagina++
  }
  return null
}

export async function POST(req: NextRequest) {
  const guard = await requireProfessional()
  if (guard.error) return guard.error
  const professionalId = guard.user.id

  const body = (await req.json().catch(() => ({}))) as Body
  const form = leggiForm(body)

  // ── 1. Validazione ─────────────────────────────────────────────────────────
  const errori: ErroriForm = validaClientForm(form)
  if (Object.keys(errori).length > 0) {
    // `errors`: per campo, chiave in clients.form.validation + valori (vedi client-form.ts).
    return apiError('validation_failed', 400, { errors: errori })
  }
  const email = form.email.trim().toLowerCase()

  const admin = createAdminClient()

  // ── 2. Doppione per email sotto lo stesso professionista ───────────────────
  const { data: doppioni, error: dupErr } = await admin
    .from('clients')
    .select('id, nome, cognome')
    .eq('professionista_id', professionalId)
    .ilike('email', email)
    .is('merged_into_client_id', null)
    .limit(1)
  if (dupErr) {
    return apiError('duplicate_check_failed', 500, { detail: dupErr.message })
  }
  const esistente = (doppioni ?? [])[0] as { id: string; nome: string | null; cognome: string | null } | undefined
  if (esistente) {
    // Il testo lo compone il browser (clients.form.duplicate) con client_name;
    // se la scheda non ha un nome il browser usa il proprio fallback.
    const nomeEsistente = [esistente.nome, esistente.cognome].filter(Boolean).join(' ').trim()
    return apiError('duplicate_client', 409, {
      client_id: esistente.id,
      client_name: nomeEsistente || null,
    })
  }

  // ── 3. Account del cliente ─────────────────────────────────────────────────
  let clientUserId = await trovaUtentePerEmail(admin, email)
  const emailGiaRegistrata = !!clientUserId
  let createdHere = false
  let inviteSent = false
  // Codice di errors.api.* (tradotto dal browser) oppure il messaggio grezzo
  // di Supabase quando non c'è un codice adatto.
  let accessError: string | null = null
  let passwordImpostata = false

  if (!clientUserId && form.accessMode !== 'nessuno') {
    const nome = form.nome.trim()
    const cognome = form.cognome.trim()

    if (form.accessMode === 'invito') {
      const { data: invitato, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { nome, cognome, role: 'client' },
      })
      if (invErr || !invitato?.user) {
        // L'email può essere comparsa fra la ricerca e ora, o esistere senza
        // profilo e senza comparire nell'elenco: si ritenta la risoluzione.
        const raw = (invErr?.message ?? '').toLowerCase()
        const code = (invErr as { code?: string } | null)?.code
        const esisteGia =
          code === 'email_exists' || invErr?.status === 422 ||
          raw.includes('already') || raw.includes('registered') || raw.includes('exists')
        if (esisteGia) clientUserId = await trovaUtentePerEmail(admin, email)
        if (!clientUserId) accessError = invErr?.message ?? 'invite_failed'
      } else {
        clientUserId = invitato.user.id
        createdHere = true
        inviteSent = true
      }
    } else {
      const { data: creato, error: crErr } = await admin.auth.admin.createUser({
        email,
        password: form.password,
        email_confirm: true,
        user_metadata: { nome, cognome, role: 'client' },
      })
      if (crErr || !creato?.user) {
        const raw = (crErr?.message ?? '').toLowerCase()
        const code = (crErr as { code?: string } | null)?.code
        const esisteGia =
          code === 'email_exists' || crErr?.status === 422 ||
          raw.includes('already') || raw.includes('registered') || raw.includes('exists')
        if (esisteGia) clientUserId = await trovaUtentePerEmail(admin, email)
        if (!clientUserId) accessError = crErr?.message ?? 'account_create_failed'
      } else {
        clientUserId = creato.user.id
        createdHere = true
        passwordImpostata = true
      }
    }
  }

  // Profilo: garantito senza toccare il ruolo di un account preesistente.
  if (clientUserId) {
    const { data: profEsistente } = await admin.from('profiles').select('id').eq('id', clientUserId).maybeSingle()
    if (!profEsistente) {
      const riga: Record<string, unknown> = {
        id: clientUserId,
        email,
        nome: form.nome.trim() || null,
        cognome: form.cognome.trim() || null,
        role: 'client',
        created_at: new Date().toISOString(),
      }
      // La password l'ha scelta il professionista: il cliente deve cambiarla.
      if (passwordImpostata) riga.must_change_password = true
      let { error: profErr } = await admin.from('profiles').upsert(riga, { onConflict: 'id' })
      if (profErr?.code === '42703') {
        // Migration 027 non applicata: si riprova senza il flag.
        delete riga.must_change_password
        accessError = 'migration_027_missing'
        ;({ error: profErr } = await admin.from('profiles').upsert(riga, { onConflict: 'id' }))
      }
      if (profErr) {
        // Rollback di ciò che questa chiamata ha creato, altrimenti resta un
        // utente auth senza profilo che non riuscirebbe a entrare.
        // `rollback` è diagnostico (log, non UI).
        let rollback = 'none_preexisting_account'
        if (createdHere) {
          const { error: delErr } = await admin.auth.admin.deleteUser(clientUserId)
          rollback = delErr ? `user_not_deleted: ${delErr.message}` : 'user_deleted'
        }
        return apiError('profile_failed', 500, { detail: profErr.message, rollback })
      }
    } else if (passwordImpostata) {
      const { error: flagErr } = await admin
        .from('profiles')
        .update({ must_change_password: true })
        .eq('id', clientUserId)
      if (flagErr && flagErr.code === '42703') {
        accessError = 'migration_027_missing'
      }
    }
  }

  // ── 4. Scheda cliente ──────────────────────────────────────────────────────
  const clientId = await nextClientCardId(admin)
  const riga = rigaClients(form, clientId, professionalId)
  if (clientUserId) riga.client_user_id = clientUserId

  const { error: cardErr } = await admin.from('clients').insert(riga)
  if (cardErr) {
    let rollback = 'none_preexisting_account'
    if (createdHere && clientUserId) {
      await admin.from('profiles').delete().eq('id', clientUserId)
      const { error: delErr } = await admin.auth.admin.deleteUser(clientUserId)
      rollback = delErr ? `user_not_deleted: ${delErr.message}` : 'profile_and_user_deleted'
    }
    return apiError('client_failed', 500, { detail: cardErr.message, rollback })
  }

  // ── 5. Collegamento ────────────────────────────────────────────────────────
  // Se fallisce la scheda RESTA: è un dato buono del professionista, e il
  // collegamento si può ritentare. Si segnala, non si distrugge niente.
  let linkId: string | null = null
  let linkWarning: string | null = null
  let merged: string[] = []
  if (clientUserId) {
    const source = createdHere ? (inviteSent ? 'web:invito' : 'web:password') : 'web:existing'
    const rpc = await linkViaRpc(admin, clientUserId, professionalId, source)
    if (rpc.ok) {
      linkId = rpc.result.link_id ?? null
      merged = rpc.result.merged ?? []
    } else {
      linkWarning = rpc.error
    }
  }

  if (clientUserId) {
    await logAccessAction(admin, {
      professionalId,
      clientId,
      clientUserId,
      action: 'create_access',
      details: {
        mode: form.accessMode,
        created_here: createdHere,
        invite_sent: inviteSent,
        password_set: passwordImpostata,
        email_already_registered: emailGiaRegistrata,
        link_id: linkId,
      },
    })
  }

  return NextResponse.json({
    ok: true,
    client_id: clientId,
    client_user_id: clientUserId,
    // true se l'email era già di un utente: nessun duplicato, nessun invito.
    emailAlreadyRegistered: emailGiaRegistrata,
    accountCreated: createdHere,
    inviteSent,
    passwordSet: passwordImpostata,
    linked: !!linkId,
    merged,
    linkWarning,
    accessError,
  })
}
