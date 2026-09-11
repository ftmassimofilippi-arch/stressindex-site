// ── Edge Function: create-client-access (v2, flusso unico) ───────────────────
//
// Crea l'accesso app per un cliente del CRM con un INVITO via email e lo
// collega al professionista chiamante passando dal punto di verità lato
// database: link_client_to_professional (migration 019 del sito).
//
//   1. identifica il professionista dal JWT (mai dal body);
//   2. inviteUserByEmail: Supabase Auth crea l'utente e manda la mail con il
//      link per impostare la password. Se l'email esiste già (email_exists)
//      NON è un errore: si risolve l'utente esistente e si passa al punto 4;
//   3. profilo in `profiles` (role='client', nome/cognome NOT NULL);
//   4. RPC link_client_to_professional(userId, professionalId, 'edge:...'):
//      trova o crea la scheda `clients` con il ponte client_user_id, unisce
//      eventuali doppioni per email, crea o riattiva il link active. È
//      idempotente: chiamarla due volte non crea nulla in più.
//   5. se la RPC risponde ok=false l'errore torna ESPLICITO al chiamante
//      ({ ok:false, code:'link_failed', message, rpc }); il rollback
//      (utente + profilo creati in questa chiamata) viene tentato e il suo
//      esito è riportato nella risposta, mai ignorato.
//
// La scheda `clients` NON viene più scritta qui né dall'app: la gestisce la
// RPC. L'app deve solo chiamare questa function e poi ricaricare i clienti.
//
// Deploy (dal repo del sito, che contiene questa versione):
//   supabase functions deploy create-client-access --project-ref ivwmjwukpeldbqkxgvvf
// La copia in hrv_app/supabase/functions/create-client-access va rimossa.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Payload {
  email?: string
  nome?: string
  cognome?: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return json({ ok: false, code: 'server_misconfigured', message: 'Variabili ambiente mancanti.' }, 500)
  }

  // 1. Professionista chiamante dal JWT.
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ ok: false, code: 'unauthorized', message: 'Token mancante.' }, 401)
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
  const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser()
  if (callerErr || !caller) return json({ ok: false, code: 'unauthorized', message: 'Sessione non valida.' }, 401)
  const professionalId = caller.id

  // 2. Input.
  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return json({ ok: false, code: 'bad_request', message: 'Body non valido.' }, 400)
  }
  const email = (payload.email ?? '').trim().toLowerCase()
  const nome = (payload.nome ?? '').trim()
  const cognome = (payload.cognome ?? '').trim()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ ok: false, code: 'invalid_email', message: 'Email non valida.' }, 400)
  }
  if (!nome || !cognome) return json({ ok: false, code: 'missing_name', message: 'Nome e cognome sono obbligatori.' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

  // 3. Invito (o utente già esistente).
  let userId: string | null = null
  let createdHere = false
  let emailSent = false
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nome, cognome, role: 'client' },
  })
  if (inviteErr || !invited?.user) {
    const raw = (inviteErr?.message ?? '').toLowerCase()
    const code = (inviteErr as { code?: string } | null)?.code
    const alreadyExists =
      code === 'email_exists' || inviteErr?.status === 422 || raw.includes('already') || raw.includes('registered') || raw.includes('exists')
    if (!alreadyExists) {
      return json({ ok: false, code: 'auth_create_failed', message: inviteErr?.message ?? 'Invio invito fallito.' }, 500)
    }
    // Email già registrata: risolvi l'utente (profilo, poi elenco auth) e collega.
    const { data: prof } = await admin.from('profiles').select('id, role').ilike('email', email).limit(1)
    userId = ((prof ?? []) as Array<{ id: string }>)[0]?.id ?? null
    if (!userId) {
      let page = 1
      while (!userId && page <= 20) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 500 })
        if (listErr || !list?.users?.length) break
        const found = list.users.find((u) => (u.email ?? '').toLowerCase() === email)
        if (found) userId = found.id
        if (list.users.length < 500) break
        page++
      }
    }
    if (!userId) {
      return json({ ok: false, code: 'email_exists_unresolved', message: 'Esiste già un account con questa email ma non è stato possibile identificarlo.' }, 409)
    }
    // Il profilo potrebbe mancare (account creato altrove): garantiscilo senza sovrascrivere il ruolo.
    const { data: existingProfile } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle()
    if (!existingProfile) {
      const { error: profErr } = await admin.from('profiles').upsert(
        { id: userId, email, nome, cognome, role: 'client', created_at: new Date().toISOString() },
        { onConflict: 'id' },
      )
      if (profErr) return json({ ok: false, code: 'profile_failed', message: `Creazione profilo fallita: ${profErr.message}` }, 500)
    }
  } else {
    userId = invited.user.id
    createdHere = true
    emailSent = true
    // 3b. Profilo (nome/cognome NOT NULL).
    const { error: profErr } = await admin.from('profiles').upsert(
      { id: userId, email, nome, cognome, role: 'client', created_at: new Date().toISOString() },
      { onConflict: 'id' },
    )
    if (profErr) {
      const { error: delErr } = await admin.auth.admin.deleteUser(userId)
      return json(
        { ok: false, code: 'profile_failed', message: `Creazione profilo fallita: ${profErr.message}`, rollback: delErr ? `utente NON eliminato: ${delErr.message}` : 'utente eliminato' },
        500,
      )
    }
  }

  // 4. Punto di verità: scheda + link, idempotente.
  const { data: rpc, error: rpcErr } = await admin.rpc('link_client_to_professional', {
    p_client_user_id: userId,
    p_professional_id: professionalId,
    p_source: createdHere ? 'edge:invite' : 'edge:existing',
  })
  const result = (rpc ?? null) as { ok?: boolean; error?: string; client_id?: string; link_status?: string; action?: string; card_action?: string; merged?: string[] } | null

  if (rpcErr || !result?.ok) {
    const message = rpcErr?.message ?? result?.error ?? 'collegamento non riuscito'
    // 5. Rollback SOLO di ciò che questa chiamata ha creato, con esito esplicito.
    let rollback = 'nessun rollback (account preesistente)'
    if (createdHere && userId) {
      const { error: pErr } = await admin.from('profiles').delete().eq('id', userId)
      const { error: uErr } = await admin.auth.admin.deleteUser(userId)
      rollback = pErr || uErr
        ? `rollback INCOMPLETO: profilo ${pErr ? 'NON eliminato (' + pErr.message + ')' : 'eliminato'}, utente ${uErr ? 'NON eliminato (' + uErr.message + ')' : 'eliminato'}`
        : 'profilo e utente eliminati'
    }
    return json({ ok: false, code: 'link_failed', message, rpc: result, rollback, userId, emailSent }, 500)
  }

  return json({
    ok: true,
    userId,
    email,
    emailSent,
    createdHere,
    clientId: result.client_id,
    linkStatus: result.link_status,
    action: result.action,
    cardAction: result.card_action,
    merged: result.merged ?? [],
  })
})
