import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAdminClient } from './supabase-admin'
import { type AdminIssue, ADMIN_ISSUE_LABELS, clientLinkStatusLabel, linkStatusRank, pickBestLink } from './admin-issues'
import { getAdminMonitoringCounts } from './admin-monitoring'

// ============================================================================
// SUPER ADMIN — data layer (service_role)
// ----------------------------------------------------------------------------
// Tutte le funzioni qui usano il client service_role e DEVONO essere chiamate
// solo da route già protette da requireSuperadmin(). Bypassano le RLS.
//
// PONTE LINK ↔ SCHEDA CRM. Nel database reale quasi tutti i collegamenti in
// client_professional_links hanno client_id NULL e solo client_user_id (l'uid
// dell'account del cliente): la scheda `clients` del professionista si trova
// tramite clients.client_user_id (migration 017) o, per le righe storiche,
// tramite l'email. Tutte le liste qui sotto usano lo stesso resolver
// (buildLinkBridge) così Utenti, Clienti e Collegamenti raccontano la stessa
// storia.
// ============================================================================

export type UserRole = 'professional' | 'client' | null

export interface AdminUser {
  id: string
  email: string | null
  role: UserRole
  nome: string | null
  cognome: string | null
  full_name: string
  data_nascita: string | null
  sesso: string | null
  plan: 'base' | 'pro'
  is_superadmin: boolean
  organization_id: string | null
  created_at: string | null // registrazione (auth.users)
  last_sign_in_at: string | null
  email_confirmed: boolean
  // professionisti
  has_professional_profile: boolean
  trial_expires_at: string | null
  clients_count: number
  measurements_count: number
  // monitoraggi (24h + sonno): registrati dall'utente o, per un professionista,
  // con lui come riferimento più quelli dei suoi clienti collegati
  monitoring_count: number
  // clienti
  linked_professional_id: string | null
  linked_professional_name: string | null
  link_status: string | null
  link_id: string | null
  // diagnostica: al più una segnalazione, con etichetta leggibile
  issue: AdminIssue | null
  issue_label: string | null
  // stato piano/abbonamento testuale
  subscription_status: string
}

export interface AdminLink {
  id: string
  client_id: string | null // client_id grezzo del link (spesso NULL)
  crm_client_id: string | null // scheda CRM risolta via ponte
  client_name: string
  client_email: string | null
  professional_id: string
  professional_name: string
  client_user_id: string | null
  client_user_email: string | null
  status: string
  created_at: string | null
  updated_at: string | null
}

export interface AdminClientRow {
  id: string
  nome: string | null
  cognome: string | null
  full_name: string
  email: string | null
  professionista_id: string | null
  professional_name: string | null
  created_at: string | null
  measurements_count: number
  monitoring_count: number
  client_user_id: string | null // account del cliente (dalla scheda o dal link risolto)
  has_access: boolean // collegamento attivo
  link_status: string | null // stato del miglior collegamento risolto
  link_id: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Scarica TUTTI gli utenti auth (paginato, perPage max 1000).
async function listAllAuthUsers(admin: SupabaseClient): Promise<User[]> {
  const out: User[] = []
  const perPage = 1000
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)
    out.push(...data.users)
    if (data.users.length < perPage) break
  }
  return out
}

function fullName(nome: string | null, cognome: string | null, fallback: string | null): string {
  const f = `${nome ?? ''} ${cognome ?? ''}`.trim()
  return f || fallback || '—'
}

function planOf(p: string | null | undefined): 'base' | 'pro' {
  return p === 'pro' ? 'pro' : 'base'
}

function normEmail(e: string | null | undefined): string | null {
  const n = (e ?? '').trim().toLowerCase()
  return n || null
}

export type LinkRow = {
  id: string
  client_id: string | null
  professional_id: string
  client_user_id: string | null
  status: string
  created_at: string | null
  updated_at: string | null
}

export type ClientRow = {
  id: string
  professionista_id: string | null
  nome: string | null
  cognome: string | null
  email: string | null
  client_user_id: string | null
  created_at: string | null
}

// Risolve, per ogni link, la scheda CRM corrispondente e viceversa.
//   1. link.client_id → clients.id                       (ponte esplicito legacy)
//   2. (professional_id, client_user_id) → clients        (ponte esplicito 017)
//   3. (professional_id, email dell'account cliente)      (fallback storico)
export function buildLinkBridge(
  links: LinkRow[],
  clients: ClientRow[],
  emailOfUser: (userId: string) => string | null,
): { crmByLink: Map<string, ClientRow>; linksByClient: Map<string, LinkRow[]> } {
  const byId = new Map<string, ClientRow>()
  const byProfUser = new Map<string, ClientRow>()
  const byProfEmail = new Map<string, ClientRow>()
  for (const c of clients) {
    byId.set(c.id, c)
    if (c.professionista_id && c.client_user_id) byProfUser.set(`${c.professionista_id}|${c.client_user_id}`, c)
    const e = normEmail(c.email)
    if (c.professionista_id && e) {
      const k = `${c.professionista_id}|${e}`
      // a parità di email tieni la scheda più vecchia (quella "originale")
      const prev = byProfEmail.get(k)
      if (!prev || (c.created_at ?? '') < (prev.created_at ?? '')) byProfEmail.set(k, c)
    }
  }

  const crmByLink = new Map<string, ClientRow>()
  const linksByClient = new Map<string, LinkRow[]>()
  for (const l of links) {
    let c: ClientRow | undefined
    if (l.client_id) c = byId.get(l.client_id)
    if (!c && l.client_user_id) c = byProfUser.get(`${l.professional_id}|${l.client_user_id}`)
    if (!c && l.client_user_id) {
      const e = normEmail(emailOfUser(l.client_user_id))
      if (e) c = byProfEmail.get(`${l.professional_id}|${e}`)
    }
    if (!c) continue
    crmByLink.set(l.id, c)
    const arr = linksByClient.get(c.id)
    if (arr) arr.push(l)
    else linksByClient.set(c.id, [l])
  }
  return { crmByLink, linksByClient }
}

const LINK_COLUMNS = 'id, client_id, professional_id, client_user_id, status, created_at, updated_at'
const CLIENT_COLUMNS = 'id, professionista_id, nome, cognome, email, client_user_id, created_at'

// ── Lista utenti completa ─────────────────────────────────────────────────────

export async function getAdminUsers(): Promise<AdminUser[]> {
  const admin = createAdminClient()

  const [authUsers, profilesRes, profProfilesRes, clientsRes, measurementsRes, linksRes, monitoring] = await Promise.all([
    listAllAuthUsers(admin),
    admin.from('profiles').select('id, nome, cognome, email, role, plan, is_superadmin, organization_id, data_nascita, sesso'),
    admin.from('professional_profiles').select('id, nome, cognome, trial_expires_at'),
    admin.from('clients').select(CLIENT_COLUMNS),
    admin.from('measurement_analytics').select('user_id, client_id'),
    admin.from('client_professional_links').select(LINK_COLUMNS),
    getAdminMonitoringCounts(),
  ])

  type ProfileRow = {
    id: string
    nome: string | null
    cognome: string | null
    email: string | null
    role: string | null
    plan: string | null
    is_superadmin: boolean | null
    organization_id: string | null
    data_nascita: string | null
    sesso: string | null
  }
  const profiles = new Map<string, ProfileRow>()
  for (const p of (profilesRes.data ?? []) as ProfileRow[]) profiles.set(p.id, p)

  type PP = { id: string; nome: string | null; cognome: string | null; trial_expires_at: string | null }
  const profProfiles = new Map<string, PP>()
  for (const p of (profProfilesRes.data ?? []) as PP[]) profProfiles.set(p.id, p)

  const authEmail = new Map<string, string | null>()
  for (const u of authUsers) authEmail.set(u.id, u.email ?? null)
  const emailOfUser = (id: string) => authEmail.get(id) ?? profiles.get(id)?.email ?? null

  const clients = (clientsRes.data ?? []) as ClientRow[]
  const links = (linksRes.data ?? []) as LinkRow[]
  const { crmByLink } = buildLinkBridge(links, clients, emailOfUser)

  // conteggio clienti per professionista
  const clientsByProf = new Map<string, number>()
  for (const c of clients) {
    if (c.professionista_id) clientsByProf.set(c.professionista_id, (clientsByProf.get(c.professionista_id) ?? 0) + 1)
  }

  // misurazioni per utente (user_id: professionista o cliente auto-misurato) e per scheda CRM
  const measByUser = new Map<string, number>()
  const measByClient = new Map<string, number>()
  for (const m of (measurementsRes.data ?? []) as Array<{ user_id: string | null; client_id: string | null }>) {
    if (m.user_id) measByUser.set(m.user_id, (measByUser.get(m.user_id) ?? 0) + 1)
    if (m.client_id) measByClient.set(m.client_id, (measByClient.get(m.client_id) ?? 0) + 1)
  }

  // collegamenti per account cliente (client_user_id → tutti i link)
  const linksByUser = new Map<string, LinkRow[]>()
  for (const l of links) {
    if (!l.client_user_id) continue
    const arr = linksByUser.get(l.client_user_id)
    if (arr) arr.push(l)
    else linksByUser.set(l.client_user_id, [l])
  }
  // schede CRM agganciate esplicitamente all'account (clients.client_user_id)
  const crmIdsByUser = new Map<string, Set<string>>()
  for (const c of clients) {
    if (!c.client_user_id) continue
    const set = crmIdsByUser.get(c.client_user_id) ?? new Set<string>()
    set.add(c.id)
    crmIdsByUser.set(c.client_user_id, set)
  }

  // nome professionista (professional_profiles → profiles → email)
  const profName = (id: string): string => {
    const p = profiles.get(id)
    const pp = profProfiles.get(id)
    return fullName(pp?.nome ?? p?.nome ?? null, pp?.cognome ?? p?.cognome ?? null, p?.email ?? null)
  }

  const now = Date.now()

  return authUsers
    .map((u): AdminUser => {
      const p = profiles.get(u.id)
      const pp = profProfiles.get(u.id)
      const role = (p?.role === 'professional' || p?.role === 'client' ? p.role : null) as UserRole
      const nome = pp?.nome ?? p?.nome ?? null
      const cognome = pp?.cognome ?? p?.cognome ?? null
      const plan = planOf(p?.plan)
      const trial = pp?.trial_expires_at ?? null

      const userLinks = role === 'client' ? linksByUser.get(u.id) ?? [] : []
      const link = pickBestLink(userLinks)
      const linkedProfId = link?.professional_id ?? null

      // misurazioni: professionista = per user_id; cliente = auto-misurate (user_id)
      // + quelle registrate dal professionista sulle sue schede CRM (client_id).
      let measurements = measByUser.get(u.id) ?? 0
      if (role === 'client') {
        const crmIds = new Set<string>(crmIdsByUser.get(u.id) ?? [])
        for (const l of userLinks) {
          const c = crmByLink.get(l.id)
          if (c) crmIds.add(c.id)
        }
        for (const id of crmIds) measurements += measByClient.get(id) ?? 0
      }

      // monitoraggi: registrati dall'utente; per un professionista anche quelli
      // con lui come riferimento e quelli registrati dagli account collegati.
      const monitoringIds = new Set<string>()
      let monitoringCount = monitoring.byUser.get(u.id) ?? 0
      if (role === 'professional') {
        monitoringCount += monitoring.byProfessional.get(u.id) ?? 0
        for (const l of links) {
          if (l.professional_id === u.id && l.client_user_id && l.status === 'active' && !monitoringIds.has(l.client_user_id)) {
            monitoringIds.add(l.client_user_id)
            monitoringCount += monitoring.byUser.get(l.client_user_id) ?? 0
          }
        }
      }

      // stato abbonamento / collegamento testuale
      let subscription = 'Base'
      if (role === 'professional') {
        if (plan === 'pro') subscription = 'Pro attivo'
        else if (trial) subscription = new Date(trial).getTime() > now ? 'Trial attivo' : 'Trial scaduto'
        else subscription = 'Base'
      } else if (role === 'client') {
        subscription = clientLinkStatusLabel(link?.status ?? null)
      }

      // segnalazione (una sola, la più rilevante)
      let issue: AdminIssue | null = null
      if (role === 'client') {
        if (!link) issue = 'no_link'
        else if (link.status === 'pending') issue = 'pending_link'
        else if (link.status !== 'active') issue = 'revoked_link'
      } else if (role === 'professional' && !pp) {
        issue = 'incomplete_profile'
      } else if (!role && !p) {
        issue = 'no_profile'
      }

      return {
        id: u.id,
        email: u.email ?? p?.email ?? null,
        role,
        nome,
        cognome,
        full_name: fullName(nome, cognome, u.email ?? null),
        data_nascita: p?.data_nascita ?? null,
        sesso: p?.sesso ?? null,
        plan,
        is_superadmin: !!p?.is_superadmin,
        organization_id: p?.organization_id ?? null,
        created_at: u.created_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed: !!u.email_confirmed_at,
        has_professional_profile: !!pp,
        trial_expires_at: trial,
        clients_count: clientsByProf.get(u.id) ?? 0,
        measurements_count: measurements,
        monitoring_count: monitoringCount,
        linked_professional_id: linkedProfId,
        linked_professional_name: linkedProfId ? profName(linkedProfId) : null,
        link_status: link?.status ?? null,
        link_id: link?.id ?? null,
        issue,
        issue_label: issue ? ADMIN_ISSUE_LABELS[issue] : null,
        subscription_status: subscription,
      }
    })
    .sort((a, b) => {
      // professionisti prima, poi per nome
      if (a.role !== b.role) {
        if (a.role === 'professional') return -1
        if (b.role === 'professional') return 1
      }
      return a.full_name.localeCompare(b.full_name)
    })
}

// ── Lista collegamenti cliente↔professionista ─────────────────────────────────

export async function getAdminLinks(): Promise<AdminLink[]> {
  const admin = createAdminClient()
  const [linksRes, clientsRes, profilesRes, profProfilesRes, authUsers] = await Promise.all([
    admin.from('client_professional_links').select(LINK_COLUMNS),
    admin.from('clients').select(CLIENT_COLUMNS),
    admin.from('profiles').select('id, nome, cognome, email'),
    admin.from('professional_profiles').select('id, nome, cognome'),
    listAllAuthUsers(admin),
  ])

  type ProfileRow = { id: string; nome: string | null; cognome: string | null; email: string | null }
  const profiles = new Map<string, ProfileRow>()
  for (const p of (profilesRes.data ?? []) as ProfileRow[]) profiles.set(p.id, p)
  const profProfiles = new Map<string, { nome: string | null; cognome: string | null }>()
  for (const p of (profProfilesRes.data ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) {
    profProfiles.set(p.id, { nome: p.nome, cognome: p.cognome })
  }
  const authEmail = new Map<string, string | null>()
  for (const u of authUsers) authEmail.set(u.id, u.email ?? null)
  const emailOfUser = (id: string) => authEmail.get(id) ?? profiles.get(id)?.email ?? null

  const profName = (id: string): string => {
    const p = profiles.get(id)
    const pp = profProfiles.get(id)
    return fullName(pp?.nome ?? p?.nome ?? null, pp?.cognome ?? p?.cognome ?? null, p?.email ?? null)
  }

  const links = (linksRes.data ?? []) as LinkRow[]
  const clients = (clientsRes.data ?? []) as ClientRow[]
  const { crmByLink } = buildLinkBridge(links, clients, emailOfUser)

  return links
    .map((l): AdminLink => {
      const c = crmByLink.get(l.id) ?? null
      const up = l.client_user_id ? profiles.get(l.client_user_id) : undefined
      const userEmail = l.client_user_id ? emailOfUser(l.client_user_id) : null
      // nome: scheda CRM → profilo dell'account → email
      const name = c
        ? fullName(c.nome, c.cognome, c.email ?? userEmail)
        : fullName(up?.nome ?? null, up?.cognome ?? null, userEmail)
      return {
        id: l.id,
        client_id: l.client_id,
        crm_client_id: c?.id ?? null,
        client_name: name,
        client_email: c?.email ?? userEmail,
        professional_id: l.professional_id,
        professional_name: profName(l.professional_id),
        client_user_id: l.client_user_id,
        client_user_email: userEmail,
        status: l.status,
        created_at: l.created_at,
        updated_at: l.updated_at,
      }
    })
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
}

// ── Lista clienti (anagrafica clients) ────────────────────────────────────────

export async function getAdminClients(): Promise<AdminClientRow[]> {
  const admin = createAdminClient()
  const [clientsRes, profilesRes, profProfilesRes, measurementsRes, linksRes, authUsers, monitoring] = await Promise.all([
    admin.from('clients').select(CLIENT_COLUMNS),
    admin.from('profiles').select('id, nome, cognome, email'),
    admin.from('professional_profiles').select('id, nome, cognome'),
    admin.from('measurement_analytics').select('client_id'),
    admin.from('client_professional_links').select(LINK_COLUMNS),
    listAllAuthUsers(admin),
    getAdminMonitoringCounts(),
  ])

  type ProfileRow = { id: string; nome: string | null; cognome: string | null; email: string | null }
  const profiles = new Map<string, ProfileRow>()
  for (const p of (profilesRes.data ?? []) as ProfileRow[]) profiles.set(p.id, p)
  const profProfiles = new Map<string, { nome: string | null; cognome: string | null }>()
  for (const p of (profProfilesRes.data ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) {
    profProfiles.set(p.id, { nome: p.nome, cognome: p.cognome })
  }
  const authEmail = new Map<string, string | null>()
  for (const u of authUsers) authEmail.set(u.id, u.email ?? null)
  const emailOfUser = (id: string) => authEmail.get(id) ?? profiles.get(id)?.email ?? null

  const measByClient = new Map<string, number>()
  for (const m of (measurementsRes.data ?? []) as Array<{ client_id: string | null }>) {
    if (m.client_id) measByClient.set(m.client_id, (measByClient.get(m.client_id) ?? 0) + 1)
  }

  const clients = (clientsRes.data ?? []) as ClientRow[]
  const links = (linksRes.data ?? []) as LinkRow[]
  const { linksByClient } = buildLinkBridge(links, clients, emailOfUser)

  const profName = (id: string | null): string | null => {
    if (!id) return null
    const p = profiles.get(id)
    const pp = profProfiles.get(id)
    return fullName(pp?.nome ?? p?.nome ?? null, pp?.cognome ?? p?.cognome ?? null, p?.email ?? null)
  }

  return clients
    .map((c): AdminClientRow => {
      const best = pickBestLink(linksByClient.get(c.id) ?? [])
      return {
        id: c.id,
        nome: c.nome,
        cognome: c.cognome,
        full_name: fullName(c.nome, c.cognome, c.email),
        email: c.email,
        professionista_id: c.professionista_id,
        professional_name: profName(c.professionista_id),
        created_at: c.created_at,
        measurements_count: measByClient.get(c.id) ?? 0,
        monitoring_count: (monitoring.byClient.get(c.id) ?? 0) + ((c.client_user_id ?? best?.client_user_id) ? monitoring.byUser.get((c.client_user_id ?? best?.client_user_id) as string) ?? 0 : 0),
        client_user_id: c.client_user_id ?? best?.client_user_id ?? null,
        has_access: linkStatusRank(best?.status) === linkStatusRank('active'),
        link_status: best?.status ?? null,
        link_id: best?.id ?? null,
      }
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
}

// Elenco semplice di professionisti per le <select> (id + nome).
export async function getProfessionalsList(): Promise<Array<{ id: string; name: string; email: string | null }>> {
  const admin = createAdminClient()
  const [profilesRes, profProfilesRes] = await Promise.all([
    admin.from('profiles').select('id, nome, cognome, email').eq('role', 'professional'),
    admin.from('professional_profiles').select('id, nome, cognome'),
  ])
  const profProfiles = new Map<string, { nome: string | null; cognome: string | null }>()
  for (const p of (profProfilesRes.data ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) {
    profProfiles.set(p.id, { nome: p.nome, cognome: p.cognome })
  }
  return ((profilesRes.data ?? []) as Array<{ id: string; nome: string | null; cognome: string | null; email: string | null }>)
    .map((p) => {
      const pp = profProfiles.get(p.id)
      return {
        id: p.id,
        name: fullName(pp?.nome ?? p.nome, pp?.cognome ?? p.cognome, p.email),
        email: p.email,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
