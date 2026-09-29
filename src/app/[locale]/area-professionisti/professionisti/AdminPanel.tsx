'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
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
import { clientLinkStatusKey, clientLinkStatusLabel } from '@/lib/admin-issues'
import { api, errorText, type Toast } from './adminApi'
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

export function AdminPanel({ serviceRoleConfigured }: { serviceRoleConfigured: boolean }) {
  const t = useTranslations('admin')
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
    if (!u.ok) setLoadError(u.json?.error ?? t('loadUsersError'))
    setUsers(u.json?.users ?? [])
    setCatalogo(u.json?.catalogo ?? null)
    setClients(c.json?.clients ?? [])
    setLinks(l.json?.links ?? [])
    setMonitoring(m.json?.sessions ?? [])
    setLoading(false)
  }, [t])

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
            <h3 className="font-medium text-anthracite">{t('serviceRole.title')}</h3>
            <p className="text-sm text-anthracite-lighter mt-1">
              {t.rich('serviceRole.body', {
                code: (c) => <code className="px-1 bg-surface rounded">{c}</code>,
                b: (c) => <b>{c}</b>,
              })}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const TABS: Array<{ key: Tab; label: string; icon: typeof Users; count: number | null; alert?: boolean }> = [
    { key: 'overview', label: t('tabs.overview'), icon: LayoutDashboard, count: catalogo ? counts.scadenza30 : null, alert: counts.scadenza30 > 0 },
    { key: 'users', label: t('tabs.users'), icon: Users, count: users.length },
    { key: 'clients', label: t('tabs.clients'), icon: UserCog, count: clients.length },
    { key: 'links', label: t('tabs.links'), icon: Link2, count: links.length },
    { key: 'monitoring', label: t('tabs.monitoring'), icon: SunMoon, count: monitoring.length },
    { key: 'salute', label: t('tabs.health'), icon: HeartPulse, count: saluteCount, alert: saluteAlert },
  ]

  return (
    <div>
      {/* Tabs + reload */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="inline-flex p-1 bg-surface rounded-xl border border-surface-border overflow-x-auto max-w-full">
          {TABS.map((tb) => {
            const Icon = tb.icon
            const active = tab === tb.key
            return (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active ? 'bg-white text-anthracite shadow-card' : 'text-anthracite-lighter hover:text-anthracite'
                }`}
              >
                <Icon size={15} className="flex-shrink-0" />
                {tb.label}
                {tb.count !== null && (
                  <span
                    title={tb.key === 'overview' ? t('tabs.expiringHint') : undefined}
                    className={`text-[11px] px-1.5 py-0.5 rounded-md ${
                      tb.alert ? (tb.key === 'overview' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700') : active ? 'bg-teal-light text-teal-dark' : 'bg-white/60 text-anthracite-lighter'
                    }`}
                  >
                    {tb.count}
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
          {t('refresh')}
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
          <Loader2 className="animate-spin mr-2" size={18} /> {t('loading')}
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100vw-2rem)] px-4 py-3 rounded-xl shadow-elevated text-sm font-medium flex items-center gap-2 bg-white border border-surface-border">
          {toast.kind === 'ok' ? <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" /> : <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />}
          <span className={toast.kind === 'ok' ? 'text-anthracite' : 'text-red-600'}>{toast.text}</span>
        </div>
      )}
    </div>
  )
}

// ── Badge ruolo/piano/stato ──────────────────────────────────────────────────

// Pill di stato: il tono si deduce dal codice dello stato del collegamento.
function StatusPill({ status, tone }: { status: string; tone: 'green' | 'red' | 'amber' | 'neutral' }) {
  const cls = { green: 'bg-green-50 text-green-600', red: 'bg-red-50 text-red-500', amber: 'bg-amber-50 text-amber-600', neutral: 'bg-surface text-anthracite-lighter' }[tone]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${cls}`}>{status}</span>
}

function linkTone(status: string | null | undefined): 'green' | 'red' | 'amber' | 'neutral' {
  return status === 'active' ? 'green' : status === 'pending' ? 'amber' : status === 'revoked' ? 'red' : 'neutral'
}

// Stato di un collegamento (tab Collegamenti / Clienti), tradotto.
function LinkStatusPill({ status }: { status: string }) {
  const t = useTranslations('admin')
  const label = status === 'active' || status === 'pending' || status === 'revoked' ? t(`linkStatus.${status}`) : status
  return <StatusPill status={label} tone={linkTone(status)} />
}

// ── TAB CLIENTI ─────────────────────────────────────────────────────────────

function ClientsTab({ clients, professionals, onChanged, showToast }: { clients: AdminClientRow[]; professionals: ProfessionalOption[]; onChanged: () => void; showToast: (t: Toast) => void }) {
  const t = useTranslations('admin')
  const locale = useLocale()
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
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('clients.search')} className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal" />
        </div>
        <select value={accessFilter} onChange={(e) => setAccessFilter(e.target.value as typeof accessFilter)} className="px-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 max-w-full">
          <option value="all">{t('clients.filterAll')}</option>
          <option value="active">{t('clients.filterActive')}</option>
          <option value="pending">{t('clients.filterPending')}</option>
          <option value="revoked">{t('clients.filterRevoked')}</option>
          <option value="none">{t('clients.filterNone')}</option>
        </select>
        <button type="button" onClick={() => setShowNew(true)} className="btn-primary text-sm py-2.5 px-4 whitespace-nowrap"><Plus size={16} /> {t('clients.new')}</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left text-anthracite-lighter border-b border-surface-border bg-surface">
                <th className="px-4 py-3 font-medium">{t('clients.thClient')}</th>
                <th className="px-3 py-3 font-medium">{t('clients.thProfessional')}</th>
                <th className="px-3 py-3 font-medium">{t('clients.thAccess')}</th>
                <th className="px-3 py-3 font-medium text-right">{t('clients.thMeasurements')}</th>
                <th className="px-3 py-3 font-medium text-right">{t('clients.thMonitoring')}</th>
                <th className="px-3 py-3 font-medium">{t('clients.thCreated')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('clients.thActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-surface-border hover:bg-surface/60 transition-colors">
                  <td className="px-4 py-3 max-w-[260px]">
                    <div className="font-medium text-anthracite truncate">{c.full_name}</div>
                    <div className="text-xs text-anthracite-lighter truncate">{c.email ?? '—'}</div>
                  </td>
                  <td className="px-3 py-3 max-w-[200px] truncate">
                    {c.professional_name ?? <span className="inline-flex items-center gap-1 text-amber-600 text-xs"><AlertTriangle size={12} /> {t('clients.noProfessional')}</span>}
                  </td>
                  <td className="px-3 py-3">
                    {c.link_status ? (
                      <StatusPill status={clientLinkStatusLabel(c.link_status, t)} tone={linkTone(c.link_status)} />
                    ) : (
                      <span className="text-anthracite-lighter text-xs" title={t('clients.noAppAccountHint')}>{t('clients.noAppAccount')}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-anthracite">{c.measurements_count}</td>
                  <td className="px-3 py-3 text-right text-anthracite">{c.monitoring_count}</td>
                  <td className="px-3 py-3 text-anthracite-lighter whitespace-nowrap">{c.created_at ? formatDate(c.created_at, undefined, locale) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-3 flex-wrap justify-end">
                      {!c.has_access && c.email && (
                        <button type="button" onClick={() => setLinkClient(c)} title={t('clients.linkHint')} className="inline-flex items-center gap-1 text-teal-dark hover:underline text-sm font-medium whitespace-nowrap">
                          <Link2 size={14} /> {t('clients.link')}
                        </button>
                      )}
                      <button type="button" onClick={() => setMoveClient(c)} className="inline-flex items-center gap-1 text-teal-dark hover:underline text-sm font-medium whitespace-nowrap">
                        <ArrowRightLeft size={14} /> {t('clients.move')}
                      </button>
                      {c.professionista_id && (
                        <button type="button" onClick={() => setMergeClient(c)} title={t('clients.mergeHint')} className="inline-flex items-center gap-1 text-teal-dark hover:underline text-sm font-medium whitespace-nowrap">
                          <Merge size={14} /> {t('clients.merge')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-anthracite-lighter">{t('clients.empty')}</td></tr>}
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
  const t = useTranslations('admin.newClient')
  const ta = useTranslations('admin')
  const tc = useTranslations('common')
  const tErr = useTranslations('errors.api')
  const [form, setForm] = useState({ professional_id: '', nome: '', cognome: '', email: '', telefono: '', data_nascita: '', sesso: '', createAccess: false, password: '' })
  const [busy, setBusy] = useState(false)
  const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal'

  async function submit() {
    if (!form.professional_id) { showToast({ kind: 'err', text: t('errProfessional') }); return }
    if (!form.nome && !form.cognome) { showToast({ kind: 'err', text: t('errName') }); return }
    setBusy(true)
    const { ok, json } = await api('POST', '/api/admin/clients', form)
    setBusy(false)
    if (ok) {
      const text = json?.accessError
        ? t('okAccessError', { error: json.accessError })
        : json?.warning
          ? t('okWarning', { warning: errorText({ code: json.warning, ...(json.warning_params ?? {}) }, tErr) })
          : json?.account_created
            ? t('okAccount')
            : json?.linked
              ? t('okLinked')
              : t('okNoAccount')
      showToast({ kind: 'ok', text })
      onChanged()
    } else showToast({ kind: 'err', text: errorText(json, tErr, t('errCreate')) })
  }

  return (
    <Modal open onClose={onClose} title={t('title')} description={t('description')} size="lg"
      footer={<div className="flex justify-end gap-2 flex-wrap"><button type="button" onClick={onClose} className="btn-secondary text-sm py-2">{tc('cancel')}</button><button type="button" onClick={submit} disabled={busy} className="text-sm px-5 py-2 rounded-xl bg-teal hover:bg-teal-dark text-white font-medium disabled:opacity-50">{busy ? t('creating') : t('create')}</button></div>}
    >
      <div className="space-y-3">
        <div>
          <label className="input-label">{t('professional')}</label>
          <select className={inputCls} value={form.professional_id} onChange={(e) => setForm({ ...form, professional_id: e.target.value })}>
            <option value="">{ta('select')}</option>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}{p.email ? ` (${p.email})` : ''}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="input-label">{t('firstName')}</label><input className={inputCls} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><label className="input-label">{t('lastName')}</label><input className={inputCls} value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
          <div><label className="input-label">{t('email')}</label><input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="input-label">{t('phone')}</label><input className={inputCls} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
          <div><label className="input-label">{t('birthDate')}</label><input className={inputCls} type="date" value={form.data_nascita} onChange={(e) => setForm({ ...form, data_nascita: e.target.value })} /></div>
          <div><label className="input-label">{t('sex')}</label><select className={inputCls} value={form.sesso} onChange={(e) => setForm({ ...form, sesso: e.target.value })}><option value="">—</option><option value="M">M</option><option value="F">F</option><option value="X">X</option></select></div>
        </div>
        <div className="rounded-xl border border-surface-border p-3">
          <label className="flex items-center gap-2 text-sm text-anthracite">
            <input type="checkbox" checked={form.createAccess} onChange={(e) => setForm({ ...form, createAccess: e.target.checked })} />
            {t('createAccess')}
          </label>
          {form.createAccess && (
            <div className="mt-3"><label className="input-label">{t('initialPassword')}</label><input className={inputCls} type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t('generatedIfEmpty')} /></div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function MoveClientModal({ client, professionals, onClose, onChanged, showToast }: { client: AdminClientRow; professionals: ProfessionalOption[]; onClose: () => void; onChanged: () => void; showToast: (t: Toast) => void }) {
  const t = useTranslations('admin.moveClient')
  const ta = useTranslations('admin')
  const tc = useTranslations('common')
  const tErr = useTranslations('errors.api')
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal'

  async function submit() {
    if (!target) return
    setBusy(true)
    // Un'unica route server-side sposta scheda CRM + collegamento dell'account.
    const { ok, json } = await api('POST', `/api/admin/clients/${client.id}/move`, { professional_id: target })
    setBusy(false)
    if (ok) { showToast({ kind: 'ok', text: json?.link_id ? t('okBoth') : t('okCard') }); onChanged() }
    else showToast({ kind: 'err', text: errorText(json, tErr, t('err')) })
  }

  return (
    <Modal open onClose={onClose} title={t('title', { name: client.full_name })} description={t('current', { name: client.professional_name ?? t('noProfessional') })} size="sm"
      footer={<div className="flex justify-end gap-2 flex-wrap"><button type="button" onClick={onClose} className="btn-secondary text-sm py-2">{tc('cancel')}</button><button type="button" onClick={submit} disabled={!target || busy} className="text-sm px-5 py-2 rounded-xl bg-teal hover:bg-teal-dark text-white font-medium disabled:opacity-50">{busy ? t('moving') : t('move')}</button></div>}
    >
      <label className="input-label">{t('newProfessional')}</label>
      <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">{ta('select')}</option>
        {professionals.filter((p) => p.id !== client.professionista_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <p className="text-xs text-anthracite-lighter mt-3">
        {t('note', { status: client.link_status ? ` (${ta(`clientLinkStatus.${clientLinkStatusKey(client.link_status)}`).toLowerCase()})` : '' })}
      </p>
    </Modal>
  )
}

// ── TAB COLLEGAMENTI ──────────────────────────────────────────────────────────

function LinksTab({ links, professionals, onChanged, showToast }: { links: AdminLink[]; professionals: ProfessionalOption[]; onChanged: () => void; showToast: (t: Toast) => void }) {
  const t = useTranslations('admin.links')
  const tErr = useTranslations('errors.api')
  const locale = useLocale()
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
      showToast({ kind: 'ok', text: status === 'revoked' ? t('toastRevoked') : l.status === 'pending' ? t('toastActivated') : t('toastReactivated') })
      onChanged()
    } else showToast({ kind: 'err', text: errorText(json, tErr) })
  }

  async function remove(l: AdminLink) {
    const { ok, json } = await api('DELETE', `/api/admin/links/${l.id}`)
    setConfirmDelete(null)
    if (ok) { showToast({ kind: 'ok', text: t('toastDeleted') }); onChanged() }
    else showToast({ kind: 'err', text: errorText(json, tErr) })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-anthracite-lighter" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="px-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 max-w-full">
          <option value="all">{t('filterAll')}</option><option value="active">{t('filterActive')}</option><option value="pending">{t('filterPending')}</option><option value="revoked">{t('filterRevoked')}</option>
        </select>
        <button type="button" onClick={() => setShowManual(true)} className="btn-primary text-sm py-2.5 px-4 whitespace-nowrap"><Plus size={16} /> {t('new')}</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-anthracite-lighter border-b border-surface-border bg-surface">
                <th className="px-4 py-3 font-medium">{t('thClient')}</th>
                <th className="px-3 py-3 font-medium">{t('thProfessional')}</th>
                <th className="px-3 py-3 font-medium">{t('thAccount')}</th>
                <th className="px-3 py-3 font-medium">{t('thCrm')}</th>
                <th className="px-3 py-3 font-medium">{t('thStatus')}</th>
                <th className="px-3 py-3 font-medium">{t('thCreated')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('thActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t border-surface-border hover:bg-surface/60 transition-colors">
                  <td className="px-4 py-3 max-w-[240px]">
                    <div className="font-medium text-anthracite truncate">{l.client_name}</div>
                    {l.client_email && l.client_email !== l.client_user_email && <div className="text-xs text-anthracite-lighter truncate">{l.client_email}</div>}
                  </td>
                  <td className="px-3 py-3 text-anthracite max-w-[200px] truncate">{l.professional_name}</td>
                  <td className="px-3 py-3 text-anthracite-lighter text-xs max-w-[200px] truncate">{l.client_user_email ?? <span title={t('noAccountHint')}>—</span>}</td>
                  <td className="px-3 py-3 text-xs">
                    {l.crm_client_id ? (
                      <span className="text-green-600 inline-flex items-center gap-1"><CheckCircle2 size={12} /> {t('crmPresent')}</span>
                    ) : (
                      <span className="text-anthracite-lighter" title={l.status === 'active' ? t('crmAbsentActiveHint') : t('crmAbsentHint')}>{t('crmAbsent')}</span>
                    )}
                  </td>
                  <td className="px-3 py-3"><LinkStatusPill status={l.status} /></td>
                  <td className="px-3 py-3 text-anthracite-lighter whitespace-nowrap">{l.created_at ? formatDate(l.created_at, undefined, locale) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {busyId === l.id ? (
                        <Loader2 size={15} className="animate-spin text-anthracite-lighter mx-2" />
                      ) : l.status === 'active' ? (
                        <button type="button" onClick={() => setStatus(l, 'revoked')} title={t('revoke')} className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center"><Ban size={15} /></button>
                      ) : l.status === 'pending' ? (
                        <button type="button" onClick={() => setStatus(l, 'active')} title={t('activateHint')} className="inline-flex items-center gap-1 h-8 px-2 rounded-lg hover:bg-green-50 text-green-600 text-xs font-medium whitespace-nowrap"><CheckCircle2 size={15} /> {t('activate')}</button>
                      ) : (
                        <button type="button" onClick={() => setStatus(l, 'active')} title={t('reactivate')} className="inline-flex items-center gap-1 h-8 px-2 rounded-lg hover:bg-green-50 text-green-600 text-xs font-medium whitespace-nowrap"><CheckCircle2 size={15} /> {t('reactivate')}</button>
                      )}
                      <button type="button" onClick={() => setMoveLink(l)} title={t('moveHint')} className="w-8 h-8 rounded-lg hover:bg-surface text-anthracite-lighter flex items-center justify-center"><ArrowRightLeft size={15} /></button>
                      <button type="button" onClick={() => setConfirmDelete(l)} title={t('delete')} className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-anthracite-lighter">{t('empty')}</td></tr>}
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
        <Modal open onClose={() => setMoveLink(null)} title={t('moveTitle')} description={t('moveClient', { name: moveLink.client_name })} size="sm"
          footer={null}
        >
          <LinkMoveBody link={moveLink} professionals={professionals} onClose={() => setMoveLink(null)} onChanged={() => { onChanged(); setMoveLink(null) }} showToast={showToast} />
        </Modal>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) return remove(confirmDelete) }}
        title={t('deleteTitle')}
        description={t('deleteDescription')}
        confirmText={t('delete')}
        destructive
      />
    </div>
  )
}

function LinkMoveBody({ link, professionals, onClose, onChanged, showToast }: { link: AdminLink; professionals: ProfessionalOption[]; onClose: () => void; onChanged: () => void; showToast: (t: Toast) => void }) {
  const t = useTranslations('admin.links')
  const ta = useTranslations('admin')
  const tc = useTranslations('common')
  const tErr = useTranslations('errors.api')
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal'
  async function submit() {
    if (!target) return
    setBusy(true)
    const { ok, json } = await api('PATCH', `/api/admin/links/${link.id}`, { professional_id: target })
    setBusy(false)
    if (ok) { showToast({ kind: 'ok', text: t('moveOk') }); onChanged() }
    else showToast({ kind: 'err', text: errorText(json, tErr, t('moveErr')) })
  }
  return (
    <div>
      <label className="input-label">{t('moveNewProfessional')}</label>
      <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">{ta('select')}</option>
        {professionals.filter((p) => p.id !== link.professional_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <p className="text-xs text-anthracite-lighter mt-3">
        {link.crm_client_id ? t('moveNoteMoved') : t('moveNoteCreated')}
      </p>
      <div className="flex justify-end gap-2 mt-4 flex-wrap">
        <button type="button" onClick={onClose} className="btn-secondary text-sm py-2">{tc('cancel')}</button>
        <button type="button" onClick={submit} disabled={!target || busy} className="text-sm px-5 py-2 rounded-xl bg-teal hover:bg-teal-dark text-white font-medium disabled:opacity-50">{busy ? ta('wait') : t('relink')}</button>
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
  const t = useTranslations('admin.monitoring')
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
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="px-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30">
          <option value="all">{t('typeAll')}</option>
          <option value="24h">{t('type24h')}</option>
          <option value="sleep">{t('typeSleep')}</option>
        </select>
        <div className="text-sm text-anthracite-lighter">{t('count', { count: filtered.length })}</div>
      </div>
      <div className="card overflow-hidden">
        <MonitoringTable sessions={filtered} showProfessional hrefFor={adminMonitoringHref} emptyText={t('empty')} />
      </div>
    </div>
  )
}
