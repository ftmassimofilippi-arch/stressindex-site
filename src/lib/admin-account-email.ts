import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Correzione dell'email di un ACCOUNT (auth.users), non solo della scheda CRM.
// ----------------------------------------------------------------------------
// L'email dell'account è quella con cui l'utente fa login e riceve reset
// password e inviti: un refuso (".con") la rende irraggiungibile. Cambiarla non
// tocca l'uid, quindi sessioni, monitoraggi, baseline e collegamenti restano
// dove sono. Vanno invece allineate le copie dell'email:
//   • profiles.email
//   • le schede clients agganciate all'account (client_user_id = uid) che
//     avevano la vecchia email
//   • le schede NON agganciate con la vecchia email sotto un professionista
//     con cui l'account ha un collegamento non revocato: sono risolte per email
//     (fallback storico delle RPC), se non si aggiornano il collegamento le
//     perde
// Le altre schede con la vecchia email (professionisti senza collegamento)
// non vengono toccate e sono elencate nell'anteprima.
// ============================================================================

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export type EmailCardRow = {
  id: string
  nome: string | null
  cognome: string | null
  email: string | null
  professionista_id: string | null
  client_user_id: string | null
}

export type EmailChangePlan = {
  user_id: string
  role: string | null
  full_name: string
  old_email: string | null
  new_email: string
  // un altro account usa già la nuova email: correzione impossibile
  conflict: null | {
    user_id: string
    email: string
    role: string | null
    full_name: string
    last_sign_in_at: string | null
    created_at: string | null
    sessions: number // misurazioni fatte dall'account sulla sua app
    card_sessions: number // misurazioni sulle schede agganciate all'account
    active_links: number
  }
  cards_to_update: Array<EmailCardRow & { reason: 'ponte' | 'collegamento' }>
  cards_not_touched: EmailCardRow[]
}

function norm(e: string | null | undefined): string {
  return (e ?? '').trim().toLowerCase()
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    const hit = data.users.find((u) => norm(u.email) === email)
    if (hit) return hit
    if (data.users.length < 1000) break
  }
  return null
}

async function countSessions(admin: SupabaseClient, userId: string): Promise<number> {
  const { count } = await admin.from('sessions').select('id', { count: 'exact', head: true }).eq('professionista_id', userId)
  return count ?? 0
}

export async function planEmailChange(admin: SupabaseClient, userId: string, rawEmail: string): Promise<EmailChangePlan | { error: string; status: number }> {
  const newEmail = norm(rawEmail)
  if (!EMAIL_RE.test(newEmail)) return { error: 'invalid_email', status: 400 }

  const { data: authData, error: authErr } = await admin.auth.admin.getUserById(userId)
  if (authErr || !authData?.user) return { error: 'user_not_found', status: 404 }
  const oldEmail = norm(authData.user.email) || null
  if (oldEmail === newEmail) return { error: 'same_email', status: 400 }

  const { data: prof } = await admin.from('profiles').select('role, nome, cognome, email').eq('id', userId).maybeSingle()
  const p = prof as { role: string | null; nome: string | null; cognome: string | null; email: string | null } | null

  // Conflitto: un altro account auth (o un altro profilo) con la nuova email.
  let conflict: EmailChangePlan['conflict'] = null
  const other = await findAuthUserByEmail(admin, newEmail)
  const { data: otherProfiles } = await admin.from('profiles').select('id, role, nome, cognome, email').ilike('email', newEmail)
  const otherProfile = ((otherProfiles ?? []) as Array<{ id: string; role: string | null; nome: string | null; cognome: string | null; email: string }>).find((x) => x.id !== userId)
  const otherId = other && other.id !== userId ? other.id : otherProfile?.id ?? null
  if (otherId) {
    const { data: op } = await admin.from('profiles').select('role, nome, cognome, email').eq('id', otherId).maybeSingle()
    const opr = op as { role: string | null; nome: string | null; cognome: string | null; email: string | null } | null
    const { count: links } = await admin.from('client_professional_links').select('id', { count: 'exact', head: true }).eq('client_user_id', otherId).eq('status', 'active')
    const { data: otherCards } = await admin.from('clients').select('id').eq('client_user_id', otherId)
    const otherCardIds = ((otherCards ?? []) as Array<{ id: string }>).map((c) => c.id)
    const { count: cardSessions } = otherCardIds.length
      ? await admin.from('sessions').select('id', { count: 'exact', head: true }).in('client_id', otherCardIds)
      : { count: 0 }
    conflict = {
      user_id: otherId,
      email: newEmail,
      role: opr?.role ?? null,
      full_name: `${opr?.nome ?? ''} ${opr?.cognome ?? ''}`.trim() || newEmail,
      last_sign_in_at: other && other.id === otherId ? other.last_sign_in_at ?? null : null,
      created_at: other && other.id === otherId ? other.created_at ?? null : null,
      sessions: await countSessions(admin, otherId),
      card_sessions: cardSessions ?? 0,
      active_links: links ?? 0,
    }
  }

  const cardsToUpdate: EmailChangePlan['cards_to_update'] = []
  const cardsNotTouched: EmailCardRow[] = []
  const COLS = 'id, nome, cognome, email, professionista_id, client_user_id'
  const { data: bridged } = await admin.from('clients').select(COLS).eq('client_user_id', userId).is('merged_into_client_id', null)
  for (const c of (bridged ?? []) as EmailCardRow[]) {
    if (!c.email || !oldEmail || norm(c.email) === oldEmail) cardsToUpdate.push({ ...c, reason: 'ponte' })
  }
  if (oldEmail) {
    const { data: links } = await admin.from('client_professional_links').select('professional_id, status').eq('client_user_id', userId).neq('status', 'revoked')
    const linkedPros = new Set(((links ?? []) as Array<{ professional_id: string }>).map((l) => l.professional_id))
    const { data: byEmail } = await admin.from('clients').select(COLS).ilike('email', oldEmail).is('merged_into_client_id', null)
    for (const c of (byEmail ?? []) as EmailCardRow[]) {
      if (norm(c.email) !== oldEmail || c.client_user_id === userId) continue
      if (!c.client_user_id && c.professionista_id && linkedPros.has(c.professionista_id) && c.professionista_id !== userId) {
        cardsToUpdate.push({ ...c, reason: 'collegamento' })
      } else {
        cardsNotTouched.push(c)
      }
    }
  }

  return {
    user_id: userId,
    role: p?.role ?? null,
    full_name: `${p?.nome ?? ''} ${p?.cognome ?? ''}`.trim() || oldEmail || userId,
    old_email: oldEmail,
    new_email: newEmail,
    conflict,
    cards_to_update: cardsToUpdate,
    cards_not_touched: cardsNotTouched,
  }
}
