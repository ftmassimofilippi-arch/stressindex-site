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

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =============================================================================
// /api/clienti/[id]/accesso — accesso app di UN cliente del professionista
// =============================================================================
//
// GET  → stato dell'accesso (mai usato / attivo, ultimo accesso, azioni residue)
// POST → { action: 'set_temp_password', password }  solo su account MAI usato
//        { action: 'send_reset_email' }             email di ripristino
//        { action: 'copy_reset_link' }              link di recupero da copiare
//
// Ogni chiamata: professionista autenticato con role='professional', scheda sua,
// collegamento `active` con l'account del cliente. La service_role serve per
// updateUserById / generateLink e non lascia mai il server.
//
// Il rifiuto di impostare una password su un account già in uso vive QUI, non
// nella UI: nascondere il bottone non è un controllo.

const AZIONI: AccessAction[] = ['set_temp_password', 'send_reset_email', 'copy_reset_link']

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stressindex.io').replace(/\/+$/, '')
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireProfessional()
  if (guard.error) return guard.error
  const admin = createAdminClient()

  const scope = await requireClientScope(admin, guard.user.id, params.id)
  if (scope.error) return scope.error

  const state = await readClientAccessState(admin, guard.user.id, scope.scope)
  return NextResponse.json({ ok: true, state })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireProfessional()
  if (guard.error) return guard.error
  const admin = createAdminClient()

  const body = await req.json().catch(() => ({}))
  const action = body?.action as AccessAction
  if (!AZIONI.includes(action)) {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  }

  // Tutte queste azioni toccano un account che esiste già: serve il link attivo.
  const scope = await requireClientScope(admin, guard.user.id, params.id, { requireActiveLink: true })
  if (scope.error) return scope.error
  const { clientId, clientUserId } = scope.scope
  if (!clientUserId) {
    return NextResponse.json({ error: 'no_account', message: 'Questo cliente non ha ancora un account app.' }, { status: 409 })
  }

  // ── Rate limit, prima di qualunque effetto ─────────────────────────────────
  const rate = await checkRateLimit(admin, guard.user.id, clientId)
  if (!rate.ok) {
    return NextResponse.json(
      {
        error: 'rate_limited',
        message: `Hai già fatto ${rate.used} interventi sull'accesso di questo cliente nelle ultime 24 ore (massimo ${RATE_LIMIT_24H}). Riprova più tardi.`,
        retryAfter: rate.retryAfter,
      },
      { status: 429 },
    )
  }

  // ── Stato reale dell'account: decide cosa è permesso ───────────────────────
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(clientUserId)
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'account_not_found', message: userErr?.message ?? 'Account non trovato.' }, { status: 404 })
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
  const professionalName = nomeProfessionista({
    titolo: pp?.titolo ?? null,
    nome: pp?.nome ?? pr?.nome ?? null,
    cognome: pp?.cognome ?? pr?.cognome ?? null,
  })

  // ═══ 1. Password temporanea — SOLO su account mai usato ════════════════════
  if (action === 'set_temp_password') {
    if (!neverUsed) {
      // Il cuore della regola: da qui in poi la password è del cliente.
      return NextResponse.json(
        {
          error: 'account_in_use',
          message:
            'Questo cliente ha già usato il suo account: la password è sua e non puoi impostarla. Usa "Reinvia email di reset" oppure "Copia link di reset".',
        },
        { status: 409 },
      )
    }
    const password = typeof body.password === 'string' ? body.password : ''
    const problema = passwordProblema(password)
    if (problema) return NextResponse.json({ error: 'password_too_short', message: problema }, { status: 400 })

    const { error: setErr } = await admin.auth.admin.updateUserById(clientUserId, {
      password,
      email_confirm: true,
    })
    if (setErr) return NextResponse.json({ error: 'set_password_failed', message: setErr.message }, { status: 500 })

    // must_change_password: se la 027 non è applicata la colonna manca (42703),
    // la password è comunque cambiata e non si annulla l'operazione.
    let flagWarning: string | null = null
    const { error: flagErr } = await admin
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', clientUserId)
    if (flagErr) {
      flagWarning =
        flagErr.code === '42703'
          ? 'Applica la migration 027: senza must_change_password l\'app non chiederà al cliente di cambiare la password.'
          : flagErr.message
      console.error('[accesso] must_change_password non impostata', flagErr.message)
    }

    const avviso = await notifyClientOfAccessAction({
      to: clientEmail,
      action,
      professionalName,
      professionalEmail: pr?.email ?? null,
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
      return NextResponse.json({ error: 'no_email', message: 'Questo cliente non ha un indirizzo email.' }, { status: 400 })
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
    if (error) return NextResponse.json({ error: 'reset_failed', message: error.message }, { status: 500 })

    const avviso = await notifyClientOfAccessAction({
      to: clientEmail,
      action,
      professionalName,
      professionalEmail: pr?.email ?? null,
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
    return NextResponse.json({ error: 'no_email', message: 'Questo cliente non ha un indirizzo email.' }, { status: 400 })
  }
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: clientEmail,
    options: { redirectTo: `${siteUrl()}/imposta-password` },
  })
  const actionLink = linkData?.properties?.action_link ?? null
  if (linkErr || !actionLink) {
    return NextResponse.json({ error: 'link_failed', message: linkErr?.message ?? 'Link non generato.' }, { status: 500 })
  }

  const nomeCliente = (scope.scope.nome ?? '').trim()
  const messaggio = [
    nomeCliente ? `Ciao ${nomeCliente},` : 'Ciao,',
    'ecco il link per rientrare nella tua app Stress Index e scegliere una nuova password:',
    actionLink,
    'Vale un\'ora e si può usare una sola volta. Se è scaduto scrivimi e te ne mando un altro.',
  ].join('\n\n')

  const avviso = await notifyClientOfAccessAction({
    to: clientEmail,
    action: 'copy_reset_link',
    professionalName,
    professionalEmail: pr?.email ?? null,
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
