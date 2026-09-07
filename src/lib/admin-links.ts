import type { SupabaseClient, User } from '@supabase/supabase-js'
import { logAdminAction } from './admin-audit'
import { linkStatusRank, pickBestLink } from './admin-issues'
import type { ClientRow, LinkRow } from './admin-data'

// ============================================================================
// SUPER ADMIN — operazioni sui collegamenti (service_role)
// ----------------------------------------------------------------------------
// Logica condivisa dalle route /api/admin/clients/[id]/move e
// /api/admin/links/[id] (PATCH professional_id). Da chiamare SOLO dopo
// requireSuperadmin().
//
// Modello dati (vedi admin-data.ts): il collegamento "vero" è per account
// (client_professional_links.client_user_id); la scheda CRM del professionista
// è la riga `clients` con client_user_id (o email) corrispondente. Spostare un
// cliente significa quindi spostare ENTRAMBI: la scheda (con le sue misurazioni,
// note, ecc.) e il collegamento dell'account, altrimenti il nuovo professionista
// non lo vede in dashboard oppure l'app del cliente continua a parlare con il
// vecchio professionista.
// ============================================================================

export type MoveOutcome =
  | { ok: true; client_id: string; from_professional_id: string | null; to_professional_id: string; link_id: string | null; client_user_id: string | null }
  | { ok: false; status: number; error: string; message: string }

const LINK_COLUMNS = 'id, client_id, professional_id, client_user_id, status, created_at, updated_at'
const CLIENT_COLUMNS = 'id, professionista_id, nome, cognome, email, client_user_id, created_at'

function normEmail(e: string | null | undefined): string | null {
  const n = (e ?? '').trim().toLowerCase()
  return n || null
}

// Risolve l'account (profiles.id) di una scheda CRM: ponte esplicito, altrimenti
// email (stesso criterio del trigger tg_create_client_on_active_link).
async function resolveClientUserId(admin: SupabaseClient, crm: ClientRow): Promise<string | null> {
  if (crm.client_user_id) return crm.client_user_id
  const email = normEmail(crm.email)
  if (!email) return null
  const { data } = await admin.from('profiles').select('id').ilike('email', email).limit(1)
  return ((data ?? []) as Array<{ id: string }>)[0]?.id ?? null
}

// Scheda CRM di un link: client_id esplicito → (professionista, account) → (professionista, email).
async function resolveCrmForLink(admin: SupabaseClient, link: LinkRow): Promise<ClientRow | null> {
  if (link.client_id) {
    const { data } = await admin.from('clients').select(CLIENT_COLUMNS).eq('id', link.client_id).maybeSingle()
    if (data) return data as ClientRow
  }
  if (!link.client_user_id) return null
  {
    const { data } = await admin
      .from('clients')
      .select(CLIENT_COLUMNS)
      .eq('professionista_id', link.professional_id)
      .eq('client_user_id', link.client_user_id)
      .limit(1)
    const row = ((data ?? []) as ClientRow[])[0]
    if (row) return row
  }
  const { data: profile } = await admin.from('profiles').select('email').eq('id', link.client_user_id).maybeSingle()
  const email = normEmail((profile as { email: string | null } | null)?.email)
  if (!email) return null
  const { data } = await admin
    .from('clients')
    .select(CLIENT_COLUMNS)
    .eq('professionista_id', link.professional_id)
    .ilike('email', email)
    .order('created_at', { ascending: true })
    .limit(1)
  return ((data ?? []) as ClientRow[])[0] ?? null
}

export async function moveClientToProfessional(
  admin: SupabaseClient,
  actor: User,
  opts: { clientId?: string; linkId?: string; targetProfessionalId: string },
): Promise<MoveOutcome> {
  const target = opts.targetProfessionalId
  if (!target) return { ok: false, status: 400, error: 'missing_params', message: 'Professionista di destinazione mancante.' }

  // 0. Il professionista di destinazione deve esistere.
  const { data: pro } = await admin.from('profiles').select('id, role').eq('id', target).maybeSingle()
  if (!pro) return { ok: false, status: 404, error: 'professional_not_found', message: 'Professionista di destinazione non trovato.' }

  // 1. Punto di partenza: scheda CRM e/o link.
  let crm: ClientRow | null = null
  let startLink: LinkRow | null = null
  if (opts.linkId) {
    const { data } = await admin.from('client_professional_links').select(LINK_COLUMNS).eq('id', opts.linkId).maybeSingle()
    if (!data) return { ok: false, status: 404, error: 'link_not_found', message: 'Collegamento non trovato.' }
    startLink = data as LinkRow
    if (startLink.professional_id === target) {
      return { ok: false, status: 400, error: 'same_professional', message: 'Il collegamento è già con questo professionista.' }
    }
    crm = await resolveCrmForLink(admin, startLink)
  } else if (opts.clientId) {
    const { data } = await admin.from('clients').select(CLIENT_COLUMNS).eq('id', opts.clientId).maybeSingle()
    if (!data) return { ok: false, status: 404, error: 'client_not_found', message: 'Scheda cliente non trovata.' }
    crm = data as ClientRow
  } else {
    return { ok: false, status: 400, error: 'missing_params', message: 'Indica una scheda cliente o un collegamento.' }
  }

  if (crm && crm.professionista_id === target) {
    return { ok: false, status: 400, error: 'same_professional', message: 'Il cliente è già di questo professionista.' }
  }

  const fromProfessionalId = crm?.professionista_id ?? startLink?.professional_id ?? null
  const clientUserId = crm ? await resolveClientUserId(admin, crm) : startLink?.client_user_id ?? null

  // 2. Conflitto: il professionista di destinazione ha già una scheda per
  //    questo account (indice univoco 017) o per questa email. Meglio
  //    fermarsi e chiedere di unire/eliminare il doppione che creare due schede.
  if (clientUserId || crm?.email) {
    let q = admin.from('clients').select('id, nome, cognome, email').eq('professionista_id', target)
    const email = normEmail(crm?.email)
    if (clientUserId && email) q = q.or(`client_user_id.eq.${clientUserId},email.ilike.${email}`)
    else if (clientUserId) q = q.eq('client_user_id', clientUserId)
    else q = q.ilike('email', email as string)
    const { data: dup } = await q.limit(1)
    const d = ((dup ?? []) as Array<{ id: string; nome: string | null; cognome: string | null; email: string | null }>)[0]
    if (d && d.id !== crm?.id) {
      const who = `${d.nome ?? ''} ${d.cognome ?? ''}`.trim() || d.email || d.id
      return {
        ok: false,
        status: 409,
        error: 'target_has_client',
        message: `Il professionista di destinazione ha già una scheda per questo cliente (${who}). Unisci o elimina il doppione prima di spostare.`,
      }
    }
  }

  // 3. Scheda CRM: sposta (e rendi esplicito il ponte se risolto via email).
  //    Se non esiste (link senza scheda), la creiamo sotto il nuovo
  //    professionista: il trigger non scatta perché lo stato non cambia.
  let clientId: string
  if (crm) {
    const patch: Record<string, unknown> = { professionista_id: target }
    if (!crm.client_user_id && clientUserId) patch.client_user_id = clientUserId
    const { error } = await admin.from('clients').update(patch).eq('id', crm.id)
    if (error) return { ok: false, status: 500, error: 'client_update_failed', message: `Scheda: ${error.message}` }
    clientId = crm.id
  } else if (clientUserId) {
    const { data: p } = await admin.from('profiles').select('nome, cognome, email').eq('id', clientUserId).maybeSingle()
    const prof = (p ?? {}) as { nome?: string | null; cognome?: string | null; email?: string | null }
    clientId = String(Date.now())
    const { error } = await admin.from('clients').insert({
      id: clientId,
      professionista_id: target,
      nome: (prof.nome ?? '').trim() || 'Cliente',
      cognome: (prof.cognome ?? '').trim() || '',
      email: normEmail(prof.email),
      client_user_id: clientUserId,
      created_at: new Date().toISOString(),
    })
    if (error) return { ok: false, status: 500, error: 'client_insert_failed', message: `Scheda: ${error.message}` }
  } else {
    return { ok: false, status: 422, error: 'unresolvable', message: 'Collegamento senza scheda né account: impossibile spostarlo.' }
  }

  // 4. Collegamenti dell'account con il vecchio professionista (o per client_id).
  const oldLinks: LinkRow[] = []
  if (startLink) oldLinks.push(startLink)
  if (fromProfessionalId && clientUserId) {
    const { data } = await admin
      .from('client_professional_links')
      .select(LINK_COLUMNS)
      .eq('professional_id', fromProfessionalId)
      .eq('client_user_id', clientUserId)
    for (const l of (data ?? []) as LinkRow[]) if (!oldLinks.some((o) => o.id === l.id)) oldLinks.push(l)
  }
  if (crm) {
    const { data } = await admin.from('client_professional_links').select(LINK_COLUMNS).eq('client_id', crm.id)
    for (const l of (data ?? []) as LinkRow[]) if (!oldLinks.some((o) => o.id === l.id)) oldLinks.push(l)
  }

  let resultLinkId: string | null = null
  const nowIso = new Date().toISOString()
  if (oldLinks.length > 0) {
    const best = pickBestLink(oldLinks) as LinkRow
    // Link già esistente fra account e professionista di destinazione?
    let targetLink: LinkRow | null = null
    if (clientUserId) {
      const { data } = await admin
        .from('client_professional_links')
        .select(LINK_COLUMNS)
        .eq('professional_id', target)
        .eq('client_user_id', clientUserId)
      targetLink = pickBestLink((data ?? []) as LinkRow[])
    }

    if (targetLink) {
      // Riusa il link di destinazione (stato = il migliore fra i due) e revoca i vecchi.
      const status = linkStatusRank(best.status) > linkStatusRank(targetLink.status) ? best.status : targetLink.status
      const { error } = await admin
        .from('client_professional_links')
        .update({ status, client_id: targetLink.client_id ?? clientId, updated_at: nowIso })
        .eq('id', targetLink.id)
      if (error) return { ok: false, status: 500, error: 'link_update_failed', message: `Collegamento: ${error.message}` }
      resultLinkId = targetLink.id
      const { error: revErr } = await admin
        .from('client_professional_links')
        .update({ status: 'revoked', updated_at: nowIso })
        .in('id', oldLinks.map((l) => l.id))
      if (revErr) return { ok: false, status: 500, error: 'link_revoke_failed', message: `Collegamento: ${revErr.message}` }
    } else {
      // Sposta il link migliore sul nuovo professionista, conservando lo stato;
      // eventuali doppioni con il vecchio professionista vengono revocati.
      const { error } = await admin
        .from('client_professional_links')
        .update({ professional_id: target, client_id: clientId, client_user_id: best.client_user_id ?? clientUserId, updated_at: nowIso })
        .eq('id', best.id)
      if (error) return { ok: false, status: 500, error: 'link_update_failed', message: `Collegamento: ${error.message}` }
      resultLinkId = best.id
      const others = oldLinks.filter((l) => l.id !== best.id)
      if (others.length > 0) {
        const { error: revErr } = await admin
          .from('client_professional_links')
          .update({ status: 'revoked', updated_at: nowIso })
          .in('id', others.map((l) => l.id))
        if (revErr) return { ok: false, status: 500, error: 'link_revoke_failed', message: `Collegamento: ${revErr.message}` }
      }
    }
  }

  await logAdminAction(admin, actor, {
    action: 'move_client',
    target_type: 'client',
    target_id: clientId,
    details: {
      from_professional_id: fromProfessionalId,
      to_professional_id: target,
      client_user_id: clientUserId,
      link_id: resultLinkId,
      via: opts.linkId ? 'link' : 'client',
    },
  })

  return { ok: true, client_id: clientId, from_professional_id: fromProfessionalId, to_professional_id: target, link_id: resultLinkId, client_user_id: clientUserId }
}
