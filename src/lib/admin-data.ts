import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAdminClient } from './supabase-admin'
import { type AdminIssue, clientLinkStatusKey, linkStatusRank, pickBestLink } from './admin-issues'
import { getAdminMonitoringCounts } from './admin-monitoring'
import { getCommercialeByUser, type AccountCommerciale } from './admin-commerciale'
import { parteFuso } from './measured-time'

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

// ── Stato commerciale di un professionista ───────────────────────────────────
// Decisione del 15/10/2026: la verità sono `abbonamenti` + `account_stato`
// (migration 024, lette dalla vista v_admin_account). `professional_profiles.
// trial_expires_at` è un dato DERIVATO: lo si usa solo come ripiego quando un
// professionista non ha una riga in `abbonamenti` (fonte 'legacy', evidenziata
// dal pannello) o quando la 024 non è applicata.
//
//   trial_active   piano 'prova' con scadenza oggi o futura (data Europe/Rome)
//   trial_expired  piano 'prova' scaduto
//   pro_active     piano 'pro' senza scadenza o con scadenza oggi o futura
//   pro_expired    piano 'pro' scaduto
//   base           tutto il resto (piano 'base' o sconosciuto)
export type SubscriptionStatus = 'trial_active' | 'trial_expired' | 'pro_active' | 'pro_expired' | 'base'
export type SubscriptionSource = 'abbonamenti' | 'legacy'

export type CommercialStatus = {
  status: SubscriptionStatus
  source: SubscriptionSource
  /** Piano come in `abbonamenti.piano` (o derivato da profiles.plan nel legacy). */
  piano: 'base' | 'pro' | 'prova'
  /** `abbonamenti.data_scadenza` (YYYY-MM-DD) o, nel legacy, l'istante ISO di trial_expires_at. */
  expiresAt: string | null
}

/** Oggi nel fuso italiano, come YYYY-MM-DD (confrontabile con `abbonamenti.data_scadenza`). */
export function todayRome(now: Date = new Date()): string {
  const p = parteFuso(now)
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

// Funzione pura: stesso ragionamento per il pannello
// (Panoramica, filtri di Utenti) e per i campi esposti dall'API.
export function commercialStatus(
  input: {
    abbonamento: { piano: string | null; data_scadenza: string | null } | null
    legacy: { plan: string | null | undefined; trial_expires_at: string | null | undefined }
  },
  today: string = todayRome(),
  nowMs: number = Date.now(),
): CommercialStatus {
  const a = input.abbonamento
  if (a && a.piano) {
    const piano: CommercialStatus['piano'] = a.piano === 'pro' ? 'pro' : a.piano === 'prova' ? 'prova' : 'base'
    // data_scadenza è una DATE: 'YYYY-MM-DD' si confronta come stringa.
    const scadenza = a.data_scadenza ? a.data_scadenza.slice(0, 10) : null
    const valida = scadenza === null || scadenza >= today
    let status: SubscriptionStatus = 'base'
    if (piano === 'prova') status = valida ? 'trial_active' : 'trial_expired'
    else if (piano === 'pro') status = valida ? 'pro_active' : 'pro_expired'
    return { status, source: 'abbonamenti', piano, expiresAt: scadenza }
  }
  // Ripiego legacy: profiles.plan + professional_profiles.trial_expires_at.
  const trial = input.legacy.trial_expires_at ?? null
  if (input.legacy.plan === 'pro') return { status: 'pro_active', source: 'legacy', piano: 'pro', expiresAt: null }
  if (trial) {
    const attiva = new Date(trial).getTime() > nowMs
    return { status: attiva ? 'trial_active' : 'trial_expired', source: 'legacy', piano: 'prova', expiresAt: trial }
  }
  return { status: 'base', source: 'legacy', piano: 'base', expiresAt: null }
}

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
  // Scadenza della prova: `abbonamenti.data_scadenza` quando il piano è 'prova'
  // (o il vecchio trial_expires_at nel ripiego legacy); null negli altri casi.
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
  // diagnostica: al più una segnalazione (etichetta tradotta in UI con adminIssueLabel)
  issue: AdminIssue | null
  issue_label: AdminIssue | null
  // stato piano/abbonamento come codice (SubscriptionStatus per i professionisti,
  // stato del collegamento per i clienti): la UI lo traduce
  subscription_status: string
  // da dove viene lo stato commerciale: 'abbonamenti' (verità) o 'legacy'
  // (nessuna riga in abbonamenti: ripiego su profiles.plan/trial_expires_at,
  // da evidenziare nel pannello); null per chi non è professionista
  subscription_source: SubscriptionSource | null
  // scadenza dell'abbonamento (abbonamenti.data_scadenza) o null se senza scadenza
  subscription_expires_at: string | null
  // stato account, abbonamento, moduli (migration 024); null se non applicata
  commerciale: AccountCommerciale | null
}

// ── Possibili duplicati (schede `clients` non unite) ─────────────────────────

export type DuplicateClient = AdminClientRow & {
  data_nascita: string | null
  last_measurement_at: string | null
}

export type DuplicateGroup = {
  key: string
  /** Criterio che ha fatto scattare il gruppo. */
  reason: 'name_birth' | 'email'
  nome: string | null
  cognome: string | null
  data_nascita: string | null
  email: string | null
  /** Schede di professionisti diversi: l'unione richiede prima uno spostamento. */
  cross_professional: boolean
  clients: DuplicateClient[]
}

// ── Misurazioni senza scheda (sessions.client_id nullo) ──────────────────────

export type UnassignedSession = {
  id: string
  /** Istante reale (started_at_utc, altrimenti started_at). */
  started_at: string | null
  professionista_id: string | null
  professional_name: string | null
  professional_email: string | null
  /** Ruolo dell'account che ha registrato: 'client' = misurazione remota dalla sua app. */
  account_role: UserRole
  test_type: string | null
  duration_seconds: number | null
  client_nome: string | null
  /** Scheda deducibile (clients.client_user_id = account) e suo titolare, per il link. */
  deduced_client_id: string | null
  deduced_client_name: string | null
  deduced_professional_id: string | null
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

// Tutte le righe di una select (PostgREST restituisce al massimo 1000 righe
// per richiesta: measurement_analytics ne ha migliaia).
// `orderBy`: colonna per rendere stabile la paginazione (senza, Postgres non
// garantisce lo stesso ordine fra una pagina e l'altra).
async function selectAll<T>(admin: SupabaseClient, table: string, columns: string, orderBy?: string): Promise<{ data: T[]; error: null }> {
  const out: T[] = []
  const PAGE = 1000
  for (let from = 0; from < 1_000_000; from += PAGE) {
    let q = admin.from(table).select(columns)
    if (orderBy) q = q.order(orderBy)
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...((data ?? []) as T[]))
    if ((data ?? []).length < PAGE) break
  }
  return { data: out, error: null }
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

  const [authUsers, profilesRes, profProfilesRes, clientsRes, measurementsRes, linksRes, monitoring, commerciale] = await Promise.all([
    listAllAuthUsers(admin),
    admin.from('profiles').select('id, nome, cognome, email, role, plan, is_superadmin, organization_id, data_nascita, sesso'),
    admin.from('professional_profiles').select('id, nome, cognome, trial_expires_at'),
    admin.from('clients').select(CLIENT_COLUMNS),
    selectAll<{ user_id: string | null; client_id: string | null }>(admin, 'measurement_analytics', 'user_id, client_id'),
    admin.from('client_professional_links').select(LINK_COLUMNS),
    getAdminMonitoringCounts(),
    getCommercialeByUser(admin),
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
  const today = todayRome(new Date(now))

  return authUsers
    .map((u): AdminUser => {
      const p = profiles.get(u.id)
      const pp = profProfiles.get(u.id)
      const role = (p?.role === 'professional' || p?.role === 'client' ? p.role : null) as UserRole
      const nome = pp?.nome ?? p?.nome ?? null
      const cognome = pp?.cognome ?? p?.cognome ?? null
      const plan = planOf(p?.plan)
      const comm = commerciale?.get(u.id) ?? null

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

      // stato abbonamento (professionisti: abbonamenti + account_stato, ripiego
      // legacy se manca la riga) / stato del collegamento (clienti)
      let subscription = 'base'
      let subscriptionSource: SubscriptionSource | null = null
      let subscriptionExpiresAt: string | null = null
      let trial: string | null = null
      if (role === 'professional') {
        const cs = commercialStatus(
          { abbonamento: comm ? { piano: comm.piano, data_scadenza: comm.data_scadenza } : null, legacy: { plan: p?.plan, trial_expires_at: pp?.trial_expires_at } },
          today,
          now,
        )
        subscription = cs.status
        subscriptionSource = cs.source
        subscriptionExpiresAt = cs.expiresAt
        trial = cs.piano === 'prova' ? cs.expiresAt : null
      } else if (role === 'client') {
        subscription = clientLinkStatusKey(link?.status ?? null)
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
        issue_label: issue,
        subscription_status: subscription,
        subscription_source: subscriptionSource,
        subscription_expires_at: subscriptionExpiresAt,
        commerciale: comm,
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
    selectAll<{ client_id: string | null }>(admin, 'measurement_analytics', 'client_id'),
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

// ── Possibili duplicati ───────────────────────────────────────────────────────
// Schede `clients` non unite (merged_into_client_id nullo) che condividono
// (nome, cognome, data di nascita) oppure la stessa email, anche fra
// professionisti diversi. Solo lettura: l'unione la decide il superadmin dal
// MergeClientsModal (RPC admin_merge_clients / collegamenti_merge_card), che
// richiede lo stesso professionista: per i gruppi "trasversali" prima si sposta.
// Numero e data dell'ultima misurazione vengono da `sessions` (la tabella di
// origine), istante letto da started_at_utc.

type SessionStampRow = { client_id: string | null; started_at_utc: string | null; started_at: string | null }

function sessionInstant(r: { started_at_utc: string | null; started_at: string | null }): string | null {
  return r.started_at_utc ?? r.started_at ?? null
}

export function groupDuplicateClients(rows: DuplicateClient[]): DuplicateGroup[] {
  const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()
  // Union-find: una scheda può condividere il nome con una e l'email con un'altra.
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    let r = id
    while (parent.get(r) !== r) r = parent.get(r) as string
    let cur = id
    while (parent.get(cur) !== r) { const n = parent.get(cur) as string; parent.set(cur, r); cur = n }
    return r
  }
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb) }
  for (const c of rows) parent.set(c.id, c.id)

  const byName = new Map<string, string[]>()
  const byEmail = new Map<string, string[]>()
  for (const c of rows) {
    const n = norm(c.nome), cg = norm(c.cognome)
    if (n && cg) {
      const k = `${n}|${cg}|${c.data_nascita ?? ''}`
      byName.set(k, [...(byName.get(k) ?? []), c.id])
    }
    const e = norm(c.email)
    if (e) byEmail.set(e, [...(byEmail.get(e) ?? []), c.id])
  }
  const nameKeyed = new Set<string>()
  const emailKeyed = new Set<string>()
  for (const ids of byName.values()) if (ids.length > 1) { ids.forEach((id) => { nameKeyed.add(id); union(ids[0], id) }) }
  for (const ids of byEmail.values()) if (ids.length > 1) { ids.forEach((id) => { emailKeyed.add(id); union(ids[0], id) }) }

  const groups = new Map<string, DuplicateClient[]>()
  for (const c of rows) {
    const r = find(c.id)
    if (r === c.id && !nameKeyed.has(c.id) && !emailKeyed.has(c.id)) continue
    groups.set(r, [...(groups.get(r) ?? []), c])
  }
  const out: DuplicateGroup[] = []
  for (const [key, clients] of groups) {
    if (clients.length < 2) continue
    clients.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    const first = clients[0]
    const reason: DuplicateGroup['reason'] = clients.some((c) => nameKeyed.has(c.id)) ? 'name_birth' : 'email'
    out.push({
      key,
      reason,
      nome: first.nome,
      cognome: first.cognome,
      data_nascita: clients.find((c) => c.data_nascita)?.data_nascita ?? null,
      email: clients.find((c) => norm(c.email))?.email ?? null,
      cross_professional: new Set(clients.map((c) => c.professionista_id ?? '')).size > 1,
      clients,
    })
  }
  return out.sort((a, b) => `${a.cognome ?? ''} ${a.nome ?? ''}`.localeCompare(`${b.cognome ?? ''} ${b.nome ?? ''}`))
}

export async function getAdminClientDuplicates(): Promise<DuplicateGroup[]> {
  const admin = createAdminClient()
  const [rows, extraRes, sessionsRes] = await Promise.all([
    getAdminClients(),
    admin.from('clients').select('id, data_nascita, merged_into_client_id').is('merged_into_client_id', null),
    selectAll<SessionStampRow>(admin, 'sessions', 'client_id, started_at_utc, started_at', 'id'),
  ])
  if (extraRes.error) throw new Error(`clients (duplicati): ${extraRes.error.message}`)
  const extra = new Map<string, { data_nascita: string | null }>()
  for (const r of (extraRes.data ?? []) as Array<{ id: string; data_nascita: string | null }>) extra.set(r.id, { data_nascita: r.data_nascita })

  const count = new Map<string, number>()
  const last = new Map<string, string>()
  for (const s of sessionsRes.data) {
    if (!s.client_id) continue
    count.set(s.client_id, (count.get(s.client_id) ?? 0) + 1)
    const i = sessionInstant(s)
    if (i && i > (last.get(s.client_id) ?? '')) last.set(s.client_id, i)
  }

  // Solo le schede non unite (extra contiene esattamente quelle).
  const candidates: DuplicateClient[] = rows
    .filter((c) => extra.has(c.id))
    .map((c) => ({
      ...c,
      measurements_count: count.get(c.id) ?? 0,
      data_nascita: extra.get(c.id)?.data_nascita ?? null,
      last_measurement_at: last.get(c.id) ?? null,
    }))
  return groupDuplicateClients(candidates)
}

// ── Misurazioni senza scheda ──────────────────────────────────────────────────
// `sessions.client_id` nullo negli ultimi N giorni. Due casi reali:
//   • account cliente: misurazione remota dalla sua app (professionista_id = uid
//     del cliente, nessuna scheda): normale, il sito la mostra tramite il ponte
//     di remote-sessions. La scheda "deducibile" è quella con
//     clients.client_user_id = account (preferita quella del professionista
//     con collegamento attivo);
//   • account professionista: misurazione fatta in studio senza scegliere la
//     scheda (resta solo client_nome, se c'è). Nessuna scheda deducibile.
// Solo elenco, nessuna azione automatica.

export async function getAdminUnassignedSessions(days = 30): Promise<UnassignedSession[]> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  type Row = {
    id: string
    professionista_id: string | null
    client_nome: string | null
    started_at: string | null
    started_at_utc: string | null
    test_type: string | null
    duration_seconds: number | null
  }
  const { data, error } = await admin
    .from('sessions')
    .select('id, professionista_id, client_nome, started_at, started_at_utc, test_type, duration_seconds')
    .is('client_id', null)
    .or(`started_at_utc.gte.${since},and(started_at_utc.is.null,started_at.gte.${since})`)
    .order('started_at_utc', { ascending: false, nullsFirst: false })
    .limit(2000)
  if (error) throw new Error(`sessions (non assegnate): ${error.message}`)
  const sessions = (data ?? []) as Row[]

  const accountIds = Array.from(new Set(sessions.map((s) => s.professionista_id).filter((v): v is string => !!v)))
  const [profilesRes, ppRes, cardsRes, linksRes] = await Promise.all([
    accountIds.length ? admin.from('profiles').select('id, nome, cognome, email, role').in('id', accountIds) : Promise.resolve({ data: [], error: null }),
    accountIds.length ? admin.from('professional_profiles').select('id, nome, cognome').in('id', accountIds) : Promise.resolve({ data: [], error: null }),
    accountIds.length
      ? admin.from('clients').select('id, professionista_id, nome, cognome, client_user_id, created_at').in('client_user_id', accountIds).is('merged_into_client_id', null)
      : Promise.resolve({ data: [], error: null }),
    accountIds.length ? admin.from('client_professional_links').select('professional_id, client_user_id, status').in('client_user_id', accountIds) : Promise.resolve({ data: [], error: null }),
  ])
  for (const [label, r] of [['profiles', profilesRes], ['professional_profiles', ppRes], ['clients', cardsRes], ['client_professional_links', linksRes]] as const) {
    if (r.error) throw new Error(`${label} (non assegnate): ${r.error.message}`)
  }

  type ProfileRow = { id: string; nome: string | null; cognome: string | null; email: string | null; role: string | null }
  const profiles = new Map<string, ProfileRow>()
  for (const p of (profilesRes.data ?? []) as ProfileRow[]) profiles.set(p.id, p)
  const pp = new Map<string, { nome: string | null; cognome: string | null }>()
  for (const p of (ppRes.data ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) pp.set(p.id, p)

  type CardRow = { id: string; professionista_id: string | null; nome: string | null; cognome: string | null; client_user_id: string | null; created_at: string | null }
  const cardsByUser = new Map<string, CardRow[]>()
  for (const c of (cardsRes.data ?? []) as CardRow[]) {
    if (!c.client_user_id) continue
    cardsByUser.set(c.client_user_id, [...(cardsByUser.get(c.client_user_id) ?? []), c])
  }
  const activeLink = new Set<string>()
  for (const l of (linksRes.data ?? []) as Array<{ professional_id: string; client_user_id: string | null; status: string }>) {
    if (l.status === 'active' && l.client_user_id) activeLink.add(`${l.professional_id}|${l.client_user_id}`)
  }

  const name = (id: string | null): string | null => {
    if (!id) return null
    const a = pp.get(id), b = profiles.get(id)
    return `${a?.nome ?? b?.nome ?? ''} ${a?.cognome ?? b?.cognome ?? ''}`.trim() || b?.email || null
  }

  return sessions
    .map((s): UnassignedSession => {
      const prof = s.professionista_id ? profiles.get(s.professionista_id) : undefined
      const role: UserRole = prof?.role === 'professional' || prof?.role === 'client' ? prof.role : null
      // Scheda deducibile solo per un account cliente: quella del professionista
      // con collegamento attivo, altrimenti la più vecchia.
      let card: CardRow | null = null
      if (role === 'client' && s.professionista_id) {
        const cards = (cardsByUser.get(s.professionista_id) ?? []).slice().sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
        card = cards.find((c) => c.professionista_id && activeLink.has(`${c.professionista_id}|${s.professionista_id}`)) ?? cards[0] ?? null
      }
      return {
        id: s.id,
        started_at: sessionInstant(s),
        professionista_id: s.professionista_id,
        professional_name: name(s.professionista_id),
        professional_email: prof?.email ?? null,
        account_role: role,
        test_type: s.test_type,
        duration_seconds: s.duration_seconds,
        client_nome: s.client_nome?.trim() || null,
        deduced_client_id: card?.id ?? null,
        deduced_client_name: card ? fullName(card.nome, card.cognome, null) : null,
        deduced_professional_id: card?.professionista_id ?? null,
      }
    })
    .sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''))
}
