'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Users, UserCog, Link2, Search, Loader2, AlertTriangle, Plus,
  ArrowRightLeft, RefreshCw, CheckCircle2, Ban, SunMoon, HeartPulse, Merge, LayoutDashboard, Trash2,
} from 'lucide-react'
import { MonitoringTable } from '@/components/monitoring/MonitoringTable'
import type { AdminMonitoringRow } from '@/lib/admin-monitoring'
import type { MonitoringSession } from '@/lib/monitoring-types'
import { isSleepSession } from '@/lib/monitoring-types'
import { Modal } from '@/components/dashboard/Modal'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { formatDate } from '@/lib/format'
import type { AdminUser, AdminClientRow, AdminLink } from '@/lib/admin-data'
import { clientLinkStatusLabel } from '@/lib/admin-issues'
import { api, type Toast } from './adminApi'
import { ManualLinkModal } from './ManualLinkModal'
import { MergeClientsModal } from './MergeClientsModal'
import { SaluteTab } from './SaluteTab'
import { UsersTab } from './UsersTab'
import { OverviewTab, overviewCounts } from './OverviewTab'
import type { Catalogo } from './commerciale-ui'
import type { AccountStato } from '@/lib/admin-commerciale'

// ============================================================================
// Pannello Super Admin — panoramica commerciale, utenti (stato, abbonamento,
// moduli), clienti, collegamenti, monitoraggi e salute dei collegamenti.
// Tutte le azioni privilegiate passano dalle route /api/admin/* (service_role,
// verifica superadmin lato server). Questo componente è solo presentazione + fetch.
// ============================================================================

type Tab = 'overview' | 'users' | 'clients' | 'links' | 'monitoring' | 'salute'

type ProfessionalOption = { id: string; name: string; email: string | null }

// Messaggio d'errore leggibile da una risposta API: `message` (testo per
// l'utente) batte `error` (codice).
function apiError(json: { message?: string; error?: string } | null | undefined, fallback: string): string {
  return json?.message ?? json?.error ?? fallback
}

export function AdminPanel({ serviceRoleConfigured }: { serviceRoleConfigured: boolean }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [usersFilter, setUsersFilter] = useState<{ key: number; scadenza30?: boolean; stato?: AccountStato }>({ key: 0 })
  const [clients, setClients] = useState<AdminClientRow[]>([])
  const [links, setLinks] = useState<AdminLink[]>([])
  const [monitoring, setMonitoring] = useState<AdminMonitoringRow[]>([])
  const [saluteCount, setSaluteCount] = useState(0)
  const [saluteAlert, setSaluteAlert] = useState(false)
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

  // silent: aggiorna i dati senza sostituire la tab con lo spinner (il pannello
  // laterale resta aperto dopo un'azione)
  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setLoadError(null)
    const [u, c, l, m, s] = await Promise.all([
      api('GET', '/api/admin/users'),
      api('GET', '/api/admin/clients'),
      api('GET', '/api/admin/links'),
      api('GET', '/api/admin/monitoring'),
      api('GET', '/api/admin/collegamenti'),
    ])
    setSaluteCount(s.json?.total ?? 0)
    setSaluteAlert(!!s.json?.alert)
    if (!u.ok) setLoadError(u.json?.error ?? 'Errore caricamento utenti')
    setUsers(u.json?.users ?? [])
    setCatalogo(u.json?.catalogo ?? null)
    setClients(c.json?.clients ?? [])
    setLinks(l.json?.links ?? [])
    setMonitoring(m.json?.sessions ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (serviceRoleConfigured) reload()
    else setLoading(false)
  }, [serviceRoleConfigured, reload])

  const silentReload = useCallback(() => reload({ silent: true }), [reload])
  const counts = useMemo(() => overviewCounts(users), [users])

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

  const TABS: Array<{ key: Tab; label: string; icon: typeof Users; count: number | null; alert?: boolean }> = [
    { key: 'overview', label: 'Panoramica', icon: LayoutDashboard, count: catalogo ? counts.scadenza30 : null, alert: counts.scadenza30 > 0 },
    { key: 'users', label: 'Utenti', icon: Users, count: users.length },
    { key: 'clients', label: 'Clienti', icon: UserCog, count: clients.length },
    { key: 'links', label: 'Collegamenti', icon: Link2, count: links.length },
    { key: 'monitoring', label: 'Monitoraggi', icon: SunMoon, count: monitoring.length },
    { key: 'salute', label: 'Salute collegamenti', icon: HeartPulse, count: saluteCount, alert: saluteAlert },
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
                {t.count !== null && (
                  <span
                    title={t.key === 'overview' ? 'Abbonamenti in scadenza entro 30 giorni' : undefined}
                    className={`text-[11px] px-1.5 py-0.5 rounded-md ${
                      t.alert ? (t.key === 'overview' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700') : active ? 'bg-teal-light text-teal-dark' : 'bg-white/60 text-anthracite-lighter'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => reload()}
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
      ) : tab === 'overview' ? (
        <OverviewTab
          users={users}
          catalogo={catalogo}
          onChanged={silentReload}
          showToast={showToast}
          onOpenUsers={(filter) => { setUsersFilter((prev) => ({ key: prev.key + 1, ...filter })); setTab('users') }}
        />
      ) : tab === 'users' ? (
        <UsersTab
          key={usersFilter.key}
          users={users}
          catalogo={catalogo}
          professionals={professionals}
          onChanged={silentReload}
          showToast={showToast}
          initialFilter={usersFilter}
        />
      ) : tab === 'clients' ? (
        <ClientsTab clients={clients} professionals={professionals} onChanged={reload} showToast={showToast} />
      ) : tab === 'monitoring' ? (
        <MonitoringAdminTab sessions={monitoring} />
      ) : tab === 'salute' ? (
        <SaluteTab clients={clients} onChanged={reload} showToast={showToast} />
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

// Pill di stato: `tone` esplicito, altrimenti dedotto dal testo.
function StatusPill({ status, tone }: { status: string; tone?: 'green' | 'red' | 'amber' | 'neutral' }) {
  const s = status.toLowerCase()
  const t =
    tone ??
    (s === 'active' || s.includes('attiv')
      ? 'green'
      : s === 'pending' || s.includes('attesa')
        ? 'amber'
        : s === 'revoked' || s.includes('scadut') || s.includes('revoc') || s.includes('nessun')
          ? 'red'
          : 'neutral')
  const cls = { green: 'bg-green-50 text-green-600', red: 'bg-red-50 text-red-500', amber: 'bg-amber-50 text-amber-600', neutral: 'bg-surface text-anthracite-lighter' }[t]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>{status}</span>
}

// Stato di un collegamento (tab Collegamenti / Clienti) in italiano.
function LinkStatusPill({ status }: { status: string }) {
  const label = status === 'active' ? 'Attivo' : status === 'pending' ? 'In attesa' : status === 'revoked' ? 'Revocato' : status
  return <StatusPill status={label} tone={status === 'active' ? 'green' : status === 'pending' ? 'amber' : status === 'revoked' ? 'red' : 'neutral'} />
}

// ── TAB CLIENTI ─────────────────────────────────────────────────────────────

function ClientsTab({ clients, professionals, onChanged, showToast }: { clients: AdminClientRow[]; professionals: ProfessionalOption[]; onChanged: () => void; showToast: (t: Toast) => void }) {
  const [search, setSearch] = useState('')
  const [accessFilter, setAccessFilter] = useState<'all' | 'active' | 'pending' | 'revoked' | 'none'>('all')
  const [showNew, setShowNew] = useState(false)
  const [moveClient, setMoveClient] = useState<AdminClientRow | null>(null)
  const [linkClient, setLinkClient] = useState<AdminClientRow | null>(null)
  const [mergeClient, setMergeClient] = useState<AdminClientRow | null>(null)

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return clients.filter((c) => {
      if (s && !`${c.full_name} ${c.email ?? ''} ${c.professional_name ?? ''}`.toLowerCase().includes(s)) return false
      if (accessFilter === 'none') return !c.link_status
      if (accessFilter !== 'all') return c.link_status === accessFilter
      return true
    })
  }, [clients, search, accessFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-anthracite-lighter" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca cliente o professionista…" className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal" />
        </div>
        <select value={accessFilter} onChange={(e) => setAccessFilter(e.target.value as typeof accessFilter)} className="px-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30">
          <option value="all">Tutti gli accessi</option>
          <option value="active">Collegamento attivo</option>
          <option value="pending">Invito in attesa</option>
          <option value="revoked">Collegamento revocato</option>
          <option value="none">Senza account app</option>
        </select>
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
                <th className="px-3 py-3 font-medium text-right">Monitoraggi</th>
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
                  <td className="px-3 py-3">
                    {c.link_status ? (
                      <StatusPill status={clientLinkStatusLabel(c.link_status)} />
                    ) : (
                      <span className="text-anthracite-lighter text-xs" title="Nessun collegamento a un account: cliente seguito senza app, oppure account non ancora collegato">Senza account app</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-anthracite">{c.measurements_count}</td>
                  <td className="px-3 py-3 text-right text-anthracite">{c.monitoring_count}</td>
                  <td className="px-3 py-3 text-anthracite-lighter whitespace-nowrap">{c.created_at ? formatDate(c.created_at) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-3">
                      {!c.has_access && c.email && (
                        <button type="button" onClick={() => setLinkClient(c)} title="Collega l'account app del cliente (per email) a questo professionista" className="inline-flex items-center gap-1 text-teal-dark hover:underline text-sm font-medium whitespace-nowrap">
                          <Link2 size={14} /> Collega
                        </button>
                      )}
                      <button type="button" onClick={() => setMoveClient(c)} className="inline-flex items-center gap-1 text-teal-dark hover:underline text-sm font-medium">
                        <ArrowRightLeft size={14} /> Sposta
                      </button>
                      {c.professionista_id && (
                        <button type="button" onClick={() => setMergeClient(c)} title="Unisci con un'altra scheda dello stesso professionista" className="inline-flex items-center gap-1 text-teal-dark hover:underline text-sm font-medium">
                          <Merge size={14} /> Unisci
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-anthracite-lighter">Nessun cliente.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && <NewClientModal professionals={professionals} onClose={() => setShowNew(false)} onChanged={() => { onChanged(); setShowNew(false) }} showToast={showToast} />}
      {moveClient && <MoveClientModal client={moveClient} professionals={professionals} onClose={() => setMoveClient(null)} onChanged={() => { onChanged(); setMoveClient(null) }} showToast={showToast} />}
      {mergeClient && (
        <MergeClientsModal
          clients={clients.filter((c) => c.professionista_id === mergeClient.professionista_id)}
          onClose={() => setMergeClient(null)}
          onChanged={onChanged}
          showToast={showToast}
        />
      )}
      {linkClient && (
        <ManualLinkModal
          professionals={professionals}
          initialEmail={linkClient.email ?? ''}
          initialProfessionalId={linkClient.professionista_id ?? ''}
          onClose={() => setLinkClient(null)}
          onChanged={onChanged}
          showToast={showToast}
        />
      )}
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
      const text = json?.accessError
        ? `Scheda creata, ma accesso non creato: ${json.accessError}`
        : json?.warning
          ? `Scheda creata, ma collegamento non creato: ${json.warning}`
          : json?.account_created
            ? 'Cliente creato con account e collegamento attivo'
            : json?.linked
              ? 'Scheda creata e collegata all’account già registrato'
              : 'Scheda cliente creata (senza account app)'
      showToast({ kind: 'ok', text })
      onChanged()
    } else showToast({ kind: 'err', text: apiError(json, 'Errore creazione') })
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

function MoveClientModal({ client, professionals, onClose, onChanged, showToast }: { client: AdminClientRow; professionals: ProfessionalOption[]; onClose: () => void; onChanged: () => void; showToast: (t: Toast) => void }) {
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal'

  async function submit() {
    if (!target) return
    setBusy(true)
    // Un'unica route server-side sposta scheda CRM + collegamento dell'account.
    const { ok, json } = await api('POST', `/api/admin/clients/${client.id}/move`, { professional_id: target })
    setBusy(false)
    if (ok) { showToast({ kind: 'ok', text: json?.link_id ? 'Cliente e collegamento spostati' : 'Scheda cliente spostata' }); onChanged() }
    else showToast({ kind: 'err', text: apiError(json, 'Errore spostamento') })
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
      <p className="text-xs text-anthracite-lighter mt-3">
        Vengono spostati sia la scheda (con misurazioni e note) sia il collegamento dell&apos;account app, che mantiene lo stato attuale
        {client.link_status ? ` (${clientLinkStatusLabel(client.link_status).toLowerCase()})` : ''}.
        Se il nuovo professionista ha già una scheda per questo cliente, lo spostamento viene bloccato.
      </p>
    </Modal>
  )
}

// ── TAB COLLEGAMENTI ──────────────────────────────────────────────────────────

function LinksTab({ links, professionals, onChanged, showToast }: { links: AdminLink[]; professionals: ProfessionalOption[]; onChanged: () => void; showToast: (t: Toast) => void }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'revoked'>('all')
  const [showManual, setShowManual] = useState(false)
  const [moveLink, setMoveLink] = useState<AdminLink | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AdminLink | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return links.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      if (s && !`${l.client_name} ${l.professional_name} ${l.client_user_email ?? ''} ${l.client_email ?? ''}`.toLowerCase().includes(s)) return false
      return true
    })
  }, [links, search, statusFilter])

  async function setStatus(l: AdminLink, status: 'active' | 'revoked') {
    setBusyId(l.id)
    const { ok, json } = await api('PATCH', `/api/admin/links/${l.id}`, { status })
    setBusyId(null)
    if (ok) {
      const verb = status === 'revoked' ? 'revocato' : l.status === 'pending' ? 'attivato: invito accettato' : 'riattivato'
      showToast({ kind: 'ok', text: `Collegamento ${verb}` })
      onChanged()
    } else showToast({ kind: 'err', text: apiError(json, 'Errore') })
  }

  async function remove(l: AdminLink) {
    const { ok, json } = await api('DELETE', `/api/admin/links/${l.id}`)
    setConfirmDelete(null)
    if (ok) { showToast({ kind: 'ok', text: 'Collegamento eliminato' }); onChanged() }
    else showToast({ kind: 'err', text: apiError(json, 'Errore') })
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
        <button type="button" onClick={() => setShowManual(true)} className="btn-primary text-sm py-2.5 px-4"><Plus size={16} /> Nuovo collegamento</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left text-anthracite-lighter border-b border-surface-border bg-surface">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-3 py-3 font-medium">Professionista</th>
                <th className="px-3 py-3 font-medium">Account app</th>
                <th className="px-3 py-3 font-medium">Scheda CRM</th>
                <th className="px-3 py-3 font-medium">Stato</th>
                <th className="px-3 py-3 font-medium">Creato</th>
                <th className="px-4 py-3 font-medium text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t border-surface-border hover:bg-surface/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-anthracite">{l.client_name}</div>
                    {l.client_email && l.client_email !== l.client_user_email && <div className="text-xs text-anthracite-lighter">{l.client_email}</div>}
                  </td>
                  <td className="px-3 py-3 text-anthracite">{l.professional_name}</td>
                  <td className="px-3 py-3 text-anthracite-lighter text-xs">{l.client_user_email ?? <span title="Il collegamento non è associato a nessun account">—</span>}</td>
                  <td className="px-3 py-3 text-xs">
                    {l.crm_client_id ? (
                      <span className="text-green-600 inline-flex items-center gap-1"><CheckCircle2 size={12} /> Presente</span>
                    ) : (
                      <span className="text-anthracite-lighter" title={l.status === 'active' ? 'Nessuna scheda trovata per questo professionista: il cliente non compare nella sua dashboard' : 'La scheda viene creata o agganciata automaticamente quando il collegamento diventa attivo'}>Assente</span>
                    )}
                  </td>
                  <td className="px-3 py-3"><LinkStatusPill status={l.status} /></td>
                  <td className="px-3 py-3 text-anthracite-lighter whitespace-nowrap">{l.created_at ? formatDate(l.created_at) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {busyId === l.id ? (
                        <Loader2 size={15} className="animate-spin text-anthracite-lighter mx-2" />
                      ) : l.status === 'active' ? (
                        <button type="button" onClick={() => setStatus(l, 'revoked')} title="Revoca" className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center"><Ban size={15} /></button>
                      ) : l.status === 'pending' ? (
                        <button type="button" onClick={() => setStatus(l, 'active')} title="Attiva (accetta l'invito al posto del professionista)" className="inline-flex items-center gap-1 h-8 px-2 rounded-lg hover:bg-green-50 text-green-600 text-xs font-medium"><CheckCircle2 size={15} /> Attiva</button>
                      ) : (
                        <button type="button" onClick={() => setStatus(l, 'active')} title="Riattiva" className="inline-flex items-center gap-1 h-8 px-2 rounded-lg hover:bg-green-50 text-green-600 text-xs font-medium"><CheckCircle2 size={15} /> Riattiva</button>
                      )}
                      <button type="button" onClick={() => setMoveLink(l)} title="Sposta a un altro professionista" className="w-8 h-8 rounded-lg hover:bg-surface text-anthracite-lighter flex items-center justify-center"><ArrowRightLeft size={15} /></button>
                      <button type="button" onClick={() => setConfirmDelete(l)} title="Elimina" className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-anthracite-lighter">Nessun collegamento.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showManual && (
        <ManualLinkModal
          professionals={professionals}
          onClose={() => setShowManual(false)}
          onChanged={onChanged}
          showToast={showToast}
        />
      )}

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

function LinkMoveBody({ link, professionals, onClose, onChanged, showToast }: { link: AdminLink; professionals: ProfessionalOption[]; onClose: () => void; onChanged: () => void; showToast: (t: Toast) => void }) {
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal'
  async function submit() {
    if (!target) return
    setBusy(true)
    const { ok, json } = await api('PATCH', `/api/admin/links/${link.id}`, { professional_id: target })
    setBusy(false)
    if (ok) { showToast({ kind: 'ok', text: 'Cliente e scheda spostati al nuovo professionista' }); onChanged() }
    else showToast({ kind: 'err', text: apiError(json, 'Errore spostamento') })
  }
  return (
    <div>
      <label className="input-label">Nuovo professionista</label>
      <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">Seleziona…</option>
        {professionals.filter((p) => p.id !== link.professional_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <p className="text-xs text-anthracite-lighter mt-3">
        Il collegamento mantiene lo stato attuale; la scheda CRM {link.crm_client_id ? 'viene spostata con lui' : 'viene creata sotto il nuovo professionista'}.
      </p>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={onClose} className="btn-secondary text-sm py-2">Annulla</button>
        <button type="button" onClick={submit} disabled={!target || busy} className="text-sm px-5 py-2 rounded-xl bg-teal hover:bg-teal-dark text-white font-medium disabled:opacity-50">{busy ? 'Attendere…' : 'Ricollega'}</button>
      </div>
    </div>
  )
}

// ── TAB MONITORAGGI ──────────────────────────────────────────────────────────
// Tutti i monitoraggi (24h e sonno) di tutti gli utenti, letti con la
// service_role. Il dettaglio si apre nella vista superadmin in sola lettura
// del professionista titolare (?professionista=).

function adminMonitoringHref(s: MonitoringSession): string {
  const owner = s.professionista_id ?? s.user_id
  return `/area-professionisti/monitoraggio/${s.id}?professionista=${owner}`
}

function MonitoringAdminTab({ sessions }: { sessions: AdminMonitoringRow[] }) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'all' | '24h' | 'sleep'>('all')
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sessions.filter((s) => {
      if (type === 'sleep' && !isSleepSession(s)) return false
      if (type === '24h' && isSleepSession(s)) return false
      if (q && !`${s.client_name ?? ''} ${s.professional_name ?? ''} ${s.user_email ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [sessions, search, type])
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-anthracite-lighter" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca cliente, professionista o email…" className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="px-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30">
          <option value="all">Tutti i tipi</option>
          <option value="24h">24h</option>
          <option value="sleep">Sonno</option>
        </select>
        <div className="text-sm text-anthracite-lighter">{filtered.length} monitoraggi</div>
      </div>
      <div className="card overflow-hidden">
        <MonitoringTable sessions={filtered} showProfessional hrefFor={adminMonitoringHref} emptyText="Nessun monitoraggio." />
      </div>
    </div>
  )
}
