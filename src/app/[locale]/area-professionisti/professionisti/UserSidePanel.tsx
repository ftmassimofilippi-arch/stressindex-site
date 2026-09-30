'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import {
  Activity, ArrowRightLeft, CalendarPlus, History, KeyRound, Loader2, Mail, PencilLine, ShieldCheck, SunMoon, Trash2, X,
} from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { TypeChip } from '@/components/monitoring/MonitoringChips'
import { duration, periodLabel } from '@/lib/monitoring-format'
import { formatDate, formatDateTime, formatIstante, formatRelative } from '@/lib/format'
import type { AdminUser } from '@/lib/admin-data'
import type { AdminMonitoringRow } from '@/lib/admin-monitoring'
import type { AccountModulo, AccountStato, AuditRiga, StoricoAbbonamento } from '@/lib/admin-commerciale'
import { api, errorText, type Toast } from './adminApi'
import { EmailChangeDialog } from './EmailChangeDialog'
import {
  accountAction, fonteLabel, moduleIcon, moduloNome, PianoPill, pianoNome, ReasonDialog, ScadenzaCell, shortDate, statoLabel, StatoDot, type AdminTr, type Catalogo,
} from './commerciale-ui'

// ============================================================================
// Dettaglio utente in un pannello laterale (sostituisce la modale).
// Sezioni: account (stato), abbonamento + storico, moduli (piano vs eccezione),
// anagrafica, email, ruolo, password, sessioni, monitoraggi, attività, zona
// pericolosa. Ogni azione passa dalle route /api/admin/* (service_role).
// ============================================================================

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="px-6 py-5 border-b border-surface-border">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-anthracite-lighter">{title}</h4>
        {right}
      </div>
      {children}
    </section>
  )
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5 text-[13px]">
      <div className="w-32 flex-shrink-0 text-anthracite-lighter pt-0.5 break-words">{label}</div>
      <div className="flex-1 min-w-0 text-anthracite">{children}</div>
    </div>
  )
}

// Riassunto di una riga di audit; le etichette degli eventi stanno in admin.sidePanel.
function auditSummary(a: AuditRiga, t: AdminTr): string {
  const d = a.details ?? {}
  const s = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const attivo = (v: unknown) => t(v ? 'sidePanel.auditActive' : 'sidePanel.auditInactive')
  switch (a.action) {
    case 'account_status_change': return `${s(d.prima)} → ${s(d.dopo)}`
    case 'subscription_extend': return t('sidePanel.auditExtend', { months: s(d.mesi), before: s(d.scadenza_prima), after: s(d.scadenza_dopo) })
    case 'subscription_auto_renew': return `${s(d.scadenza_prima)} → ${s(d.scadenza_dopo)}`
    case 'module_exception_change': return t('sidePanel.auditModule', { module: s(d.modulo), before: attivo(d.accesso_prima), after: attivo(d.accesso_dopo) })
    case 'change_account_email': return `${s(d.prima)} → ${s(d.dopo)}`
    case 'subscription_change': {
      const dopo = (d.dopo ?? {}) as Record<string, unknown>
      return dopo.data_scadenza
        ? t('sidePanel.auditSubscriptionExpiry', { event: s(d.evento), plan: s(dopo.piano), date: s(dopo.data_scadenza) })
        : t('sidePanel.auditSubscription', { event: s(d.evento), plan: s(dopo.piano) })
    }
    default: return ''
  }
}

export function UserSidePanel({
  user,
  catalogo,
  onClose,
  onChanged,
  showToast,
}: {
  user: AdminUser
  catalogo: Catalogo | null
  onClose: () => void
  onChanged: () => void
  showToast: (t: Toast) => void
}) {
  const t = useTranslations('admin')
  const ts = useTranslations('admin.sidePanel')
  const tc = useTranslations('common')
  const tErr = useTranslations('errors.api')
  const locale = useLocale()
  const c = user.commerciale
  const [history, setHistory] = useState<{ storico: StoricoAbbonamento[]; audit: AuditRiga[] } | null>(null)
  const [statusDialog, setStatusDialog] = useState<AccountStato | null>(null)
  const [moduleDialog, setModuleDialog] = useState<{ m: AccountModulo; abilitato: boolean | null } | null>(null)
  const [sub, setSub] = useState({
    piano: c?.piano ?? 'base',
    data_inizio: c?.data_inizio ?? '',
    data_scadenza: c?.data_scadenza ?? '',
    rinnovo_automatico: c?.rinnovo_automatico ?? false,
    note: c?.abbonamento_note ?? '',
  })
  const [subDialog, setSubDialog] = useState(false)
  const [form, setForm] = useState({ nome: user.nome ?? '', cognome: user.cognome ?? '', data_nascita: user.data_nascita ?? '', sesso: user.sesso ?? '' })
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | 'delete' | 'role' | 'setpw'>(null)
  const [newPassword, setNewPassword] = useState('')
  const [cascade, setCascade] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [sessions, setSessions] = useState<Array<{ id: string; measured_at: string | null; client_name: string; professional_name: string }> | null>(null)
  const [monitoring, setMonitoring] = useState<AdminMonitoringRow[] | null>(null)

  useEffect(() => {
    setSub({
      piano: user.commerciale?.piano ?? 'base',
      data_inizio: user.commerciale?.data_inizio ?? '',
      data_scadenza: user.commerciale?.data_scadenza ?? '',
      rinnovo_automatico: user.commerciale?.rinnovo_automatico ?? false,
      note: user.commerciale?.abbonamento_note ?? '',
    })
  }, [user.commerciale])

  const loadHistory = useCallback(async () => {
    if (!user.commerciale) return
    const { ok, json } = await api('GET', `/api/admin/users/${user.id}/account`)
    setHistory(ok ? { storico: json?.storico ?? [], audit: json?.audit ?? [] } : { storico: [], audit: [] })
  }, [user.id, user.commerciale])

  useEffect(() => { loadHistory() }, [loadHistory])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !statusDialog && !moduleDialog && !subDialog && !confirm && !emailOpen) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, statusDialog, moduleDialog, subDialog, confirm, emailOpen])

  async function afterAction(ok: boolean) {
    if (!ok) return
    onChanged()
    await loadHistory()
  }

  const failed = t('commerciale.actionFailed')

  async function extend(mesi: number) {
    setBusy(`extend${mesi}`)
    const ok = await accountAction(user.id, { action: 'extend', mesi, motivo: t('users.extendReason', { months: mesi }) }, showToast, ts('subscriptionExtended'), tErr, failed)
    setBusy(null)
    await afterAction(ok)
  }

  async function saveAnagrafica() {
    setBusy('save')
    const { ok, json } = await api('PATCH', `/api/admin/users/${user.id}`, { nome: form.nome, cognome: form.cognome, data_nascita: form.data_nascita || null, sesso: form.sesso })
    setBusy(null)
    if (ok) { showToast({ kind: 'ok', text: ts('dataUpdated') }); onChanged() }
    else showToast({ kind: 'err', text: errorText(json, tErr, ts('saveError')) })
  }

  async function changeRole() {
    const next = user.role === 'professional' ? 'client' : 'professional'
    setBusy('role')
    const { ok, json } = await api('PATCH', `/api/admin/users/${user.id}`, { role: next })
    setBusy(null); setConfirm(null)
    if (ok) { showToast({ kind: 'ok', text: ts('roleChanged', { role: t(`role.${next}`) }) }); onChanged() }
    else showToast({ kind: 'err', text: errorText(json, tErr) })
  }

  async function resetPassword() {
    setBusy('reset')
    const { ok, json } = await api('POST', `/api/admin/users/${user.id}/password`, { action: 'reset' })
    setBusy(null)
    if (ok) showToast({ kind: 'ok', text: ts('resetSent', { email: json?.email ?? user.email ?? '' }) })
    else showToast({ kind: 'err', text: errorText(json, tErr, ts('resetError')) })
  }

  async function setPassword() {
    setBusy('setpw')
    const { ok, json } = await api('POST', `/api/admin/users/${user.id}/password`, { action: 'set', password: newPassword })
    setBusy(null); setConfirm(null)
    if (ok) { showToast({ kind: 'ok', text: ts('passwordUpdated') }); setNewPassword('') }
    else showToast({ kind: 'err', text: errorText(json, tErr) })
  }

  async function loadSessions() {
    if (sessions) return
    const { ok, json } = await api('GET', `/api/admin/users/${user.id}/sessions`)
    setSessions(ok ? json?.sessions ?? [] : [])
  }

  async function loadMonitoring() {
    if (monitoring) return
    const { ok, json } = await api('GET', `/api/admin/users/${user.id}/monitoring`)
    setMonitoring(ok ? json?.sessions ?? [] : [])
  }

  async function deleteUser() {
    setBusy('delete')
    const { ok, json } = await api('DELETE', `/api/admin/users/${user.id}${cascade ? '?cascadeClients=true' : ''}`)
    setBusy(null); setConfirm(null)
    if (ok) { showToast({ kind: 'ok', text: ts('userDeleted') }); onChanged(); onClose() }
    else showToast({ kind: 'err', text: errorText(json, tErr, ts('deleteError')) })
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-[13px] bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal'
  const ghostBtn = 'text-[13px] px-2.5 py-1.5 rounded-lg border border-surface-border hover:bg-surface inline-flex items-center gap-1.5 disabled:opacity-50'
  const subDirty = !!c && (sub.piano !== (c.piano ?? 'base') || sub.data_inizio !== (c.data_inizio ?? '') || sub.data_scadenza !== (c.data_scadenza ?? '') || sub.rinnovo_automatico !== c.rinnovo_automatico || sub.note !== (c.abbonamento_note ?? ''))
  const roleLabel = user.role === 'professional' || user.role === 'client' ? t(`role.${user.role}`) : t('role.none')

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-anthracite/20" onClick={onClose} aria-hidden />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white border-l border-surface-border shadow-elevated flex flex-col">
        {/* Intestazione */}
        <div className="px-6 pt-5 pb-4 border-b border-surface-border flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-anthracite truncate">{user.full_name}</h3>
              {user.is_superadmin && <ShieldCheck size={15} className="text-teal-dark flex-shrink-0" aria-label={t('users.superadmin')} />}
            </div>
            <div className="text-[13px] text-anthracite-lighter truncate">{user.email ?? '—'}</div>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {c && <StatoDot stato={c.stato} />}
              {c?.piano && <PianoPill piano={c.piano} catalogo={catalogo} />}
              <span className="text-[12px] text-anthracite-lighter">{roleLabel}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center text-anthracite-lighter flex-shrink-0" aria-label={ts('close')}><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!c && (
            <div className="px-6 py-4 text-[13px] text-amber-700 bg-amber-50 border-b border-amber-100">
              {ts('migration024')}
            </div>
          )}

          {/* Account */}
          {c && (
            <Section title={ts('account')}>
              <Prop label={ts('state')}><StatoDot stato={c.stato} /></Prop>
              {c.stato_motivo && <Prop label={ts('reason')}><span className="text-anthracite">{c.stato_motivo}</span></Prop>}
              {c.stato_cambiato_il && (
                <Prop label={ts('lastChange')}>
                  <span className="text-anthracite-lighter">{formatDateTime(c.stato_cambiato_il, locale)}{c.stato_cambiato_da ? ` · ${c.stato_cambiato_da}` : ''}</span>
                </Prop>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {(c.stato === 'sospeso' || c.stato === 'bloccato') && (
                  <button type="button" disabled={user.is_superadmin} onClick={() => setStatusDialog('attivo')} className={ghostBtn}>{ts('reactivate')}</button>
                )}
                {c.stato !== 'sospeso' && (
                  <button type="button" disabled={user.is_superadmin} onClick={() => setStatusDialog('sospeso')} className={ghostBtn}>{ts('suspend')}</button>
                )}
                {c.stato !== 'bloccato' && (
                  <button type="button" disabled={user.is_superadmin} onClick={() => setStatusDialog('bloccato')} className={`${ghostBtn} text-red-600 border-red-200 hover:bg-red-50`}>{ts('block')}</button>
                )}
              </div>
              <p className="mt-2 text-[12px] text-anthracite-lighter">{ts('statusHelp')}</p>
            </Section>
          )}

          {/* Abbonamento */}
          {c && user.role === 'professional' && (
            <Section
              title={ts('subscription')}
              right={
                <div className="flex gap-1 flex-wrap">
                  {[1, 3, 12].map((m) => (
                    <button key={m} type="button" disabled={!c.piano || !!busy} onClick={() => extend(m)} className="text-[12px] px-2 py-1 rounded-md border border-surface-border hover:bg-surface inline-flex items-center gap-1 disabled:opacity-40 whitespace-nowrap">
                      {busy === `extend${m}` ? <Loader2 size={11} className="animate-spin" /> : <CalendarPlus size={11} />}{t('users.extendMonths', { months: m })}
                    </button>
                  ))}
                </div>
              }
            >
              <Prop label={ts('expiry')}><ScadenzaCell c={c} /></Prop>
              <Prop label={ts('plan')}>
                <select className={inputCls} value={sub.piano} onChange={(e) => setSub({ ...sub, piano: e.target.value })}>
                  {(catalogo?.piani ?? []).map((p) => <option key={p.codice} value={p.codice}>{pianoNome(catalogo, p.codice, t)}</option>)}
                </select>
              </Prop>
              <Prop label={ts('startDate')}><input type="date" className={inputCls} value={sub.data_inizio} onChange={(e) => setSub({ ...sub, data_inizio: e.target.value })} /></Prop>
              <Prop label={ts('expiryDate')}>
                <input type="date" className={inputCls} value={sub.data_scadenza} onChange={(e) => setSub({ ...sub, data_scadenza: e.target.value })} />
                <span className="text-[11px] text-anthracite-lighter">{ts('expiryHelp')}</span>
              </Prop>
              <Prop label={ts('autoRenew')}>
                <label className="inline-flex items-start gap-2">
                  <input type="checkbox" className="mt-0.5" checked={sub.rinnovo_automatico} onChange={(e) => setSub({ ...sub, rinnovo_automatico: e.target.checked })} />
                  <span className="text-anthracite-lighter text-[12px]">{ts('autoRenewHelp')}</span>
                </label>
              </Prop>
              <Prop label={ts('notes')}><textarea rows={2} className={inputCls} value={sub.note} onChange={(e) => setSub({ ...sub, note: e.target.value })} /></Prop>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <button type="button" disabled={!subDirty} onClick={() => setSubDialog(true)} className="btn-primary text-[13px] py-1.5 px-3 disabled:opacity-40">{ts('saveSubscription')}</button>
                {subDirty && <button type="button" onClick={() => setSub({ piano: c.piano ?? 'base', data_inizio: c.data_inizio ?? '', data_scadenza: c.data_scadenza ?? '', rinnovo_automatico: c.rinnovo_automatico, note: c.abbonamento_note ?? '' })} className="text-[13px] text-anthracite-lighter hover:underline">{ts('discardChanges')}</button>}
              </div>

              <div className="mt-4">
                <div className="text-[12px] text-anthracite-lighter mb-1.5 inline-flex items-center gap-1"><History size={12} /> {ts('history')}</div>
                {history === null ? (
                  <div className="text-[12px] text-anthracite-lighter inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> {t('loading')}</div>
                ) : history.storico.length === 0 ? (
                  <div className="text-[12px] text-anthracite-lighter">{ts('noEvents')}</div>
                ) : (
                  <ul className="space-y-1">
                    {history.storico.map((s) => (
                      <li key={s.id} className="text-[12px] flex gap-2">
                        <span className="text-anthracite-lighter w-28 flex-shrink-0">{shortDate(s.eseguito_il, locale, true)}</span>
                        <span className="text-anthracite min-w-0 break-words">
                          {t.has(`sidePanel.events.${s.evento}`) ? ts(`events.${s.evento}`) : s.evento}
                          {s.evento === 'cambio_piano' && ` ${pianoNome(catalogo, s.piano_prima, t)} → ${pianoNome(catalogo, s.piano_dopo, t)}`}
                          {s.scadenza_dopo && s.scadenza_dopo !== s.scadenza_prima && ` · ${s.scadenza_prima ? ts('historyExpiryChange', { before: shortDate(s.scadenza_prima, locale), after: shortDate(s.scadenza_dopo, locale) }) : ts('historyExpiry', { date: shortDate(s.scadenza_dopo, locale) })}`}
                          {s.note && <span className="text-anthracite-lighter"> · {s.note}</span>}
                          <span className="text-anthracite-lighter"> · {s.eseguito_da_email ?? '—'}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Section>
          )}

          {/* Moduli */}
          {c && catalogo && (
            <Section title={ts('modules')}>
              <div className="space-y-1">
                {catalogo.moduli.map((mod) => {
                  const m = c.moduli.find((x) => x.codice === mod.codice)
                  if (!m) return null
                  const Icon = moduleIcon(catalogo, mod.codice)
                  const locked = m.fonte === 'stato' || m.fonte === 'superadmin' || m.fonte === 'modulo_disattivato'
                  const hasExc = m.eccezione_abilitata !== null
                  return (
                    <div key={mod.codice} className="flex items-center gap-3 py-1.5">
                      <span className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${m.attivo ? (m.fonte === 'eccezione' ? 'text-amber-700 bg-amber-50 border border-dashed border-amber-400' : 'text-teal-dark bg-teal-50') : 'text-anthracite-lighter bg-surface'}`}>
                        <Icon size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-anthracite">{moduloNome(catalogo, mod.codice, t)} <span className={`ml-1 text-[11px] ${m.attivo ? 'text-emerald-600' : 'text-anthracite-lighter'}`}>{m.attivo ? ts('moduleActive') : ts('moduleInactive')}</span></div>
                        <div className="text-[12px] text-anthracite-lighter truncate" title={m.eccezione_motivo ?? undefined}>
                          {fonteLabel(m, c.piano, catalogo, t, locale)}{m.eccezione_motivo ? ` · ${m.eccezione_motivo}` : ''}
                        </div>
                      </div>
                      {!locked && (
                        <div className="flex gap-1 flex-shrink-0">
                          {hasExc && (
                            <button type="button" onClick={() => setModuleDialog({ m, abilitato: null })} className="text-[12px] px-2 py-1 rounded-md hover:bg-surface text-anthracite-lighter whitespace-nowrap" title={ts('followPlanHint')}>{ts('followPlan')}</button>
                          )}
                          <button
                            type="button"
                            onClick={() => setModuleDialog({ m, abilitato: !m.attivo })}
                            className={`text-[12px] px-2 py-1 rounded-md border whitespace-nowrap ${m.attivo ? 'border-surface-border hover:bg-surface' : 'border-teal-200 text-teal-dark hover:bg-teal-50'}`}
                          >
                            {m.attivo ? ts('disable') : ts('enable')}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="mt-2 text-[12px] text-anthracite-lighter">{ts('modulesHelp')}</p>
            </Section>
          )}

          {/* Anagrafica + email */}
          <Section title={ts('personalData')}>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[12px] text-anthracite-lighter">{ts('firstName')}</label><input className={inputCls} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><label className="text-[12px] text-anthracite-lighter">{ts('lastName')}</label><input className={inputCls} value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
              <div><label className="text-[12px] text-anthracite-lighter">{ts('birthDate')}</label><input type="date" className={inputCls} value={form.data_nascita ? form.data_nascita.slice(0, 10) : ''} onChange={(e) => setForm({ ...form, data_nascita: e.target.value })} /></div>
              <div>
                <label className="text-[12px] text-anthracite-lighter">{ts('sex')}</label>
                <select className={inputCls} value={form.sesso} onChange={(e) => setForm({ ...form, sesso: e.target.value })}>
                  <option value="">—</option><option value="M">M</option><option value="F">F</option><option value="X">X</option>
                </select>
              </div>
            </div>
            <button type="button" onClick={saveAnagrafica} disabled={busy === 'save'} className="btn-primary text-[13px] py-1.5 px-3 mt-3">
              {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : ts('savePersonalData')}
            </button>
            <div className="mt-4 flex items-center gap-2 text-[13px] flex-wrap">
              <span className="text-anthracite-lighter w-32">{ts('accountEmail')}</span>
              <span className="flex-1 min-w-0 truncate text-anthracite">{user.email ?? '—'}</span>
              <button type="button" onClick={() => setEmailOpen(true)} className={ghostBtn}><PencilLine size={13} /> {ts('fixEmail')}</button>
            </div>
          </Section>

          {/* Accesso */}
          <Section title={ts('access')}>
            <Prop label={ts('registration')}>{user.created_at ? formatDate(user.created_at, undefined, locale) : '—'}</Prop>
            <Prop label={ts('lastSignIn')}>{user.last_sign_in_at ? formatRelative(user.last_sign_in_at, locale) : t('never')}</Prop>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={resetPassword} disabled={busy === 'reset'} className={ghostBtn}>{busy === 'reset' ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} {ts('resetEmail')}</button>
              <button type="button" onClick={() => setConfirm('setpw')} className={ghostBtn}><KeyRound size={13} /> {ts('setPassword')}</button>
              <button type="button" onClick={() => setConfirm('role')} className={ghostBtn}><ArrowRightLeft size={13} /> {user.role === 'professional' ? ts('makeClient') : ts('makeProfessional')}</button>
            </div>
          </Section>

          {/* Dati */}
          <Section title={ts('data')}>
            <Prop label={ts('measurements')}>{user.measurements_count}</Prop>
            <Prop label={ts('monitoring')}>{user.monitoring_count}</Prop>
            {user.role === 'professional' && <Prop label={ts('clients')}>{user.clients_count}</Prop>}
            <div className="mt-2 flex gap-2 flex-wrap">
              <button type="button" onClick={loadSessions} className={ghostBtn}><Activity size={13} /> {ts('viewSessions')}</button>
              <button type="button" onClick={loadMonitoring} className={ghostBtn}><SunMoon size={13} /> {ts('viewMonitoring')}</button>
            </div>
            {sessions && (
              <div className="mt-3 max-h-56 overflow-auto border border-surface-border rounded-lg">
                {sessions.length === 0 ? <div className="p-3 text-[12px] text-anthracite-lighter">{ts('noSessions')}</div> : (
                  <table className="w-full text-[12px]">
                    <tbody>
                      {sessions.map((s) => (
                        <tr key={s.id} className="border-b border-surface-border last:border-0">
                          <td className="px-2.5 py-1.5 whitespace-nowrap text-anthracite-lighter">{/* `measured_at` qui è già un istante: si formatta nel fuso italiano. */}
                            {formatIstante(s.measured_at, undefined, locale)}</td>
                          <td className="px-2.5 py-1.5">{s.client_name}</td>
                          <td className="px-2.5 py-1.5 text-anthracite-lighter">{s.professional_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            {monitoring && (
              <div className="mt-3 max-h-56 overflow-auto border border-surface-border rounded-lg">
                {monitoring.length === 0 ? <div className="p-3 text-[12px] text-anthracite-lighter">{ts('noMonitoring')}</div> : (
                  <table className="w-full text-[12px]">
                    <tbody>
                      {monitoring.map((m) => (
                        <tr key={m.id} className="border-b border-surface-border last:border-0">
                          <td className="px-2.5 py-1.5 whitespace-nowrap">{periodLabel(m.start_time, m.end_time, m.tz_offset_minutes)}</td>
                          <td className="px-2.5 py-1.5"><TypeChip type={m.monitoring_type} size="sm" /></td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap">{duration(m.duration_minutes)}</td>
                          <td className="px-2.5 py-1.5 text-right">
                            <Link href={`/area-professionisti/monitoraggio/${m.id}?professionista=${m.professionista_id ?? m.user_id}`} className="text-teal-dark hover:underline whitespace-nowrap">{ts('open')}</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </Section>

          {/* Attività */}
          {c && (
            <Section title={ts('activity')}>
              {history === null ? (
                <div className="text-[12px] text-anthracite-lighter">{t('loading')}</div>
              ) : history.audit.length === 0 ? (
                <div className="text-[12px] text-anthracite-lighter">{ts('noAudit')}</div>
              ) : (
                <ul className="space-y-1.5">
                  {history.audit.map((a) => (
                    <li key={a.id} className="text-[12px]">
                      <span className="text-anthracite-lighter">{shortDate(a.created_at, locale, true)} · {a.performed_by_email ?? '—'}</span>
                      <div className="text-anthracite break-words">
                        <b className="font-medium">{t.has(`sidePanel.audit.${a.action}`) ? ts(`audit.${a.action}`) : a.action}</b> {auditSummary(a, t)}
                        {typeof a.details?.motivo === 'string' && a.details.motivo && <span className="text-anthracite-lighter"> · {a.details.motivo}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {/* Zona pericolosa */}
          <section className="px-6 py-5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-red-500 mb-2">{ts('dangerZone')}</h4>
            <p className="text-[12px] text-anthracite-lighter mb-3">{ts('dangerHelp')}</p>
            {user.role === 'professional' && (
              <label className="flex items-start gap-2 text-[12px] text-anthracite mb-3">
                <input type="checkbox" className="mt-0.5" checked={cascade} onChange={(e) => setCascade(e.target.checked)} />
                {ts('cascade', { count: user.clients_count })}
              </label>
            )}
            <button type="button" onClick={() => setConfirm('delete')} className="text-[13px] px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white inline-flex items-center gap-1.5">
              <Trash2 size={13} /> {ts('deleteUser')}
            </button>
          </section>
        </div>
      </aside>

      {statusDialog && (
        <ReasonDialog
          title={statusDialog === 'attivo' ? t('users.reactivateTitle') : statusDialog === 'sospeso' ? t('users.suspendTitle') : t('users.blockTitle')}
          description={`${ts('statusTransition', { name: user.full_name, from: c ? statoLabel(c.stato, t) : '', to: statoLabel(statusDialog, t) })}${statusDialog === 'attivo' && c?.giorni_alla_scadenza !== null && (c?.giorni_alla_scadenza ?? 0) < 0 ? ts('statusExpiredWarning') : ''}`}
          confirmText={statusDialog === 'attivo' ? t('users.confirmReactivate') : statusDialog === 'sospeso' ? t('users.confirmSuspend') : t('users.confirmBlock')}
          destructive={statusDialog !== 'attivo'}
          onCancel={() => setStatusDialog(null)}
          onConfirm={async (motivo) => {
            const ok = await accountAction(user.id, { action: 'status', stato: statusDialog, motivo }, showToast, ts('statusToast', { status: statoLabel(statusDialog, t).toLowerCase() }), tErr, failed)
            setStatusDialog(null)
            await afterAction(ok)
          }}
        />
      )}
      {moduleDialog && catalogo && (
        <ReasonDialog
          title={
            moduleDialog.abilitato === null
              ? ts('removeExceptionTitle', { module: moduloNome(catalogo, moduleDialog.m.codice, t) })
              : ts(moduleDialog.abilitato ? 'enableTitle' : 'disableTitle', { module: moduloNome(catalogo, moduleDialog.m.codice, t) })
          }
          description={
            moduleDialog.abilitato === null
              ? ts('removeExceptionDescription', { included: ts(moduleDialog.m.incluso_nel_piano ? 'included' : 'notIncluded') })
              : moduleDialog.abilitato === moduleDialog.m.incluso_nel_piano
                ? ts('sameAsPlan')
                : ts(moduleDialog.abilitato ? 'exceptionPositive' : 'exceptionNegative', { plan: pianoNome(catalogo, c?.piano ?? null, t) })
          }
          confirmText={tc('confirm')}
          withDate={moduleDialog.abilitato !== null}
          dateLabel={ts('exceptionUntil')}
          onCancel={() => setModuleDialog(null)}
          onConfirm={async (motivo, data) => {
            const ok = await accountAction(
              user.id,
              { action: 'module', modulo: moduleDialog.m.codice, abilitato: moduleDialog.abilitato, motivo, scade_il: data },
              showToast,
              ts('moduleUpdated'),
              tErr,
              failed,
            )
            setModuleDialog(null)
            await afterAction(ok)
          }}
        />
      )}
      {subDialog && c && (
        <ReasonDialog
          title={ts('saveSubscriptionTitle')}
          description={ts('saveSubscriptionDescription', {
            from: pianoNome(catalogo, c.piano, t),
            to: pianoNome(catalogo, sub.piano, t),
            expiry: sub.data_scadenza ? ts('withExpiry', { date: shortDate(sub.data_scadenza, locale) }) : ts('withoutExpiry'),
            renew: sub.rinnovo_automatico ? ts('withAutoRenew') : '',
          })}
          confirmText={tc('save')}
          onCancel={() => setSubDialog(false)}
          onConfirm={async (motivo) => {
            const ok = await accountAction(
              user.id,
              { action: 'subscription', piano: sub.piano, data_inizio: sub.data_inizio || null, data_scadenza: sub.data_scadenza || null, rinnovo_automatico: sub.rinnovo_automatico, note: sub.note, motivo },
              showToast,
              ts('subscriptionSaved'),
              tErr,
              failed,
            )
            setSubDialog(false)
            await afterAction(ok)
          }}
        />
      )}
      {emailOpen && <EmailChangeDialog userId={user.id} currentEmail={user.email} onClose={() => setEmailOpen(false)} onChanged={onChanged} showToast={showToast} />}
      <ConfirmDialog
        open={confirm === 'role'}
        onClose={() => setConfirm(null)}
        onConfirm={changeRole}
        title={ts('changeRoleTitle')}
        description={user.role === 'professional' ? ts('changeRoleToClient') : ts('changeRoleToProfessional')}
        confirmText={ts('changeRole')}
        destructive
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={deleteUser}
        title={ts('deleteTitle')}
        description={ts('deleteDescription', { name: user.full_name, cascade: cascade ? ts('deleteCascadeNote') : '' })}
        confirmText={tc('delete')}
        destructive
        requireTypedConfirmation={user.email ?? ts('deleteTyped')}
      />
      <Modal open={confirm === 'setpw'} onClose={() => setConfirm(null)} title={ts('setPasswordTitle')} size="sm"
        footer={
          <div className="flex justify-end gap-2 flex-wrap">
            <button type="button" onClick={() => setConfirm(null)} className="btn-secondary text-sm py-2">{tc('cancel')}</button>
            <button type="button" onClick={setPassword} disabled={newPassword.length < 8 || busy === 'setpw'} className="text-sm px-5 py-2 rounded-xl bg-teal hover:bg-teal-dark text-white font-medium disabled:opacity-50">
              {busy === 'setpw' ? t('wait') : ts('set')}
            </button>
          </div>
        }
      >
        <label className="input-label">{ts('newPassword')}</label>
        <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-field" placeholder="••••••••" />
        <p className="text-xs text-anthracite-lighter mt-2">{ts('setPasswordHelp')}</p>
      </Modal>
    </div>
  )
}
