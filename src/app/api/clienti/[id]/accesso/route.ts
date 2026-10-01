import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireClientScope, requireProfessional } from '@/lib/professional-guard'
import {
  checkRateLimit,
  logAccessAction,
  nomeProfessionista,
  notifyClientOfAccessAction,
  passwordProblema,
  readClientAccessState,
  RATE_LIMIT_24H,
  type AccessAction,
} from '@/lib/client-access'
import { requestClientAccess } from '@/lib/client-link-request'
import { apiError } from '@/lib/api-error'
import { getRequestLocale, getTranslator } from '@/lib/i18n-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =============================================================================
// /api/clienti/[id]/accesso — accesso app di UN cliente del professionista
// =============================================================================
//
// GET  → stato dell'accesso (mai usato / attivo, ultimo accesso, azioni residue)
// POST → { action: 'create_access' }                 crea l'accesso app
//        { action: 'set_temp_password', password }  solo su account MAI usato
//        { action: 'send_reset_email' }             email di ripristino
//        { action: 'copy_reset_link' }              link di recupero da copiare
//
// `create_access` è l'unica che lavora su un account che ancora NON esiste, e
// l'unica con un esito a più valori: `invited`, `link_pending`,
// `already_linked_other`, `is_professional` (più `already_linked_self`). I
// valori e l'albero delle decisioni stanno in `src/lib/client-link-request.ts`
// e devono restare in pari con l'Edge Function create-client-access, che è la
// stessa funzione per l'app Flutter.
//
// Ogni chiamata: professionista autenticato con role='professional', scheda sua,
// collegamento `active` con l'account del cliente. La service_role serve per
// updateUserById / generateLink e non lascia mai il server.
//
// Si entra in due modi, con le stesse regole: il cookie di sessione Next (sito)
// o `Authorization: Bearer <access token Supabase>` (app Flutter), verificato
// lato server da requireProfessional. La password temporanea la genera e la
// mostra il chiamante: entra col POST e non torna mai nella risposta.
//
// Il rifiuto di impostare una password su un account già in uso vive QUI, non
// nella UI: nascondere il bottone non è un controllo.
//
// Gli errori sono CODICI (`errors.api.*`, via apiError) che la UI traduce; i
// testi rivolti al cliente (avviso email, messaggio da incollare) escono nella
// lingua del professionista che agisce (getRequestLocale).

const AZIONI: AccessAction[] = ['set_temp_password', 'send_reset_email', 'copy_reset_link', 'create_access']

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stressindex.io').replace(/\/+$/, '')
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireProfessional(req)
  if (guard.error) return guard.error
  const admin = createAdminClient()

  const scope = await requireClientScope(admin, guard.user.id, params.id)
  if (scope.error) return scope.error

  const state = await readClientAccessState(admin, guard.user.id, scope.scope)
  return NextResponse.json({ ok: true, state })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireProfessional(req)
  if (guard.error) return guard.error
  const admin = createAdminClient()
  const locale = await getRequestLocale(req)
  const t = await getTranslator(locale, 'emails')

  const body = await req.json().catch(() => ({}))
  const action = body?.action as AccessAction
  if (!AZIONI.includes(action)) {
    return apiError('invalid_action', 400)
  }

  // ═══ 0. Crea accesso — l'unica azione per cui l'account NON esiste ancora ══
  // Non pretende il link attivo (non c'è), ma pretende che la scheda sia di
  // chi chiama. L'esito è esplicito: la UI ha un messaggio per ognuno.
  if (action === 'create_access') {
    const s = await requireClientScope(admin, guard.user.id, params.id)
    if (s.error) return s.error
    const { clientId: cid, email: cEmail, nome, cognome } = s.scope

    if (!cEmail) return apiError('no_email', 409)

    const rateCreate = await checkRateLimit(admin, guard.user.id, cid)
    if (!rateCreate.ok) {
      return apiError('rate_limited', 429, { used: rateCreate.used, max: RATE_LIMIT_24H, retryAfter: rateCreate.retryAfter })
    }

    const esito = await requestClientAccess(admin, {
      professionalId: guard.user.id,
      clientId: cid,
      email: cEmail,
      nome: (nome ?? '').trim(),
      cognome: (cognome ?? '').trim(),
    })

    // Ogni esito va nel registro, anche quelli che non cambiano niente:
    // "non è stato fatto nulla, e perché" è esattamente ciò che serve sapere.
    const log = await logAccessAction(admin, {
      professionalId: guard.user.id,
      clientId: cid,
      clientUserId: esito.clientUserId ?? null,
      action: 'create_access',
      details: {
        result: esito.result,
        email: cEmail,
        code: esito.code ?? null,
        detail: esito.detail ?? null,
        link_status: esito.linkStatus ?? null,
        role: esito.role ?? null,
        other_professionals: esito.otherProfessionals ?? null,
        merged: esito.merged ?? [],
      },
    })

    if (esito.result === 'error') {
      return apiError(esito.code ?? 'create_access_failed', 500, { detail: esito.detail ?? null })
    }
    return NextResponse.json({
      ok: true,
      result: esito.result,
      clientUserId: esito.clientUserId ?? null,
      linkStatus: esito.linkStatus ?? null,
      merged: esito.merged ?? [],
      logged: log.logged,
    })
  }

  // Tutte le altre azioni toccano un account che esiste già: serve il link attivo.
  const scope = await requireClientScope(admin, guard.user.id, params.id, { requireActiveLink: true })
  if (scope.error) return scope.error
  const { clientId, clientUserId } = scope.scope
  if (!clientUserId) {
    return apiError('no_account', 409)
  }

  // ── Rate limit, prima di qualunque effetto ─────────────────────────────────
  const rate = await checkRateLimit(admin, guard.user.id, clientId)
  if (!rate.ok) {
    return apiError('rate_limited', 429, { used: rate.used, max: RATE_LIMIT_24H, retryAfter: rate.retryAfter })
  }

  // ── Stato reale dell'account: decide cosa è permesso ───────────────────────
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(clientUserId)
  if (userErr || !userData?.user) {
    return apiError('account_not_found', 404, { detail: userErr?.message ?? null })
  }
  const clientEmail = userData.user.email ?? scope.scope.email
  const neverUsed = !userData.user.last_sign_in_at

  // Chi manda l'avviso, con nome e cognome.
  const { data: profRow } = await admin
    .from('profiles')
    .select('nome, cognome, email')
    .eq('id', guard.user.id)
    .maybeSingle()
  const { data: ppRow } = await admin
    .from('professional_profiles')
    .select('titolo, nome, cognome')
    .eq('id', guard.user.id)
    .maybeSingle()
  const pp = (ppRow ?? null) as { titolo?: string | null; nome?: string | null; cognome?: string | null } | null
  const pr = (profRow ?? null) as { nome?: string | null; cognome?: string | null; email?: string | null } | null
  const professionalName = nomeProfessionista(
    {
      titolo: pp?.titolo ?? null,
      nome: pp?.nome ?? pr?.nome ?? null,
      cognome: pp?.cognome ?? pr?.cognome ?? null,
    },
    t('access.yourProfessional'),
  )

  // ═══ 1. Password temporanea — SOLO su account mai usato ════════════════════
  if (action === 'set_temp_password') {
    if (!neverUsed) {
      // Il cuore della regola: da qui in poi la password è del cliente.
      return apiError('account_in_use', 409)
    }
    const password = typeof body.password === 'string' ? body.password : ''
    if (passwordProblema(password)) return apiError('access_password_too_short', 400)

    const { error: setErr } = await admin.auth.admin.updateUserById(clientUserId, {
      password,
      email_confirm: true,
    })
    if (setErr) return apiError('set_password_failed', 500, { detail: setErr.message })

    // must_change_password: se la 027 non è applicata la colonna manca (42703),
    // la password è comunque cambiata e non si annulla l'operazione. Il
    // `warning` è un codice (clients.access.warnings.*) o il messaggio grezzo.
    let flagWarning: string | null = null
    const { error: flagErr } = await admin
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', clientUserId)
    if (flagErr) {
      flagWarning = flagErr.code === '42703' ? 'must_change_password_unavailable' : flagErr.message
      console.error('[accesso] must_change_password non impostata', flagErr.message)
    }

    const avviso = await notifyClientOfAccessAction({
      to: clientEmail,
      action,
      professionalName,
      professionalEmail: pr?.email ?? null,
      locale,
    })
    const log = await logAccessAction(admin, {
      professionalId: guard.user.id,
      clientId,
      clientUserId,
      action,
      details: { notice: avviso.sent ? 'sent' : `failed: ${avviso.reason}`, must_change_password: !flagWarning },
    })

    return NextResponse.json({
      ok: true,
      action,
      mustChangePassword: !flagWarning,
      warning: flagWarning,
      noticeSent: avviso.sent,
      noticeError: avviso.sent ? null : avviso.reason,
      logged: log.logged,
    })
  }

  // ═══ 2. Email di reset ════════════════════════════════════════════════════
  if (action === 'send_reset_email') {
    if (!clientEmail) {
      return apiError('access_no_email', 400)
    }
    // resetPasswordForEmail vive sul client anon: è l'unica via per far partire
    // l'email di ripristino dall'SMTP di Supabase Auth.
    const anon = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error } = await anon.auth.resetPasswordForEmail(clientEmail, {
      redirectTo: `${siteUrl()}/imposta-password`,
    })
    if (error) return apiError('reset_failed', 500, { detail: error.message })

    const avviso = await notifyClientOfAccessAction({
      to: clientEmail,
      action,
      professionalName,
      professionalEmail: pr?.email ?? null,
      locale,
    })
    const log = await logAccessAction(admin, {
      professionalId: guard.user.id,
      clientId,
      clientUserId,
      action,
      details: { email: clientEmail, notice: avviso.sent ? 'sent' : `failed: ${avviso.reason}` },
    })

    return NextResponse.json({
      ok: true,
      action,
      email: clientEmail,
      noticeSent: avviso.sent,
      noticeError: avviso.sent ? null : avviso.reason,
      logged: log.logged,
    })
  }

  // ═══ 3. Link di reset da copiare ══════════════════════════════════════════
  if (!clientEmail) {
    return apiError('access_no_email', 400)
  }
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: clientEmail,
    options: { redirectTo: `${siteUrl()}/imposta-password` },
  })
  const actionLink = linkData?.properties?.action_link ?? null
  if (linkErr || !actionLink) {
    return apiError('access_link_failed', 500, { detail: linkErr?.message ?? null })
  }

  // Messaggio pronto da incollare, nella lingua del professionista.
  const nomeCliente = (scope.scope.nome ?? '').trim()
  const messaggio = [
    nomeCliente ? t('resetLink.greeting', { name: nomeCliente }) : t('resetLink.greetingNoName'),
    t('resetLink.body'),
    actionLink,
    t('resetLink.note'),
  ].join('\n\n')

  const avviso = await notifyClientOfAccessAction({
    to: clientEmail,
    action: 'copy_reset_link',
    professionalName,
    professionalEmail: pr?.email ?? null,
    locale,
  })
  const log = await logAccessAction(admin, {
    professionalId: guard.user.id,
    clientId,
    clientUserId,
    action: 'copy_reset_link',
    details: { email: clientEmail, notice: avviso.sent ? 'sent' : `failed: ${avviso.reason}` },
  })

  return NextResponse.json({
    ok: true,
    action: 'copy_reset_link',
    link: actionLink,
    message: messaggio,
    // La scadenza vera è l'OTP expiry del progetto (Authentication → Sessions):
    // di default 3600 s. Qui si dichiara solo ciò che il progetto è configurato
    // per fare, non un valore imposto da noi.
    expiresInMinutes: 60,
    noticeSent: avviso.sent,
    noticeError: avviso.sent ? null : avviso.reason,
    logged: log.logged,
  })
}
