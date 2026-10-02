import type { SupabaseClient } from '@supabase/supabase-js'

// =============================================================================
// "Crea accesso cliente": l'albero delle decisioni, con esiti espliciti
// =============================================================================
//
// ⚠️ PORTING DA TENERE IN PARI con l'Edge Function
// `supabase/functions/create-client-access/index.ts`, che gira in Deno e non
// può importare da qui. Stesso albero, stessi valori di `result`, stessi
// criteri: se cambia uno dei due, cambia l'altro. L'Edge Function è la via
// dell'app Flutter, questo modulo è la via del sito.
//
// CONTRATTO — sei valori, `result` vale sempre uno di:
//
//   invited                email nuova: invito inviato, collegamento attivo
//   link_pending           account cliente esistente: collegamento creato, in
//                          attesa che il cliente confermi dall'app
//   already_linked_to_you  già collegato a chi chiama: niente da fare
//   already_linked_other   cliente già collegato a un altro professionista:
//                          nessun cambiamento
//   is_professional        email di un account professionista: nessun
//                          cambiamento, nessun link nemmeno pending
//   error                  errore imprevisto, con messaggio leggibile
//
// Perché pending e non active: con un account che esiste già non c'è nessun
// giro di posta che provi il consenso dell'intestatario. Le policy della 019
// sono tutte su `status = 'active'`, quindi un link pending non fa passare un
// solo dato. Vedi `supabase-migrations/sito-031_collegamento_in_attesa.sql`.

export type LinkRequestResult =
  | 'invited'
  | 'link_pending'
  | 'already_linked_other'
  | 'already_linked_to_you'
  | 'is_professional'
  | 'error'

export type LinkRequestOutcome = {
  result: LinkRequestResult
  /** Codice stabile per la UI quando `result` è `error`. */
  code?: string
  /** Dettaglio tecnico, per il registro e i log: non è un testo da mostrare. */
  detail?: string
  clientUserId?: string | null
  clientId?: string | null
  linkStatus?: string | null
  /** Chi ha chiesto il collegamento: l'app mostra Accetta/Rifiuta al cliente
   *  quando vale `professional_id` (colonna di app-035). */
  requestedBy?: string | null
  role?: string | null
  otherProfessionals?: string[]
  inviteSent?: boolean
  merged?: string[]
}

type Profilo = { id: string; role: string | null }

/** Utente già registrato con quella email: prima il profilo, poi l'elenco auth. */
async function trovaUtente(admin: SupabaseClient, email: string): Promise<Profilo | null> {
  const { data } = await admin.from('profiles').select('id, role').ilike('email', email).limit(1)
  const riga = ((data ?? []) as Profilo[])[0]
  if (riga?.id) return riga

  for (let page = 1; page <= 20; page++) {
    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 500 })
    if (error || !list?.users?.length) break
    const trovato = list.users.find((u) => (u.email ?? '').toLowerCase() === email)
    if (trovato) {
      // Account auth senza profilo: il ruolo è ignoto, e "ignoto" non è
      // "cliente". Si restituisce null e decide il chiamante.
      const { data: p } = await admin.from('profiles').select('role').eq('id', trovato.id).maybeSingle()
      return { id: trovato.id, role: (p as { role?: string | null } | null)?.role ?? null }
    }
    if (list.users.length < 500) break
  }
  return null
}

/**
 * Crea l'accesso app per il cliente di una scheda e restituisce un esito
 * esplicito. Non lancia: ogni strada finisce in un `result`.
 *
 * `professionalId` deve essere già autorizzato sulla scheda dal chiamante
 * (requireClientScope): qui si usa la service_role, che salta la RLS.
 */
export async function requestClientAccess(
  admin: SupabaseClient,
  opts: {
    professionalId: string
    clientId: string
    email: string
    nome: string
    cognome: string
  },
): Promise<LinkRequestOutcome> {
  const email = opts.email.trim().toLowerCase()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { result: 'error', code: 'invalid_email' }
  }

  const esistente = await trovaUtente(admin, email)

  // ── 1. Account NON cliente: nessun link, nemmeno pending ───────────────────
  if (esistente?.role && esistente.role !== 'client') {
    return { result: 'is_professional', clientUserId: esistente.id, role: esistente.role }
  }

  if (esistente) {
    // ── 2. Collegamenti vivi già esistenti ───────────────────────────────────
    const { data: linkRows, error: linkErr } = await admin
      .from('client_professional_links')
      .select('professional_id, status')
      .eq('client_user_id', esistente.id)
      .neq('status', 'revoked')
    if (linkErr) {
      return { result: 'error', code: 'links_unreadable', detail: linkErr.message }
    }
    const vivi = (linkRows ?? []) as Array<{ professional_id: string; status: string }>
    const mio = vivi.find((l) => l.professional_id === opts.professionalId)
    if (mio) {
      return { result: 'already_linked_to_you', clientUserId: esistente.id, linkStatus: mio.status }
    }
    const altrui = vivi.filter((l) => l.professional_id !== opts.professionalId && l.status === 'active')
    if (altrui.length > 0) {
      return {
        result: 'already_linked_other',
        clientUserId: esistente.id,
        otherProfessionals: altrui.map((l) => l.professional_id),
      }
    }

    // ── 3. Cliente libero: collegamento IN ATTESA, mai active ────────────────
    //
    // `requested_by = professional_id` lo scrive la RPC, non questo codice: i
    // collegamenti si scrivono da UNA sola strada, e un UPDATE diretto qui
    // aprirebbe la seconda. È il valore a cui l'app aggancia Accetta/Rifiuta
    // (client_respond_to_link, app-035).
    const { data: rpc, error: rpcErr } = await admin.rpc('request_client_link', {
      p_client_user_id: esistente.id,
      p_professional_id: opts.professionalId,
      p_source: 'web:existing',
    })
    // Funzione assente = migration 031 non applicata. NON si ripiega su
    // link_client_to_professional: creerebbe un link active senza consenso,
    // che è esattamente il buco che la 031 chiude.
    if (rpcErr && (rpcErr.code === 'PGRST202' || /request_client_link/.test(rpcErr.message ?? ''))) {
      return { result: 'error', code: 'migration_031_missing', clientUserId: esistente.id }
    }
    const res = (rpc ?? null) as
      | { ok?: boolean; error?: string; client_id?: string; link_status?: string; requested_by?: string; merged?: string[] }
      | null
    if (rpcErr || !res?.ok) {
      return {
        result: 'error',
        code: 'link_failed',
        detail: rpcErr?.message ?? res?.error ?? 'collegamento non riuscito',
        clientUserId: esistente.id,
      }
    }
    // Con una 031 vecchia (senza `requested_by`) il link resterebbe pending ma
    // all'app non comparirebbe MAI fra le richieste da accettare: una
    // richiesta persa in silenzio. Meglio dirlo che far aspettare il cliente.
    if (res.requested_by !== opts.professionalId) {
      return {
        result: 'error',
        code: 'requested_by_non_scritto',
        detail: `requested_by = ${res.requested_by ?? 'null'}, atteso ${opts.professionalId}`,
        clientUserId: esistente.id,
        clientId: res.client_id ?? opts.clientId,
      }
    }
    return {
      result: 'link_pending',
      clientUserId: esistente.id,
      clientId: res.client_id ?? opts.clientId,
      linkStatus: res.link_status ?? 'pending',
      requestedBy: res.requested_by,
      merged: res.merged ?? [],
    }
  }

  // ── 4. Email nuova: invito. Qui il consenso è il click sul link ────────────
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nome: opts.nome, cognome: opts.cognome, role: 'client' },
  })
  if (inviteErr || !invited?.user) {
    const raw = (inviteErr?.message ?? '').toLowerCase()
    const code = (inviteErr as { code?: string } | null)?.code
    const corsa =
      code === 'email_exists' || inviteErr?.status === 422 ||
      raw.includes('already') || raw.includes('registered') || raw.includes('exists')
    return {
      result: 'error',
      code: corsa ? 'email_exists_retry' : 'auth_create_failed',
      detail: inviteErr?.message ?? undefined,
    }
  }
  const userId = invited.user.id

  const { error: profErr } = await admin.from('profiles').upsert(
    { id: userId, email, nome: opts.nome, cognome: opts.cognome, role: 'client', created_at: new Date().toISOString() },
    { onConflict: 'id' },
  )
  if (profErr) {
    // Rollback: un utente auth senza profilo non riuscirebbe a entrare.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    return {
      result: 'error',
      code: 'profile_failed',
      detail: `${profErr.message}${delErr ? ` (utente NON eliminato: ${delErr.message})` : ' (utente eliminato)'}`,
    }
  }

  const { data: rpc, error: rpcErr } = await admin.rpc('link_client_to_professional', {
    p_client_user_id: userId,
    p_professional_id: opts.professionalId,
    p_source: 'web:invito',
  })
  const res = (rpc ?? null) as
    | { ok?: boolean; error?: string; client_id?: string; link_status?: string; merged?: string[] }
    | null
  if (rpcErr || !res?.ok) {
    const { error: pErr } = await admin.from('profiles').delete().eq('id', userId)
    const { error: uErr } = await admin.auth.admin.deleteUser(userId)
    return {
      result: 'error',
      code: 'link_failed',
      detail: `${rpcErr?.message ?? res?.error ?? 'collegamento non riuscito'} — rollback: profilo ${pErr ? 'NON eliminato' : 'eliminato'}, utente ${uErr ? 'NON eliminato' : 'eliminato'}`,
    }
  }

  return {
    result: 'invited',
    clientUserId: userId,
    clientId: res.client_id ?? opts.clientId,
    linkStatus: res.link_status ?? 'active',
    inviteSent: true,
    merged: res.merged ?? [],
  }
}
