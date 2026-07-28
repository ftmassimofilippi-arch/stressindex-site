'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Users, UserCog, Link2, Search, Loader2, AlertTriangle, Plus, Crown, ShieldCheck,
  Mail, KeyRound, Trash2, ArrowRightLeft, Activity, RefreshCw, X, CheckCircle2, Ban,
} from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { formatDate, formatRelative } from '@/lib/format'
import type { AdminUser, AdminClientRow, AdminLink } from '@/lib/admin-data'

// ============================================================================
// Pannello Super Admin — gestione utenti, clienti e collegamenti.
// Tutte le azioni privilegiate passano dalle route /api/admin/* (service_role,
// verifica superadmin lato server). Questo componente è solo presentazione + fetch.
// ============================================================================

type Tab = 'users' | 'clients' | 'links'

type Toast = { kind: 'ok' | 'err'; text: string } | null

async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

export function AdminPanel({ serviceRoleConfigured }: { serviceRoleConfigured: boolean }) {
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [clients, setClients] = useState<AdminClientRow[]>([])
  const [links, setLinks] = useState<AdminLink[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  const professionals = useMemo(
    () => users.filter((u) => u.role === 'professional').map((u) => ({ id: u.id, name: u.full_name, email: u.email })),
    [users],
  )

  const showToast = useCallback((t: Toast) => {
    setToast(t)
    if (t) setTimeout(() => setToast(null), 4000)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const [u, c, l] = await Promise.all([
      api('GET', '/api/admin/users'),
      api('GET', '/api/admin/clients'),
      api('GET', '/api/admin/links'),
    ])
    if (!u.ok) setLoadError(u.json?.error ?? 'Errore caricamento utenti')
    setUsers(u.json?.users ?? [])
    setClients(c.json?.clients ?? [])
    setLinks(l.json?.links ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (serviceRoleConfigured) reload()
    else setLoading(false)
  }, [serviceRoleConfigured, reload])

  if (!serviceRoleConfigured) {
    return (
      <div className="card p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-medium text-anthracite">Service role non configurata</h3>
            <p className="text-sm text-anthracite-lighter mt-1">
              Il pannello Super Admin richiede la <code className="px-1 bg-surface rounded">SUPABASE_SERVICE_ROLE_KEY</code> lato server.
              Aggiungila in <code className="px-1 bg-surface rounded">.env.local</code> (e nelle env di Vercel), poi ricarica.
              La trovi in Supabase → Project Settings → API → <b>service_role</b>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const TABS: Array<{ key: Tab; label: string; icon: typeof Users; count: number }> = [
    { key: 'users', label: 'Utenti', icon: Users, count: users.length },
    { key: 'clients', label: 'Clienti', icon: UserCog, count: clients.length },
    { key: 'links', label: 'Collegamenti', icon: Link2, count: links.length },
  ]

  return (
    <div>
      {/* Tabs + reload */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="inline-flex p-1 bg-surface rounded-xl border border-surface-border overflow-x-auto max-w-full">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active ? 'bg-white text-anthracite shadow-card' : 'text-anthracite-lighter hover:text-anthracite'
                }`}
              >
                <Icon size={15} />
                {t.label}
                <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${active ? 'bg-teal-light text-teal-dark' : 'bg-white/60 text-anthracite-lighter'}`}>
                  {t.count}
                </span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-surface-border hover:bg-surface text-anthracite-lighter disabled:opacity-50"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Aggiorna
        </button>
      </div>

      {loadError && (
        <div className="callout-amber mb-4 text-sm">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {loading ? (
        <div className="card p-12 flex items-center justify-center text-anthracite-lighter">
          <Loader2 className="animate-spin mr-2" size={18} /> Caricamento…
        </div>
      ) : tab === 'users' ? (
        <UsersTab users={users} onChanged={reload} showToast={showToast} />
      ) : tab === 'clients' ? (
        <ClientsTab clients={clients} professionals={professionals} onChanged={reload} showToast={showToast} />
      ) : (
        <LinksTab links={links} professionals={professionals} onChanged={reload} showToast={showToast} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-xl shadow-elevated text-sm font-medium flex items-center gap-2 bg-white border border-surface-border">
          {toast.kind === 'ok' ? <CheckCircle2 size={16} className="text-green-500" /> : <AlertTriangle size={16} className="text-red-500" />}
          <span className={toast.kind === 'ok' ? 'text-anthracite' : 'text-red-600'}>{toast.text}</span>
        </div>
      )}
    </div>
  )
}

// ── Badge ruolo/piano/stato ──────────────────────────────────────────────────

function RoleBadge({ role }: { role: AdminUser['role'] }) {
  if (role === 'professional')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-light text-teal-dark"><ShieldCheck size={11} /> Professionista</span>
  if (role === 'client')
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface text-anthracite-lighter border border-surface-border">Cliente</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-600">—</span>
}

function PlanBadge({ plan }: { plan: 'base' | 'pro' }) {
  return plan === 'pro' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-50 text-teal-dark border border-teal-200"><Crown size={11} /> Pro</span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface text-anthracite-lighter border border-surface-border">Base</span>
  )
}

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase()
  const cls = s.includes('attiv')
    ? 'bg-green-50 text-green-600'
    : s.includes('scadut') || s.includes('revoc') || s.includes('nessun')
      ? 'bg-red-50 text-red-500'
      : s.includes('pending')
        ? 'bg-amber-50 text-amber-600'
        : 'bg-surface text-anthracite-lighter'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>{status}</span>
}

// ── TAB UTENTI ────────────────────────────────────────────────────────────────

function UsersTab({ users, onChanged, showToast }: { users: AdminUser[]; onChanged: () => void; showToast: (t: Toast) => void }) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'professional' | 'client' | 'orphan'>('all')
  const [planFilter, setPlanFilter] = useState<'all' | 'pro' | 'base'>('all')
  const [selected, setSelected] = useState<AdminUser | null>(null)

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return users.filter((u) => {
      if (s) {
        const hay = `${u.full_name} ${u.email ?? ''}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      if (roleFilter === 'orphan' && !u.is_orphan) return false
      if (roleFilter === 'professional' && u.role !== 'professional') return false
      if (roleFilter === 'client' && u.role !== 'client') return false
      if (planFilter !== 'all' && u.plan !== planFilter) return false
      return true
    })
  }, [users, search, roleFilter, planFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-anthracite-lighter" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome o email…"
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)} className="px-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30">
          <option value="all">Tutti i ruoli</option>
          <option value="professional">Professionisti</option>
          <option value="client">Clienti</option>
          <option value="orphan">Solo orfani</option>
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as typeof planFilter)} className="px-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30">
          <option value="all">Tutti i piani</option>
          <option value="pro">Pro</option>
          <option value="base">Base</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left text-anthracite-lighter border-b border-surface-border bg-surface">
                <th className="px-4 py-3 font-medium">Utente</th>
                <th className="px-3 py-3 font-medium">Ruolo</th>
                <th className="px-3 py-3 font-medium">Piano</th>
                <th className="px-3 py-3 font-medium">Stato</th>
                <th className="px-3 py-3 font-medium">Registrazione</th>
                <th className="px-3 py-3 font-medium">Ultimo accesso</th>
                <th className="px-3 py-3 font-medium text-right">Mis.</th>
                <th className="px-4 py-3 font-medium text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-surface-border hover:bg-surface/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium text-anthracite flex items-center gap-1.5">
                          {u.full_name}
                          {u.is_superadmin && <ShieldCheck size={13} className="text-teal-dark" aria-label="Superadmin" />}
                          {u.is_orphan && (
                            <span title={u.orphan_reason ?? 'Orfano'} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600">
                              <AlertTriangle size={10} /> Orfano
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-anthracite-lighter">{u.email ?? '—'}</div>
                        {u.role === 'client' && u.linked_professional_name && (
                          <div className="text-[11px] text-anthracite-lighter mt-0.5">↳ {u.linked_professional_name}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-3 py-3">{u.role === 'professional' ? <PlanBadge plan={u.plan} /> : <span className="text-anthracite-lighter">—</span>}</td>
                  <td className="px-3 py-3"><StatusPill status={u.subscription_status} /></td>
                  <td className="px-3 py-3 text-anthracite-lighter whitespace-nowrap">{u.created_at ? formatDate(u.created_at) : '—'}</td>
                  <td className="px-3 py-3 text-anthracite-lighter whitespace-nowrap">{u.last_sign_in_at ? formatRelative(u.last_sign_in_at) : 'Mai'}</td>
                  <td className="px-3 py-3 text-right text-anthracite">{u.measurements_count}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setSelected(u)} className="inline-flex items-center gap-1 text-teal-dark hover:underline text-sm font-medium">
                      <UserCog size={14} /> Gestisci
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-anthracite-lighter">Nessun utente trovato.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <UserDetailModal
          user={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { onChanged(); setSelected(null) }}
          showToast={showToast}
        />
      )}
    </div>
  )
}

// ── Modale dettaglio/azioni utente ────────────────────────────────────────────

function UserDetailModal({ user, onClose, onChanged, showToast }: { user: AdminUser; onClose: () => void; onChanged: () => void; showToast: (t: Toast) => void }) {
  const [form, setForm] = useState({
    nome: user.nome ?? '',
    cognome: user.cognome ?? '',
    email: user.email ?? '',
    data_nascita: user.data_nascita ?? '',
    sesso: user.sesso ?? '',
  })
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | 'delete' | 'role' | 'setpw'>(null)
  const [newPassword, setNewPassword] = useState('')
  const [cascade, setCascade] = useState(false)
  const [sessions, setSessions] = useState<Array<{ id: string; measured_at: string | null; client_name: string; professional_name: string; test_type: string | null }> | null>(null)
  const [showSessions, setShowSessions] = useState(false)

  async function saveAnagrafica() {
    setBusy('save')
    const { ok, json } = await api('PATCH', `/api/admin/users/${user.id}`, {
      nome: form.nome, cognome: form.cognome, email: form.email,
      data_nascita: form.data_nascita || null, sesso: form.sesso,
    })
    setBusy(null)
    if (ok) { showToast({ kind: 'ok', text: 'Dati aggiornati' }); onChanged() }
    else showToast({ kind: 'err', text: json?.error ?? 'Errore salvataggio' })
  }

  async function togglePlan() {
    const next = user.plan === 'pro' ? 'base' : 'pro'
    setBusy('plan')
    const { ok, json } = await api('PATCH', `/api/admin/users/${user.id}`, { plan: next })
    setBusy(null)
    if (ok) { showToast({ kind: 'ok', text: `Piano impostato su ${next.toUpperCase()}` }); onChanged() }
    else showToast({ kind: 'err', text: json?.error ?? 'Errore' })
  }

  async function changeRole() {
    const next = user.role === 'professional' ? 'client' : 'professional'
    setBusy('role')
    const { ok, json } = await api('PATCH', `/api/admin/users/${user.id}`, { role: next })
    setBusy(null); setConfirm(null)
    if (ok) { showToast({ kind: 'ok', text: `Ruolo cambiato in ${next}` }); onChanged() }
    else showToast({ kind: 'err', text: json?.error ?? 'Errore' })
  }

  async function resetPassword() {
    setBusy('reset')
    const { ok, json } = await api('POST', `/api/admin/users/${user.id}/password`, { action: 'reset' })
    setBusy(null)
    if (ok) showToast({ kind: 'ok', text: `Email di reset inviata a ${json?.email ?? user.email}` })
    else showToast({ kind: 'err', text: json?.error ?? 'Errore invio email' })
  }

  async function setPassword() {
    setBusy('setpw')
    const { ok, json } = await api('POST', `/api/admin/users/${user.id}/password`, { action: 'set', password: newPassword })
    setBusy(null); setConfirm(null)
    if (ok) { showToast({ kind: 'ok', text: 'Password aggiornata' }); setNewPassword('') }
    else showToast({ kind: 'err', text: json?.error === 'password_too_short' ? 'Password troppo corta (min 8)' : json?.error ?? 'Errore' })
  }

  async function loadSessions() {
    setShowSessions(true)
    if (sessions) return
    const { ok, json } = await api('GET', `/api/admin/users/${user.id}/sessions`)
    if (ok) setSessions(json?.sessions ?? [])
    else { setSessions([]); showToast({ kind: 'err', text: json?.error ?? 'Errore sessioni' }) }
  }

  async function deleteUser() {
    setBusy('delete')
    const qs = cascade ? '?cascadeClients=true' : ''
    const { ok, json } = await api('DELETE', `/api/admin/users/${user.id}${qs}`)
    setBusy(null); setConfirm(null)
    if (ok) { showToast({ kind: 'ok', text: 'Utente eliminato' }); onChanged() }
    else showToast({ kind: 'err', text: json?.error === 'cannot_delete_self' ? 'Non puoi eliminare te stesso' : json?.error ?? 'Errore eliminazione' })
  }

  const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal'

  return (
    <Modal open onClose={onClose} title={user.full_name} description={user.email ?? undefined} size="lg">
      <div className="space-y-6">
        {/* Anagrafica */}
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-anthracite-lighter mb-3">Anagrafica</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="input-label">Nome</label><input className={inputCls} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><label className="input-label">Cognome</label><input className={inputCls} value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
            <div><label className="input-label">Email</label><input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="input-label">Data di nascita</label><input className={inputCls} type="date" value={form.data_nascita ? form.data_nascita.slice(0, 10) : ''} onChange={(e) => setForm({ ...form, data_nascita: e.target.value })} /></div>
            <div>
              <label className="input-label">Sesso</label>
              <select className={inputCls} value={form.sesso} onChange={(e) => setForm({ ...form, sesso: e.target.value })}>
                <option value="">—</option><option value="M">M</option><option value="F">F</option><option value="X">X</option>
              </select>
            </div>
          </div>
          <button type="button" onClick={saveAnagrafica} disabled={busy === 'save'} className="btn-primary mt-3 text-sm py-2.5">
            {busy === 'save' ? <Loader2 size={15} className="animate-spin" /> : 'Salva anagrafica'}
          </button>
        </section>

        {/* Piano + ruolo */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-surface-border p-4">
            <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-anthracite">Piano</span><PlanBadge plan={user.plan} /></div>
            <button type="button" onClick={togglePlan} disabled={busy === 'plan'} className="w-full text-sm px-3 py-2 rounded-lg border border-teal-dark text-teal-dark hover:bg-teal-50 disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
              {busy === 'plan' ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />}
              {user.plan === 'pro' ? 'Disattiva Pro' : 'Attiva Pro'}
            </button>
          </div>
          <div className="rounded-xl border border-surface-border p-4">
            <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-anthracite">Ruolo</span><RoleBadge role={user.role} /></div>
            <button type="button" onClick={() => setConfirm('role')} disabled={busy === 'role'} className="w-full text-sm px-3 py-2 rounded-lg border border-surface-border text-anthracite hover:bg-surface disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
              <ArrowRightLeft size={14} /> {user.role === 'professional' ? 'Rendi cliente' : 'Rendi professionista'}
            </button>
          </div>
        </section>

        {/* Password */}
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-anthracite-lighter mb-3">Password</h4>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={resetPassword} disabled={busy === 'reset'} className="text-sm px-3 py-2 rounded-lg border border-surface-border hover:bg-surface inline-flex items-center gap-1.5 disabled:opacity-50">
              {busy === 'reset' ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Invia email di reset
            </button>
            <button type="button" onClick={() => setConfirm('setpw')} className="text-sm px-3 py-2 rounded-lg border border-surface-border hover:bg-surface inline-flex items-center gap-1.5">
              <KeyRound size={14} /> Imposta password manuale
            </button>
          </div>
        </section>

        {/* Sessioni */}
        <section>
          <button type="button" onClick={loadSessions} className="text-sm px-3 py-2 rounded-lg border border-surface-border hover:bg-surface inline-flex items-center gap-1.5">
            <Activity size={14} /> Vedi sessioni
          </button>
          {showSessions && (
            <div className="mt-3 rounded-xl border border-surface-border overflow-hidden">
              {sessions === null ? (
                <div className="p-4 text-sm text-anthracite-lighter flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Caricamento…</div>
              ) : sessions.length === 0 ? (
                <div className="p-4 text-sm text-anthracite-lighter">Nessuna sessione.</div>
              ) : (
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs min-w-[420px]">
                    <thead className="bg-surface text-anthracite-lighter sticky top-0">
                      <tr><th className="px-3 py-2 text-left font-medium">Data</th><th className="px-3 py-2 text-left font-medium">Cliente</th><th className="px-3 py-2 text-left font-medium">Professionista</th></tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => (
                        <tr key={s.id} className="border-t border-surface-border">
                          <td className="px-3 py-2 whitespace-nowrap">{s.measured_at ? formatDate(s.measured_at) : '—'}</td>
                          <td className="px-3 py-2">{s.client_name}</td>
                          <td className="px-3 py-2">{s.professional_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Eliminazione */}
        <section className="rounded-xl border border-red-200 bg-red-50/40 p-4">
          <h4 className="text-sm font-medium text-red-600 mb-1.5">Zona pericolosa</h4>
          <p className="text-xs text-anthracite-lighter mb-3">L&apos;eliminazione rimuove l&apos;account auth e il profilo. {user.role === 'professional' && 'Spunta la casella per cancellare anche tutti i suoi clienti e le relative misurazioni.'}</p>
          {user.role === 'professional' && (
            <label className="flex items-center gap-2 text-xs text-anthracite mb-3">
              <input type="checkbox" checked={cascade} onChange={(e) => setCascade(e.target.checked)} />
              Cancella anche i {user.clients_count} clienti e i loro dati (irreversibile)
            </label>
          )}
          <button type="button" onClick={() => setConfirm('delete')} className="text-sm px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white inline-flex items-center gap-1.5">
            <Trash2 size={14} /> Elimina utente
          </button>
        </section>
      </div>

      {/* Conferme */}
      <ConfirmDialog
        open={confirm === 'role'}
        onClose={() => setConfirm(null)}
        onConfirm={changeRole}
        title="Cambiare ruolo?"
        description={`L'utente diventerà ${user.role === 'professional' ? 'un cliente' : 'un professionista'}. Verifica che non perda accesso ai suoi dati.`}
        confirmText="Cambia ruolo"
        destructive
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={deleteUser}
        title="Eliminare definitivamente?"
        description={`Stai per eliminare ${user.full_name}.${cascade ? ' Verranno cancellati anche tutti i suoi clienti e le misurazioni.' : ''} Operazione irreversibile.`}
        confirmText="Elimina"
        destructive
        requireTypedConfirmation={user.email ?? 'ELIMINA'}
      />
      <Modal open={confirm === 'setpw'} onClose={() => setConfirm(null)} title="Imposta nuova password" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirm(null)} className="btn-secondary text-sm py-2">Annulla</button>
            <button type="button" onClick={setPassword} disabled={newPassword.length < 8 || busy === 'setpw'} className="text-sm px-5 py-2 rounded-xl bg-teal hover:bg-teal-dark text-white font-medium disabled:opacity-50">
              {busy === 'setpw' ? 'Attendere…' : 'Imposta'}
            </button>
          </div>
        }
      >
        <label className="input-label">Nuova password (min 8 caratteri)</label>
        <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-field" placeholder="••••••••" />
        <p className="text-xs text-anthracite-lighter mt-2">La password verrà impostata immediatamente. Comunicala all&apos;utente su un canale sicuro.</p>
      </Modal>
    </Modal>
  )
}

// ── TAB CLIENTI ─────────────────────────────────────────────────────────────

function ClientsTab({ clients, professionals, onChanged, showToast }: { clients: AdminClientRow[]; professionals: Array<{ id: string; name: string; email: string | null }>; onChanged: () => void; showToast: (t: Toast) => void }) {
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [moveClient, setMoveClient] = useState<AdminClientRow | null>(null)

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return clients.filter((c) => !s || `${c.full_name} ${c.email ?? ''} ${c.professional_name ?? ''}`.toLowerCase().includes(s))
  }, [clients, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-anthracite-lighter" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca cliente o professionista…" className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal" />
        </div>
        <button type="button" onClick={() => setShowNew(true)} className="btn-primary text-sm py-2.5 px-4"><Plus size={16} /> Nuovo cliente</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-anthracite-lighter border-b border-surface-border bg-surface">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-3 py-3 font-medium">Professionista</th>
                <th className="px-3 py-3 font-medium">Accesso</th>
                <th className="px-3 py-3 font-medium text-right">Misurazioni</th>
                <th className="px-3 py-3 font-medium">Creato</th>
                <th className="px-4 py-3 font-medium text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-surface-border hover:bg-surface/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-anthracite">{c.full_name}</div>
                    <div className="text-xs text-anthracite-lighter">{c.email ?? '—'}</div>
                  </td>
                  <td className="px-3 py-3">
                    {c.professional_name ?? <span className="inline-flex items-center gap-1 text-amber-600 text-xs"><AlertTriangle size={12} /> Nessuno</span>}
                  </td>
                  <td className="px-3 py-3">{c.has_access ? <StatusPill status="Attivo" /> : c.link_status ? <StatusPill status={c.link_status} /> : <span className="text-anthracite-lighter text-xs">No login</span>}</td>
                  <td className="px-3 py-3 text-right text-anthracite">{c.measurements_count}</td>
                  <td className="px-3 py-3 text-anthracite-lighter whitespace-nowrap">{c.created_at ? formatDate(c.created_at) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setMoveClient(c)} className="inline-flex items-center gap-1 text-teal-dark hover:underline text-sm font-medium">
                      <ArrowRightLeft size={14} /> Sposta
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-anthracite-lighter">Nessun cliente.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && <NewClientModal professionals={professionals} onClose={() => setShowNew(false)} onChanged={() => { onChanged(); setShowNew(false) }} showToast={showToast} />}
      {moveClient && <MoveClientModal client={moveClient} professionals={professionals} onClose={() => setMoveClient(null)} onChanged={() => { onChanged(); setMoveClient(null) }} showToast={showToast} />}
    </div>
  )
}

function NewClientModal({ professionals, onClose, onChanged, showToast }: { professionals: Array<{ id: string; name: string; email: string | null }>; onClose: () => void; onChanged: () => void; showToast: (t: Toast) => void }) {
  const [form, setForm] = useState({ professional_id: '', nome: '', cognome: '', email: '', telefono: '', data_nascita: '', sesso: '', createAccess: false, password: '' })
  const [busy, setBusy] = useState(false)
  const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal'

  async function submit() {
    if (!form.professional_id) { showToast({ kind: 'err', text: 'Seleziona un professionista' }); return }
    if (!form.nome && !form.cognome) { showToast({ kind: 'err', text: 'Inserisci almeno nome o cognome' }); return }
    setBusy(true)
    const { ok, json } = await api('POST', '/api/admin/clients', form)
    setBusy(false)
    if (ok) {
      showToast({ kind: 'ok', text: json?.accessError ? `Cliente creato (accesso non creato: ${json.accessError})` : 'Cliente creato' })
      onChanged()
    } else showToast({ kind: 'err', text: json?.error ?? 'Errore creazione' })
  }

  return (
    <Modal open onClose={onClose} title="Nuovo cliente" description="Crea un cliente e associalo a un professionista." size="lg"
      footer={<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-secondary text-sm py-2">Annulla</button><button type="button" onClick={submit} disabled={busy} className="text-sm px-5 py-2 rounded-xl bg-teal hover:bg-teal-dark text-white font-medium disabled:opacity-50">{busy ? 'Creazione…' : 'Crea cliente'}</button></div>}
    >
      <div className="space-y-3">
        <div>
          <label className="input-label">Professionista *</label>
          <select className={inputCls} value={form.professional_id} onChange={(e) => setForm({ ...form, professional_id: e.target.value })}>
            <option value="">Seleziona…</option>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}{p.email ? ` (${p.email})` : ''}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="input-label">Nome</label><input className={inputCls} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><label className="input-label">Cognome</label><input className={inputCls} value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
          <div><label className="input-label">Email</label><input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="input-label">Telefono</label><input className={inputCls} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
          <div><label className="input-label">Data di nascita</label><input className={inputCls} type="date" value={form.data_nascita} onChange={(e) => setForm({ ...form, data_nascita: e.target.value })} /></div>
          <div><label className="input-label">Sesso</label><select className={inputCls} value={form.sesso} onChange={(e) => setForm({ ...form, sesso: e.target.value })}><option value="">—</option><option value="M">M</option><option value="F">F</option><option value="X">X</option></select></div>
        </div>
        <div className="rounded-xl border border-surface-border p-3">
          <label className="flex items-center gap-2 text-sm text-anthracite">
            <input type="checkbox" checked={form.createAccess} onChange={(e) => setForm({ ...form, createAccess: e.target.checked })} />
            Crea anche l&apos;accesso app del cliente (richiede email)
          </label>
          {form.createAccess && (
            <div className="mt-3"><label className="input-label">Password iniziale (opzionale, min 8)</label><input className={inputCls} type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Generata se vuota" /></div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function MoveClientModal({ client, professionals, onClose, onChanged, showToast }: { client: AdminClientRow; professionals: Array<{ id: string; name: string; email: string | null }>; onClose: () => void; onChanged: () => void; showToast: (t: Toast) => void }) {
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal'

  async function submit() {
    if (!target) return
    setBusy(true)
    // Crea/aggiorna il collegamento al nuovo professionista + cambia proprietario.
    const { ok, json } = await api('POST', '/api/admin/links', { client_id: client.id, professional_id: target, status: 'active' })
    if (ok) {
      // aggiorna anche clients.professionista_id via PATCH sul link appena creato
      const linkId = json?.id
      if (linkId) await api('PATCH', `/api/admin/links/${linkId}`, { professional_id: target })
      showToast({ kind: 'ok', text: 'Cliente spostato' }); onChanged()
    } else showToast({ kind: 'err', text: json?.error ?? 'Errore' })
    setBusy(false)
  }

  return (
    <Modal open onClose={onClose} title={`Sposta ${client.full_name}`} description={`Attuale: ${client.professional_name ?? 'nessun professionista'}`} size="sm"
      footer={<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-secondary text-sm py-2">Annulla</button><button type="button" onClick={submit} disabled={!target || busy} className="text-sm px-5 py-2 rounded-xl bg-teal hover:bg-teal-dark text-white font-medium disabled:opacity-50">{busy ? 'Spostamento…' : 'Sposta'}</button></div>}
    >
      <label className="input-label">Nuovo professionista</label>
      <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">Seleziona…</option>
        {professionals.filter((p) => p.id !== client.professionista_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </Modal>
  )
}

// ── TAB COLLEGAMENTI ──────────────────────────────────────────────────────────

function LinksTab({ links, professionals, onChanged, showToast }: { links: AdminLink[]; professionals: Array<{ id: string; name: string; email: string | null }>; onChanged: () => void; showToast: (t: Toast) => void }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'revoked'>('all')
  const [moveLink, setMoveLink] = useState<AdminLink | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AdminLink | null>(null)

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return links.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      if (s && !`${l.client_name} ${l.professional_name} ${l.client_user_email ?? ''}`.toLowerCase().includes(s)) return false
      return true
    })
  }, [links, search, statusFilter])

  async function setStatus(l: AdminLink, status: string) {
    const { ok, json } = await api('PATCH', `/api/admin/links/${l.id}`, { status })
    if (ok) { showToast({ kind: 'ok', text: `Collegamento ${status === 'active' ? 'riattivato' : 'revocato'}` }); onChanged() }
    else showToast({ kind: 'err', text: json?.error ?? 'Errore' })
  }

  async function remove(l: AdminLink) {
    const { ok, json } = await api('DELETE', `/api/admin/links/${l.id}`)
    setConfirmDelete(null)
    if (ok) { showToast({ kind: 'ok', text: 'Collegamento eliminato' }); onChanged() }
    else showToast({ kind: 'err', text: json?.error ?? 'Errore' })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-anthracite-lighter" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca cliente o professionista…" className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="px-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30">
          <option value="all">Tutti gli stati</option><option value="active">Attivi</option><option value="pending">In attesa</option><option value="revoked">Revocati</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-left text-anthracite-lighter border-b border-surface-border bg-surface">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-3 py-3 font-medium">Professionista</th>
                <th className="px-3 py-3 font-medium">Accesso utente</th>
                <th className="px-3 py-3 font-medium">Stato</th>
                <th className="px-3 py-3 font-medium">Creato</th>
                <th className="px-4 py-3 font-medium text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t border-surface-border hover:bg-surface/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-anthracite">{l.client_name}</td>
                  <td className="px-3 py-3 text-anthracite">{l.professional_name}</td>
                  <td className="px-3 py-3 text-anthracite-lighter text-xs">{l.client_user_email ?? '—'}</td>
                  <td className="px-3 py-3"><StatusPill status={l.status} /></td>
                  <td className="px-3 py-3 text-anthracite-lighter whitespace-nowrap">{l.created_at ? formatDate(l.created_at) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {l.status === 'active' ? (
                        <button type="button" onClick={() => setStatus(l, 'revoked')} title="Revoca" className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center"><Ban size={15} /></button>
                      ) : (
                        <button type="button" onClick={() => setStatus(l, 'active')} title="Riattiva" className="w-8 h-8 rounded-lg hover:bg-green-50 text-green-600 flex items-center justify-center"><CheckCircle2 size={15} /></button>
                      )}
                      <button type="button" onClick={() => setMoveLink(l)} title="Sposta professionista" className="w-8 h-8 rounded-lg hover:bg-surface text-anthracite-lighter flex items-center justify-center"><ArrowRightLeft size={15} /></button>
                      <button type="button" onClick={() => setConfirmDelete(l)} title="Elimina" className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-anthracite-lighter">Nessun collegamento.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {moveLink && (
        <Modal open onClose={() => setMoveLink(null)} title="Ricollega a un altro professionista" description={`Cliente: ${moveLink.client_name}`} size="sm"
          footer={null}
        >
          <LinkMoveBody link={moveLink} professionals={professionals} onClose={() => setMoveLink(null)} onChanged={() => { onChanged(); setMoveLink(null) }} showToast={showToast} />
        </Modal>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) return remove(confirmDelete) }}
        title="Eliminare il collegamento?"
        description="Il cliente perderà questo collegamento al professionista. Operazione non reversibile."
        confirmText="Elimina"
        destructive
      />
    </div>
  )
}

function LinkMoveBody({ link, professionals, onClose, onChanged, showToast }: { link: AdminLink; professionals: Array<{ id: string; name: string; email: string | null }>; onClose: () => void; onChanged: () => void; showToast: (t: Toast) => void }) {
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal'
  async function submit() {
    if (!target) return
    setBusy(true)
    const { ok, json } = await api('PATCH', `/api/admin/links/${link.id}`, { professional_id: target })
    setBusy(false)
    if (ok) { showToast({ kind: 'ok', text: 'Cliente ricollegato' }); onChanged() }
    else showToast({ kind: 'err', text: json?.error ?? 'Errore' })
  }
  return (
    <div>
      <label className="input-label">Nuovo professionista</label>
      <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">Seleziona…</option>
        {professionals.filter((p) => p.id !== link.professional_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={onClose} className="btn-secondary text-sm py-2">Annulla</button>
        <button type="button" onClick={submit} disabled={!target || busy} className="text-sm px-5 py-2 rounded-xl bg-teal hover:bg-teal-dark text-white font-medium disabled:opacity-50">{busy ? 'Attendere…' : 'Ricollega'}</button>
      </div>
    </div>
  )
}
