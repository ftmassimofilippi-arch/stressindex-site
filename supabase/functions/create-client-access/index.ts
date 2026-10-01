// ── Edge Function: create-client-access (v3, esito esplicito) ────────────────
//
// "Crea account cliente": il professionista dà una email e si aspetta di
// sapere COSA è successo. La v2 aveva un solo esito buono e per un account già
// esistente restituiva ok:true senza email e senza spiegazioni — e nel caso
// peggiore (l'email era di un'altra PROFESSIONISTA) collegava il suo account
// come cliente, perché la 019 sul ruolo non-client si limita a un warning.
//
// CONTRATTO, identico nell'app e nel sito. `result` vale sempre uno di:
//
//   invited               email nuova: invito inviato, link attivo
//   link_pending          account cliente esistente: collegamento creato, IN
//                         ATTESA che il cliente confermi dall'app
//   already_linked_other  cliente già collegato a un altro professionista:
//                         nessun cambiamento
//   is_professional       email di un account professionista: nessun
//                         cambiamento, NESSUN link, nemmeno pending
//   error                 errore imprevisto, con messaggio leggibile
//
//   already_linked_self   (fuori contratto, da confermare) il cliente è GIÀ
//                         collegato a CHI sta chiamando: nulla da fare. Non
//                         rientra in nessuno dei cinque senza mentire, e
//                         `already_linked_other` direbbe il falso.
//
// PERCHÉ pending E NON active
// Con un invito nuovo il consenso è la persona che clicca il link nell'email.
// Con un account che esiste già non c'è nessun giro di posta: chi conosce un
// indirizzo si tirerebbe in dashboard lo storico HRV di quella persona. Le
// policy della 019 sono tutte su `status = 'active'`, quindi un link pending
// non fa passare un solo dato: il modo in cui questo può andare male diventa
// "un professionista aspetta", non "un estraneo legge dati di salute".
// La conferma la dà il cliente dall'app; il superadmin è la via di riserva.
//
// DIPENDENZA: il pending si scrive con la RPC `request_client_link`
// (migration sito-031, da applicare a mano). Se manca, questa funzione NON
// ripiega su un link active — restituisce `error` dicendo quale migration
// applicare. Un ripiego silenzioso su active sarebbe esattamente il buco che
// la 031 esiste per chiudere.
//
// Deploy:
//   supabase functions deploy create-client-access --project-ref ivwmjwukpeldbqkxgvvf

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { esc, inviaEmail } from '../_shared/notify-core.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Result =
  | 'invited'
  | 'link_pending'
  | 'already_linked_other'
  | 'already_linked_self'
  | 'is_professional'
  | 'error'

interface Payload {
  email?: string
  nome?: string
  cognome?: string
  /** Scheda CRM su cui il professionista ha premuto il pulsante, se la conosce:
   *  serve solo a registrare l'azione nel registro accessi. */
  clientId?: string
  /** Lingua del professionista, per l'email al cliente. */
  lang?: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function nomeCompleto(p: { nome?: string | null; cognome?: string | null } | null): string {
  return `${p?.nome ?? ''} ${p?.cognome ?? ''}`.trim()
}

// ── Email di richiesta al cliente ────────────────────────────────────────────
// Non è una notifica di misurazione: non passa dal layout con la disiscrizione
// delle preferenze, perché non è qualcosa da cui disiscriversi. Riusa solo
// l'invio SMTP già in funzione per notify-measurement: nessuna dipendenza
// nuova. Se i segreti SMTP mancano, `inviaEmail` torna ok:false e l'esito
// resta valido: il collegamento è creato, l'email è un avviso.

const TESTI = {
  it: {
    subject: (chi: string) => `${chi} vuole seguire le tue misurazioni`,
    titolo: 'Richiesta di collegamento',
    corpo: (chi: string) =>
      `<strong>${esc(chi)}</strong> ha chiesto di seguire le tue misurazioni su Stress Index.`,
    azione: 'Apri l\'app Stress Index e conferma o rifiuta la richiesta.',
    nota: 'Finché non confermi, nessuno dei tuoi dati viene condiviso. Se non hai idea di chi sia, rifiuta: non succede niente.',
  },
  en: {
    subject: (chi: string) => `${chi} would like to follow your measurements`,
    titolo: 'Connection request',
    corpo: (chi: string) =>
      `<strong>${esc(chi)}</strong> has asked to follow your measurements on Stress Index.`,
    azione: 'Open the Stress Index app and accept or decline the request.',
    nota: 'Until you accept, none of your data is shared. If you don\'t recognise the name, decline: nothing happens.',
  },
  de: {
    subject: (chi: string) => `${chi} möchte Ihre Messungen verfolgen`,
    titolo: 'Verbindungsanfrage',
    corpo: (chi: string) =>
      `<strong>${esc(chi)}</strong> hat darum gebeten, Ihre Messungen auf Stress Index zu verfolgen.`,
    azione: 'Öffnen Sie die Stress-Index-App und bestätigen oder lehnen Sie die Anfrage ab.',
    nota: 'Solange Sie nicht bestätigen, werden keine Ihrer Daten geteilt. Wenn Sie den Namen nicht kennen, lehnen Sie ab: es passiert nichts.',
  },
} as const

function linguaValida(v: string | undefined): keyof typeof TESTI {
  return v === 'en' || v === 'de' ? v : 'it'
}

async function avvisaCliente(to: string, chi: string, lang: keyof typeof TESTI) {
  const s = TESTI[lang]
  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(s.titolo)}</title></head>
<body style="margin:0;padding:0;background:#F7F6F3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6F3;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="padding:0 4px 16px;">
          <span style="font-size:15px;font-weight:700;color:#0F6E6E;letter-spacing:.02em;">Stress Index</span>
        </td></tr>
        <tr><td style="background:#FFFFFF;border:1px solid #E7E4DD;border-radius:14px;padding:20px;">
          <p style="margin:0 0 10px;font-size:16px;font-weight:600;color:#2B2B2B;">${esc(s.titolo)}</p>
          <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3F3F3F;">${s.corpo(chi)}</p>
          <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3F3F3F;">${esc(s.azione)}</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#6B6B6B;">${esc(s.nota)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  const text = [s.titolo, '', `${chi}`, s.azione, '', s.nota, '', 'Stress Index'].join('\n')
  return await inviaEmail(to, s.subject(chi), html, text)
}

// ── Registro ─────────────────────────────────────────────────────────────────
// Ogni esito finisce in professional_access_log. Il check constraint della 027
// ammette quattro azioni: si usa `create_access` e l'esito sta in `details`,
// così non serve nessuna migration del registro.

async function registra(
  admin: SupabaseClient,
  riga: {
    professionalId: string
    clientId: string | null
    clientUserId: string | null
    result: Result
    details: Record<string, unknown>
  },
): Promise<{ logged: boolean; reason?: string }> {
  // client_id è NOT NULL: senza scheda non c'è riga da scrivere, e lo si dice
  // invece di inventare un identificatore.
  if (!riga.clientId) return { logged: false, reason: 'nessuna scheda a cui riferire l\'azione' }
  const { error } = await admin.from('professional_access_log').insert({
    professional_id: riga.professionalId,
    client_id: riga.clientId,
    client_user_id: riga.clientUserId,
    action: 'create_access',
    details: { result: riga.result, ...riga.details },
  })
  if (error) {
    console.error('[create-client-access] registro non scritto', error.message)
    return { logged: false, reason: error.message }
  }
  return { logged: true }
}

/** Scheda del professionista a cui riferire l'azione: quella indicata, o quella con la stessa email. */
async function trovaScheda(
  admin: SupabaseClient,
  professionalId: string,
  email: string,
  indicata: string | undefined,
): Promise<string | null> {
  if (indicata) {
    const { data } = await admin
      .from('clients')
      .select('id')
      .eq('id', indicata)
      .eq('professionista_id', professionalId)
      .maybeSingle()
    if ((data as { id?: string } | null)?.id) return indicata
  }
  const { data } = await admin
    .from('clients')
    .select('id')
    .eq('professionista_id', professionalId)
    .ilike('email', email)
    .is('merged_into_client_id', null)
    .order('created_at', { ascending: true })
    .limit(1)
  return ((data ?? []) as Array<{ id: string }>)[0]?.id ?? null
}

/** Utente già registrato con quella email: prima il profilo, poi l'elenco auth. */
async function trovaUtente(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string; role: string | null } | null> {
  const { data: prof } = await admin
    .from('profiles')
    .select('id, role')
    .ilike('email', email)
    .limit(1)
  const riga = ((prof ?? []) as Array<{ id: string; role: string | null }>)[0]
  if (riga?.id) return riga

  for (let page = 1; page <= 20; page++) {
    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 500 })
    if (error || !list?.users?.length) break
    const trovato = list.users.find((u) => (u.email ?? '').toLowerCase() === email)
    if (trovato) {
      // L'account esiste in auth ma non ha un profilo: il ruolo è ignoto, e
      // "ignoto" non è "cliente". Si tratta come cliente solo se il profilo
      // lo dice; qui si restituisce role null e il chiamante decide.
      const { data: p } = await admin.from('profiles').select('role').eq('id', trovato.id).maybeSingle()
      return { id: trovato.id, role: (p as { role?: string | null } | null)?.role ?? null }
    }
    if (list.users.length < 500) break
  }
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, result: 'error', code: 'method_not_allowed', message: 'Metodo non ammesso.' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return json({ ok: false, result: 'error', code: 'server_misconfigured', message: 'Variabili ambiente mancanti.' }, 500)
  }

  // 1. Professionista chiamante dal JWT, mai dal body.
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ ok: false, result: 'error', code: 'unauthorized', message: 'Token mancante.' }, 401)
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
  const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser()
  if (callerErr || !caller) return json({ ok: false, result: 'error', code: 'unauthorized', message: 'Sessione non valida.' }, 401)
  const professionalId = caller.id

  // 2. Input.
  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return json({ ok: false, result: 'error', code: 'bad_request', message: 'Body non valido.' }, 400)
  }
  const email = (payload.email ?? '').trim().toLowerCase()
  const nome = (payload.nome ?? '').trim()
  const cognome = (payload.cognome ?? '').trim()
  const lang = linguaValida(payload.lang)
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ ok: false, result: 'error', code: 'invalid_email', message: 'Email non valida.' }, 400)
  }
  if (!nome || !cognome) {
    return json({ ok: false, result: 'error', code: 'missing_name', message: 'Nome e cognome sono obbligatori.' }, 400)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const scheda = await trovaScheda(admin, professionalId, email, payload.clientId)

  // 3. L'email è già di qualcuno? Si guarda PRIMA di invitare: è l'unico modo
  //    di distinguere un account professionista da un cliente, e di non
  //    toccare niente quando non si deve.
  const esistente = await trovaUtente(admin, email)

  if (esistente) {
    // 3a. Account NON cliente: si ferma qui. Nessun link, nemmeno pending.
    if (esistente.role && esistente.role !== 'client') {
      const log = await registra(admin, {
        professionalId, clientId: scheda, clientUserId: esistente.id,
        result: 'is_professional',
        details: { email, role: esistente.role },
      })
      return json({
        ok: true, result: 'is_professional' satisfies Result,
        email, userId: esistente.id, role: esistente.role,
        message: 'Questa email appartiene a un account professionista: non può diventare un cliente. Nessun cambiamento.',
        logged: log.logged, logReason: log.reason,
      })
    }

    // 3b. Collegamenti vivi già esistenti.
    const { data: linkRows, error: linkErr } = await admin
      .from('client_professional_links')
      .select('professional_id, status')
      .eq('client_user_id', esistente.id)
      .neq('status', 'revoked')
    if (linkErr) {
      return json({ ok: false, result: 'error', code: 'links_unreadable', message: `Collegamenti non leggibili: ${linkErr.message}` }, 500)
    }
    const vivi = (linkRows ?? []) as Array<{ professional_id: string; status: string }>
    const mio = vivi.find((l) => l.professional_id === professionalId)
    const altrui = vivi.filter((l) => l.professional_id !== professionalId && l.status === 'active')

    if (mio) {
      const log = await registra(admin, {
        professionalId, clientId: scheda, clientUserId: esistente.id,
        result: 'already_linked_self',
        details: { email, link_status: mio.status },
      })
      return json({
        ok: true, result: 'already_linked_self' satisfies Result,
        email, userId: esistente.id, linkStatus: mio.status,
        message: mio.status === 'active'
          ? 'Questo cliente è già collegato a te: nessun cambiamento.'
          : 'La richiesta di collegamento a questo cliente è già in attesa di conferma.',
        logged: log.logged, logReason: log.reason,
      })
    }

    if (altrui.length > 0) {
      const log = await registra(admin, {
        professionalId, clientId: scheda, clientUserId: esistente.id,
        result: 'already_linked_other',
        details: { email, other_professionals: altrui.map((l) => l.professional_id) },
      })
      return json({
        ok: true, result: 'already_linked_other' satisfies Result,
        email, userId: esistente.id,
        message: 'Questo account è già collegato a un altro professionista: nessun cambiamento.',
        logged: log.logged, logReason: log.reason,
      })
    }

    // 3c. Cliente libero: collegamento IN ATTESA, mai active.
    const { data: rpc, error: rpcErr } = await admin.rpc('request_client_link', {
      p_client_user_id: esistente.id,
      p_professional_id: professionalId,
      p_source: 'edge:existing',
    })
    // Funzione assente = migration 031 non applicata. Non si ripiega su
    // link_client_to_professional: creerebbe un link ACTIVE senza consenso.
    const mancante = rpcErr && (rpcErr.code === 'PGRST202' || /request_client_link/.test(rpcErr.message ?? ''))
    if (mancante) {
      return json({
        ok: false, result: 'error' satisfies Result, code: 'migration_031_missing',
        message: 'Il collegamento in attesa richiede la migration sito-031, non ancora applicata. Nessun cambiamento: un collegamento attivo senza conferma del cliente non viene creato.',
      }, 500)
    }
    const res = (rpc ?? null) as { ok?: boolean; error?: string; client_id?: string; link_status?: string; merged?: string[] } | null
    if (rpcErr || !res?.ok) {
      const message = rpcErr?.message ?? res?.error ?? 'collegamento non riuscito'
      const log = await registra(admin, {
        professionalId, clientId: scheda, clientUserId: esistente.id,
        result: 'error', details: { email, rpc_error: message },
      })
      return json({ ok: false, result: 'error' satisfies Result, code: 'link_failed', message, rpc: res, logged: log.logged }, 500)
    }

    // Avviso al cliente: è lui che deve confermare, quindi deve saperlo.
    const { data: chiRows } = await admin
      .from('professional_profiles')
      .select('titolo, nome, cognome')
      .eq('id', professionalId)
      .maybeSingle()
    let chi = nomeCompleto(chiRows as { nome?: string | null; cognome?: string | null } | null)
    if (!chi) {
      const { data: p } = await admin.from('profiles').select('nome, cognome, email').eq('id', professionalId).maybeSingle()
      const r = p as { nome?: string | null; cognome?: string | null; email?: string | null } | null
      chi = nomeCompleto(r) || (r?.email ?? 'Un professionista')
    }
    const avviso = await avvisaCliente(email, chi, lang)

    const log = await registra(admin, {
      professionalId, clientId: res.client_id ?? scheda, clientUserId: esistente.id,
      result: 'link_pending',
      details: { email, client_id: res.client_id, notice_sent: avviso.ok, notice_error: avviso.ok ? null : avviso.error, merged: res.merged ?? [] },
    })
    return json({
      ok: true, result: 'link_pending' satisfies Result,
      email, userId: esistente.id, clientId: res.client_id, linkStatus: res.link_status ?? 'pending',
      noticeSent: avviso.ok, noticeError: avviso.ok ? null : avviso.error,
      merged: res.merged ?? [],
      message: 'Questa email ha già un account Stress Index: il collegamento è stato creato e resta in attesa che il cliente lo confermi dall\'app.',
      logged: log.logged, logReason: log.reason,
    })
  }

  // 4. Email nuova: invito, come prima. Qui il consenso è il click sul link.
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nome, cognome, role: 'client' },
  })
  if (inviteErr || !invited?.user) {
    // Comparsa fra il controllo e ora (corsa), oppure invio fallito.
    const raw = (inviteErr?.message ?? '').toLowerCase()
    const code = (inviteErr as { code?: string } | null)?.code
    const corsa = code === 'email_exists' || inviteErr?.status === 422 || raw.includes('already') || raw.includes('registered') || raw.includes('exists')
    return json({
      ok: false, result: 'error' satisfies Result,
      code: corsa ? 'email_exists_retry' : 'auth_create_failed',
      message: corsa
        ? 'Un account con questa email è stato creato proprio ora: riprova per vedere l\'esito corretto.'
        : (inviteErr?.message ?? 'Invio invito fallito.'),
    }, corsa ? 409 : 500)
  }
  const userId = invited.user.id

  const { error: profErr } = await admin.from('profiles').upsert(
    { id: userId, email, nome, cognome, role: 'client', created_at: new Date().toISOString() },
    { onConflict: 'id' },
  )
  if (profErr) {
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    return json({
      ok: false, result: 'error' satisfies Result, code: 'profile_failed',
      message: `Creazione profilo fallita: ${profErr.message}`,
      rollback: delErr ? `utente NON eliminato: ${delErr.message}` : 'utente eliminato',
    }, 500)
  }

  const { data: rpc, error: rpcErr } = await admin.rpc('link_client_to_professional', {
    p_client_user_id: userId,
    p_professional_id: professionalId,
    p_source: 'edge:invite',
  })
  const res = (rpc ?? null) as { ok?: boolean; error?: string; client_id?: string; link_status?: string; action?: string; card_action?: string; merged?: string[] } | null

  if (rpcErr || !res?.ok) {
    const message = rpcErr?.message ?? res?.error ?? 'collegamento non riuscito'
    // Rollback di ciò che QUESTA chiamata ha creato, con esito esplicito.
    const { error: pErr } = await admin.from('profiles').delete().eq('id', userId)
    const { error: uErr } = await admin.auth.admin.deleteUser(userId)
    const rollback = pErr || uErr
      ? `rollback INCOMPLETO: profilo ${pErr ? 'NON eliminato (' + pErr.message + ')' : 'eliminato'}, utente ${uErr ? 'NON eliminato (' + uErr.message + ')' : 'eliminato'}`
      : 'profilo e utente eliminati'
    return json({ ok: false, result: 'error' satisfies Result, code: 'link_failed', message, rpc: res, rollback, userId }, 500)
  }

  const log = await registra(admin, {
    professionalId, clientId: res.client_id ?? scheda, clientUserId: userId,
    result: 'invited',
    details: { email, client_id: res.client_id, invite_sent: true, merged: res.merged ?? [] },
  })
  return json({
    ok: true, result: 'invited' satisfies Result,
    userId, email, clientId: res.client_id, linkStatus: res.link_status,
    action: res.action, cardAction: res.card_action, merged: res.merged ?? [],
    message: 'Invito inviato: il cliente riceve una email per impostare la password.',
    logged: log.logged, logReason: log.reason,
  })
})
