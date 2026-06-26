import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAdminClient } from './supabase-admin'

// ============================================================================
// SUPER ADMIN — data layer (service_role)
// ----------------------------------------------------------------------------
// Tutte le funzioni qui usano il client service_role e DEVONO essere chiamate
// solo da route già protette da requireSuperadmin(). Bypassano le RLS.
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
  // clienti
  linked_professional_id: string | null
  linked_professional_name: string | null
  link_status: string | null
  // diagnostica
  is_orphan: boolean
  orphan_reason: string | null
  // stato piano/abbonamento testuale
  subscription_status: string
}

export interface AdminLink {
  id: string
  client_id: string
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
  has_access: boolean // ha un collegamento (login) attivo
  link_status: string | null
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

// ── Lista utenti completa ─────────────────────────────────────────────────────

export async function getAdminUsers(): Promise<AdminUser[]> {
  const admin = createAdminClient()

  const [authUsers, profilesRes, profProfilesRes, clientsRes, measurementsRes, linksRes] = await Promise.all([
    listAllAuthUsers(admin),
    admin.from('profiles').select('id, nome, cognome, email, role, plan, is_superadmin, organization_id, data_nascita, sesso'),
    admin.from('professional_profiles').select('id, nome, cognome, trial_expires_at'),
    admin.from('clients').select('id, professionista_id'),
    admin.from('measurement_analytics').select('user_id, client_id'),
    admin.from('client_professional_links').select('client_id, professional_id, client_user_id, status'),
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

  // conteggio clienti per professionista
  const clientsByProf = new Map<string, number>()
  for (const c of (clientsRes.data ?? []) as Array<{ id: string; professionista_id: string | null }>) {
    if (c.professionista_id) clientsByProf.set(c.professionista_id, (clientsByProf.get(c.professionista_id) ?? 0) + 1)
  }

  // misurazioni per professionista (user_id) e per cliente (client_id)
  const measByUser = new Map<string, number>()
  const measByClient = new Map<string, number>()
  for (const m of (measurementsRes.data ?? []) as Array<{ user_id: string | null; client_id: string | null }>) {
    if (m.user_id) measByUser.set(m.user_id, (measByUser.get(m.user_id) ?? 0) + 1)
    if (m.client_id) measByClient.set(m.client_id, (measByClient.get(m.client_id) ?? 0) + 1)
  }

  // collegamenti per utente-cliente (client_user_id → link)
  type LinkRow = { client_id: string; professional_id: string; client_user_id: string | null; status: string }
  const linkByClientUser = new Map<string, LinkRow>()
  for (const l of (linksRes.data ?? []) as LinkRow[]) {
    if (l.client_user_id) {
      const prev = linkByClientUser.get(l.client_user_id)
      // preferisci un link attivo a uno revocato
      if (!prev || (prev.status !== 'active' && l.status === 'active')) linkByClientUser.set(l.client_user_id, l)
    }
  }

  // nome professionista (profiles → professional_profiles → email)
  const profName = (id: string): string => {
    const p = profiles.get(id)
    const pp = profProfiles.get(id)
    const nome = pp?.nome ?? p?.nome ?? null
    const cognome = pp?.cognome ?? p?.cognome ?? null
    return fullName(nome, cognome, p?.email ?? null)
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

      const link = linkByClientUser.get(u.id) ?? null
      const linkedProfId = role === 'client' ? link?.professional_id ?? null : null

      // misurazioni: professionista = per user_id; cliente = somma misurazioni dei
      // clients collegati a questo utente-cliente.
      let measurements = measByUser.get(u.id) ?? 0
      if (role === 'client' && link) measurements = measByClient.get(link.client_id) ?? 0

      // stato abbonamento testuale
      let subscription = 'Base'
      if (role === 'professional') {
        if (plan === 'pro') subscription = 'Pro attivo'
        else if (trial) {
          subscription = new Date(trial).getTime() > now ? 'Trial attivo' : 'Trial scaduto'
        } else subscription = 'Base'
      } else if (role === 'client') {
        subscription = link?.status === 'active' ? 'Accesso attivo' : link ? `Accesso ${link.status}` : 'Nessun accesso'
      }

      // orfano?
      let isOrphan = false
      let orphanReason: string | null = null
      if (role === 'client' && (!link || link.status !== 'active')) {
        isOrphan = true
        orphanReason = 'Cliente senza professionista collegato'
      } else if (role === 'professional' && !pp) {
        isOrphan = true
        orphanReason = 'Profilo professionista incompleto'
      } else if (!role && !p) {
        isOrphan = true
        orphanReason = 'Utente senza profilo'
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
        linked_professional_id: linkedProfId,
        linked_professional_name: linkedProfId ? profName(linkedProfId) : null,
        link_status: role === 'client' ? link?.status ?? null : null,
        is_orphan: isOrphan,
        orphan_reason: orphanReason,
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
    admin.from('client_professional_links').select('id, client_id, professional_id, client_user_id, status, created_at, updated_at'),
    admin.from('clients').select('id, nome, cognome, email'),
    admin.from('profiles').select('id, nome, cognome, email'),
    admin.from('professional_profiles').select('id, nome, cognome'),
    listAllAuthUsers(createAdminClient()),
  ])

  type ClientRow = { id: string; nome: string | null; cognome: string | null; email: string | null }
  const clients = new Map<string, ClientRow>()
  for (const c of (clientsRes.data ?? []) as ClientRow[]) clients.set(c.id, c)

  type ProfileRow = { id: string; nome: string | null; cognome: string | null; email: string | null }
  const profiles = new Map<string, ProfileRow>()
  for (const p of (profilesRes.data ?? []) as ProfileRow[]) profiles.set(p.id, p)
  const profProfiles = new Map<string, { nome: string | null; cognome: string | null }>()
  for (const p of (profProfilesRes.data ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) {
    profProfiles.set(p.id, { nome: p.nome, cognome: p.cognome })
  }
  const authEmail = new Map<string, string | null>()
  for (const u of authUsers) authEmail.set(u.id, u.email ?? null)

  const profName = (id: string): string => {
    const p = profiles.get(id)
    const pp = profProfiles.get(id)
    return fullName(pp?.nome ?? p?.nome ?? null, pp?.cognome ?? p?.cognome ?? null, p?.email ?? null)
  }

  type LinkRow = {
    id: string
    client_id: string
    professional_id: string
    client_user_id: string | null
    status: string
    created_at: string | null
    updated_at: string | null
  }
  return ((linksRes.data ?? []) as LinkRow[])
    .map((l): AdminLink => {
      const c = clients.get(l.client_id)
      return {
        id: l.id,
        client_id: l.client_id,
        client_name: fullName(c?.nome ?? null, c?.cognome ?? null, c?.email ?? null),
        client_email: c?.email ?? null,
        professional_id: l.professional_id,
        professional_name: profName(l.professional_id),
        client_user_id: l.client_user_id,
        client_user_email: l.client_user_id ? authEmail.get(l.client_user_id) ?? null : null,
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
  const [clientsRes, profilesRes, profProfilesRes, measurementsRes, linksRes] = await Promise.all([
    admin.from('clients').select('id, nome, cognome, email, professionista_id, created_at'),
    admin.from('profiles').select('id, nome, cognome, email'),
    admin.from('professional_profiles').select('id, nome, cognome'),
    admin.from('measurement_analytics').select('client_id'),
    admin.from('client_professional_links').select('client_id, status'),
  ])

  type ProfileRow = { id: string; nome: string | null; cognome: string | null; email: string | null }
  const profiles = new Map<string, ProfileRow>()
  for (const p of (profilesRes.data ?? []) as ProfileRow[]) profiles.set(p.id, p)
  const profProfiles = new Map<string, { nome: string | null; cognome: string | null }>()
  for (const p of (profProfilesRes.data ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) {
    profProfiles.set(p.id, { nome: p.nome, cognome: p.cognome })
  }
  const measByClient = new Map<string, number>()
  for (const m of (measurementsRes.data ?? []) as Array<{ client_id: string | null }>) {
    if (m.client_id) measByClient.set(m.client_id, (measByClient.get(m.client_id) ?? 0) + 1)
  }
  const linkStatus = new Map<string, string>()
  for (const l of (linksRes.data ?? []) as Array<{ client_id: string; status: string }>) {
    const prev = linkStatus.get(l.client_id)
    if (!prev || (prev !== 'active' && l.status === 'active')) linkStatus.set(l.client_id, l.status)
  }

  const profName = (id: string | null): string | null => {
    if (!id) return null
    const p = profiles.get(id)
    const pp = profProfiles.get(id)
    return fullName(pp?.nome ?? p?.nome ?? null, pp?.cognome ?? p?.cognome ?? null, p?.email ?? null)
  }

  type ClientRow = {
    id: string
    nome: string | null
    cognome: string | null
    email: string | null
    professionista_id: string | null
    created_at: string | null
  }
  return ((clientsRes.data ?? []) as ClientRow[])
    .map((c): AdminClientRow => ({
      id: c.id,
      nome: c.nome,
      cognome: c.cognome,
      full_name: fullName(c.nome, c.cognome, c.email),
      email: c.email,
      professionista_id: c.professionista_id,
      professional_name: profName(c.professionista_id),
      created_at: c.created_at,
      measurements_count: measByClient.get(c.id) ?? 0,
      has_access: linkStatus.get(c.id) === 'active',
      link_status: linkStatus.get(c.id) ?? null,
    }))
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
