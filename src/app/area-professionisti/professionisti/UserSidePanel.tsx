'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity, ArrowRightLeft, CalendarPlus, History, KeyRound, Loader2, Mail, PencilLine, ShieldCheck, SunMoon, Trash2, X,
} from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { TypeChip } from '@/components/monitoring/MonitoringChips'
import { duration, periodLabel } from '@/lib/monitoring-format'
import { formatDate, formatDateTime, formatRelative } from '@/lib/format'
import type { AdminUser } from '@/lib/admin-data'
import type { AdminMonitoringRow } from '@/lib/admin-monitoring'
import type { AccountModulo, AccountStato, AuditRiga, StoricoAbbonamento } from '@/lib/admin-commerciale'
import { api, type Toast } from './adminApi'
import { EmailChangeDialog } from './EmailChangeDialog'
import {
  accountAction, fonteLabel, moduleIcon, PianoPill, pianoNome, ReasonDialog, ScadenzaCell, STATO_LABEL, StatoDot, type Catalogo,
} from './commerciale-ui'

// ============================================================================
// Dettaglio utente in un pannello laterale (sostituisce la modale).
// Sezioni: account (stato), abbonamento + storico, moduli (piano vs eccezione),
// anagrafica, email, ruolo, password, sessioni, monitoraggi, attività, zona
// pericolosa. Ogni azione passa dalle route /api/admin/* (service_role).
// ============================================================================

const EVENTO_LABEL: Record<string, string> = {
  creazione: 'Creazione',
  modifica: 'Modifica',
  cambio_piano: 'Cambio piano',
  prolungamento: 'Prolungamento',
  rinnovo_automatico: 'Rinnovo automatico',
  scadenza: 'Scadenza',
}

const AUDIT_LABEL: Record<string, string> = {
  account_status_change: 'Stato account',
  subscription_change: 'Abbonamento',
  subscription_extend: 'Prolungamento',
  subscription_auto_renew: 'Rinnovo automatico',
  module_exception_change: 'Modulo',
  change_account_email: 'Email account',
  auth_ban: 'Login bloccato',
  auth_unban: 'Login riabilitato',
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="px-6 py-5 border-b border-surface-border">
      <div className="flex items-center justify-between mb-3">
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
      <div className="w-32 flex-shrink-0 text-anthracite-lighter pt-0.5">{label}</div>
      <div className="flex-1 min-w-0 text-anthracite">{children}</div>
    </div>
  )
}

function auditSummary(a: AuditRiga): string {
  const d = a.details ?? {}
  const s = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
  switch (a.action) {
    case 'account_status_change': return `${s(d.prima)} → ${s(d.dopo)}`
    case 'subscription_extend': return `+${s(d.mesi)} mesi: ${s(d.scadenza_prima)} → ${s(d.scadenza_dopo)}`
    case 'subscription_auto_renew': return `${s(d.scadenza_prima)} → ${s(d.scadenza_dopo)}`
    case 'module_exception_change': return `${s(d.modulo)}: ${d.accesso_prima ? 'attivo' : 'non attivo'} → ${d.accesso_dopo ? 'attivo' : 'non attivo'}`
    case 'change_account_email': return `${s(d.prima)} → ${s(d.dopo)}`
    case 'subscription_change': {
      const dopo = (d.dopo ?? {}) as Record<string, unknown>
      return `${s(d.evento)}: ${s(dopo.piano)}${dopo.data_scadenza ? `, scadenza ${s(dopo.data_scadenza)}` : ''}`
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

  async function extend(mesi: number) {
    setBusy(`extend${mesi}`)
    const ok = await accountAction(user.id, { action: 'extend', mesi, motivo: `Prolungamento rapido +${mesi === 12 ? '1 anno' : `${mesi} ${mesi === 1 ? 'mese' : 'mesi'}`}` }, showToast, 'Abbonamento prolungato')
    setBusy(null)
    await afterAction(ok)
  }

  async function saveAnagrafica() {
    setBusy('save')
    const { ok, json } = await api('PATCH', `/api/admin/users/${user.id}`, { nome: form.nome, cognome: form.cognome, data_nascita: form.data_nascita || null, sesso: form.sesso })
    setBusy(null)
    if (ok) { showToast({ kind: 'ok', text: 'Dati aggiornati' }); onChanged() }
    else showToast({ kind: 'err', text: json?.error ?? 'Errore salvataggio' })
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
    if (ok) { showToast({ kind: 'ok', text: 'Utente eliminato' }); onChanged(); onClose() }
    else showToast({ kind: 'err', text: json?.error === 'cannot_delete_self' ? 'Non puoi eliminare te stesso' : json?.error ?? 'Errore eliminazione' })
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-[13px] bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal'
  const ghostBtn = 'text-[13px] px-2.5 py-1.5 rounded-lg border border-surface-border hover:bg-surface inline-flex items-center gap-1.5 disabled:opacity-50'
  const subDirty = !!c && (sub.piano !== (c.piano ?? 'base') || sub.data_inizio !== (c.data_inizio ?? '') || sub.data_scadenza !== (c.data_scadenza ?? '') || sub.rinnovo_automatico !== c.rinnovo_automatico || sub.note !== (c.abbonamento_note ?? ''))

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-anthracite/20" onClick={onClose} aria-hidden />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white border-l border-surface-border shadow-elevated flex flex-col">
        {/* Intestazione */}
        <div className="px-6 pt-5 pb-4 border-b border-surface-border flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-anthracite truncate">{user.full_name}</h3>
              {user.is_superadmin && <ShieldCheck size={15} className="text-teal-dark" aria-label="Superadmin" />}
            </div>
            <div className="text-[13px] text-anthracite-lighter truncate">{user.email ?? '—'}</div>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {c && <StatoDot stato={c.stato} />}
              {c?.piano && <PianoPill piano={c.piano} catalogo={catalogo} />}
              <span className="text-[12px] text-anthracite-lighter">{user.role === 'professional' ? 'Professionista' : user.role === 'client' ? 'Cliente' : 'Senza ruolo'}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center text-anthracite-lighter" aria-label="Chiudi"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!c && (
            <div className="px-6 py-4 text-[13px] text-amber-700 bg-amber-50 border-b border-amber-100">
              Stato, abbonamento e moduli non disponibili: applica la migration 024.
            </div>
          )}

          {/* Account */}
          {c && (
            <Section title="Account">
              <Prop label="Stato"><StatoDot stato={c.stato} /></Prop>
              {c.stato_motivo && <Prop label="Motivo"><span className="text-anthracite">{c.stato_motivo}</span></Prop>}
              {c.stato_cambiato_il && (
                <Prop label="Ultimo cambio">
                  <span className="text-anthracite-lighter">{formatDateTime(c.stato_cambiato_il)}{c.stato_cambiato_da ? ` · ${c.stato_cambiato_da}` : ''}</span>
                </Prop>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {(c.stato === 'sospeso' || c.stato === 'bloccato') && (
                  <button type="button" disabled={user.is_superadmin} onClick={() => setStatusDialog('attivo')} className={ghostBtn}>Riattiva</button>
                )}
                {c.stato !== 'sospeso' && (
                  <button type="button" disabled={user.is_superadmin} onClick={() => setStatusDialog('sospeso')} className={ghostBtn}>Sospendi…</button>
                )}
                {c.stato !== 'bloccato' && (
                  <button type="button" disabled={user.is_superadmin} onClick={() => setStatusDialog('bloccato')} className={`${ghostBtn} text-red-600 border-red-200 hover:bg-red-50`}>Blocca…</button>
                )}
              </div>
              <p className="mt-2 text-[12px] text-anthracite-lighter">
                Sospeso: login consentito, schermata &quot;Account sospeso&quot;, niente clienti né misurazioni. Bloccato: login negato e sessione chiusa.
                La riattivazione ripristina tutto (nessun dato viene toccato).
              </p>
            </Section>
          )}

          {/* Abbonamento */}
          {c && user.role === 'professional' && (
            <Section
              title="Abbonamento"
              right={
                <div className="flex gap-1">
                  {[1, 3, 12].map((m) => (
                    <button key={m} type="button" disabled={!c.piano || !!busy} onClick={() => extend(m)} className="text-[12px] px-2 py-1 rounded-md border border-surface-border hover:bg-surface inline-flex items-center gap-1 disabled:opacity-40">
                      {busy === `extend${m}` ? <Loader2 size={11} className="animate-spin" /> : <CalendarPlus size={11} />}+{m === 12 ? '1 anno' : `${m} ${m === 1 ? 'mese' : 'mesi'}`}
                    </button>
                  ))}
                </div>
              }
            >
              <Prop label="Scadenza"><ScadenzaCell c={c} /></Prop>
              <Prop label="Piano">
                <select className={inputCls} value={sub.piano} onChange={(e) => setSub({ ...sub, piano: e.target.value })}>
                  {(catalogo?.piani ?? []).map((p) => <option key={p.codice} value={p.codice}>{p.nome}</option>)}
                </select>
              </Prop>
              <Prop label="Data inizio"><input type="date" className={inputCls} value={sub.data_inizio} onChange={(e) => setSub({ ...sub, data_inizio: e.target.value })} /></Prop>
              <Prop label="Data scadenza">
                <input type="date" className={inputCls} value={sub.data_scadenza} onChange={(e) => setSub({ ...sub, data_scadenza: e.target.value })} />
                <span className="text-[11px] text-anthracite-lighter">Vuota = senza scadenza. Ultimo giorno valido incluso.</span>
              </Prop>
              <Prop label="Rinnovo automatico">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={sub.rinnovo_automatico} onChange={(e) => setSub({ ...sub, rinnovo_automatico: e.target.checked })} />
                  <span className="text-anthracite-lighter text-[12px]">alla scadenza si rinnova per la stessa durata, invece di sospendere</span>
                </label>
              </Prop>
              <Prop label="Note"><textarea rows={2} className={inputCls} value={sub.note} onChange={(e) => setSub({ ...sub, note: e.target.value })} /></Prop>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" disabled={!subDirty} onClick={() => setSubDialog(true)} className="btn-primary text-[13px] py-1.5 px-3 disabled:opacity-40">Salva abbonamento…</button>
                {subDirty && <button type="button" onClick={() => setSub({ piano: c.piano ?? 'base', data_inizio: c.data_inizio ?? '', data_scadenza: c.data_scadenza ?? '', rinnovo_automatico: c.rinnovo_automatico, note: c.abbonamento_note ?? '' })} className="text-[13px] text-anthracite-lighter hover:underline">Annulla modifiche</button>}
              </div>

              <div className="mt-4">
                <div className="text-[12px] text-anthracite-lighter mb-1.5 inline-flex items-center gap-1"><History size={12} /> Storico</div>
                {history === null ? (
                  <div className="text-[12px] text-anthracite-lighter inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Caricamento…</div>
                ) : history.storico.length === 0 ? (
                  <div className="text-[12px] text-anthracite-lighter">Nessun evento.</div>
                ) : (
                  <ul className="space-y-1">
                    {history.storico.map((s) => (
                      <li key={s.id} className="text-[12px] flex gap-2">
                        <span className="text-anthracite-lighter w-24 flex-shrink-0">{formatDate(s.eseguito_il, 'dd/MM/yy HH:mm')}</span>
                        <span className="text-anthracite">
                          {EVENTO_LABEL[s.evento] ?? s.evento}
                          {s.evento === 'cambio_piano' && ` ${pianoNome(catalogo, s.piano_prima)} → ${pianoNome(catalogo, s.piano_dopo)}`}
                          {s.scadenza_dopo && s.scadenza_dopo !== s.scadenza_prima && ` · scadenza ${s.scadenza_prima ? `${formatDate(s.scadenza_prima, 'dd/MM/yy')} → ` : ''}${formatDate(s.scadenza_dopo, 'dd/MM/yy')}`}
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
            <Section title="Moduli">
              <div className="space-y-1">
                {catalogo.moduli.map((mod) => {
                  const m = c.moduli.find((x) => x.codice === mod.codice)
                  if (!m) return null
                  const Icon = moduleIcon(catalogo, mod.codice)
                  const locked = m.fonte === 'stato' || m.fonte === 'superadmin' || m.fonte === 'modulo_disattivato'
                  const hasExc = m.eccezione_abilitata !== null
                  return (
                    <div key={mod.codice} className="flex items-center gap-3 py-1.5">
                      <span className={`w-7 h-7 rounded-md flex items-center justify-center ${m.attivo ? (m.fonte === 'eccezione' ? 'text-amber-700 bg-amber-50 border border-dashed border-amber-400' : 'text-teal-dark bg-teal-50') : 'text-anthracite-lighter bg-surface'}`}>
                        <Icon size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-anthracite">{mod.nome} <span className={`ml-1 text-[11px] ${m.attivo ? 'text-emerald-600' : 'text-anthracite-lighter'}`}>{m.attivo ? 'attivo' : 'non attivo'}</span></div>
                        <div className="text-[12px] text-anthracite-lighter truncate" title={m.eccezione_motivo ?? undefined}>
                          {fonteLabel(m, c.piano, catalogo)}{m.eccezione_motivo ? ` · ${m.eccezione_motivo}` : ''}
                        </div>
                      </div>
                      {!locked && (
                        <div className="flex gap-1">
                          {hasExc && (
                            <button type="button" onClick={() => setModuleDialog({ m, abilitato: null })} className="text-[12px] px-2 py-1 rounded-md hover:bg-surface text-anthracite-lighter" title="Rimuovi l'eccezione: torna a valere il piano">Segui il piano</button>
                          )}
                          <button
                            type="button"
                            onClick={() => setModuleDialog({ m, abilitato: !m.attivo })}
                            className={`text-[12px] px-2 py-1 rounded-md border ${m.attivo ? 'border-surface-border hover:bg-surface' : 'border-teal-200 text-teal-dark hover:bg-teal-50'}`}
                          >
                            {m.attivo ? 'Disattiva' : 'Attiva'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="mt-2 text-[12px] text-anthracite-lighter">
                Icona piena = incluso nel piano. Bordo tratteggiato = eccezione per questo account. Clienti: coperti dal professionista collegato, salvo eccezione.
              </p>
            </Section>
          )}

          {/* Anagrafica + email */}
          <Section title="Anagrafica">
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[12px] text-anthracite-lighter">Nome</label><input className={inputCls} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><label className="text-[12px] text-anthracite-lighter">Cognome</label><input className={inputCls} value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
              <div><label className="text-[12px] text-anthracite-lighter">Data di nascita</label><input type="date" className={inputCls} value={form.data_nascita ? form.data_nascita.slice(0, 10) : ''} onChange={(e) => setForm({ ...form, data_nascita: e.target.value })} /></div>
              <div>
                <label className="text-[12px] text-anthracite-lighter">Sesso</label>
                <select className={inputCls} value={form.sesso} onChange={(e) => setForm({ ...form, sesso: e.target.value })}>
                  <option value="">—</option><option value="M">M</option><option value="F">F</option><option value="X">X</option>
                </select>
              </div>
            </div>
            <button type="button" onClick={saveAnagrafica} disabled={busy === 'save'} className="btn-primary text-[13px] py-1.5 px-3 mt-3">
              {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : 'Salva anagrafica'}
            </button>
            <div className="mt-4 flex items-center gap-2 text-[13px]">
              <span className="text-anthracite-lighter w-32">Email account</span>
              <span className="flex-1 truncate text-anthracite">{user.email ?? '—'}</span>
              <button type="button" onClick={() => setEmailOpen(true)} className={ghostBtn}><PencilLine size={13} /> Correggi</button>
            </div>
          </Section>

          {/* Accesso */}
          <Section title="Accesso">
            <Prop label="Registrazione">{user.created_at ? formatDate(user.created_at) : '—'}</Prop>
            <Prop label="Ultimo accesso">{user.last_sign_in_at ? formatRelative(user.last_sign_in_at) : 'Mai'}</Prop>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={resetPassword} disabled={busy === 'reset'} className={ghostBtn}>{busy === 'reset' ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} Email di reset</button>
              <button type="button" onClick={() => setConfirm('setpw')} className={ghostBtn}><KeyRound size={13} /> Imposta password</button>
              <button type="button" onClick={() => setConfirm('role')} className={ghostBtn}><ArrowRightLeft size={13} /> {user.role === 'professional' ? 'Rendi cliente' : 'Rendi professionista'}</button>
            </div>
          </Section>

          {/* Dati */}
          <Section title="Dati">
            <Prop label="Misurazioni">{user.measurements_count}</Prop>
            <Prop label="Monitoraggi">{user.monitoring_count}</Prop>
            {user.role === 'professional' && <Prop label="Clienti">{user.clients_count}</Prop>}
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={loadSessions} className={ghostBtn}><Activity size={13} /> Vedi sessioni</button>
              <button type="button" onClick={loadMonitoring} className={ghostBtn}><SunMoon size={13} /> Vedi monitoraggi</button>
            </div>
            {sessions && (
              <div className="mt-3 max-h-56 overflow-auto border border-surface-border rounded-lg">
                {sessions.length === 0 ? <div className="p-3 text-[12px] text-anthracite-lighter">Nessuna sessione.</div> : (
                  <table className="w-full text-[12px]">
                    <tbody>
                      {sessions.map((s) => (
                        <tr key={s.id} className="border-b border-surface-border last:border-0">
                          <td className="px-2.5 py-1.5 whitespace-nowrap text-anthracite-lighter">{s.measured_at ? formatDate(s.measured_at) : '—'}</td>
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
                {monitoring.length === 0 ? <div className="p-3 text-[12px] text-anthracite-lighter">Nessun monitoraggio.</div> : (
                  <table className="w-full text-[12px]">
                    <tbody>
                      {monitoring.map((m) => (
                        <tr key={m.id} className="border-b border-surface-border last:border-0">
                          <td className="px-2.5 py-1.5 whitespace-nowrap">{periodLabel(m.start_time, m.end_time, m.tz_offset_minutes)}</td>
                          <td className="px-2.5 py-1.5"><TypeChip type={m.monitoring_type} size="sm" /></td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap">{duration(m.duration_minutes)}</td>
                          <td className="px-2.5 py-1.5 text-right">
                            <Link href={`/area-professionisti/monitoraggio/${m.id}?professionista=${m.professionista_id ?? m.user_id}`} className="text-teal-dark hover:underline">Apri →</Link>
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
            <Section title="Attività">
              {history === null ? (
                <div className="text-[12px] text-anthracite-lighter">Caricamento…</div>
              ) : history.audit.length === 0 ? (
                <div className="text-[12px] text-anthracite-lighter">Nessuna modifica registrata.</div>
              ) : (
                <ul className="space-y-1.5">
                  {history.audit.map((a) => (
                    <li key={a.id} className="text-[12px]">
                      <span className="text-anthracite-lighter">{formatDate(a.created_at, 'dd/MM/yy HH:mm')} · {a.performed_by_email ?? '—'}</span>
                      <div className="text-anthracite">
                        <b className="font-medium">{AUDIT_LABEL[a.action] ?? a.action}</b> {auditSummary(a)}
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
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-red-500 mb-2">Zona pericolosa</h4>
            <p className="text-[12px] text-anthracite-lighter mb-3">L&apos;eliminazione rimuove l&apos;account auth e il profilo. Per fermare un account senza perdere dati usa Sospendi o Blocca.</p>
            {user.role === 'professional' && (
              <label className="flex items-center gap-2 text-[12px] text-anthracite mb-3">
                <input type="checkbox" checked={cascade} onChange={(e) => setCascade(e.target.checked)} />
                Cancella anche i {user.clients_count} clienti e i loro dati (irreversibile)
              </label>
            )}
            <button type="button" onClick={() => setConfirm('delete')} className="text-[13px] px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white inline-flex items-center gap-1.5">
              <Trash2 size={13} /> Elimina utente
            </button>
          </section>
        </div>
      </aside>

      {statusDialog && (
        <ReasonDialog
          title={statusDialog === 'attivo' ? 'Riattivare l’account?' : statusDialog === 'sospeso' ? 'Sospendere l’account?' : 'Bloccare l’account?'}
          description={`${user.full_name}: ${c ? STATO_LABEL[c.stato] : ''} → ${STATO_LABEL[statusDialog]}.${statusDialog === 'attivo' && c?.giorni_alla_scadenza !== null && (c?.giorni_alla_scadenza ?? 0) < 0 ? ' Attenzione: l’abbonamento è scaduto, il job di stanotte lo sospenderà di nuovo se non lo prolunghi.' : ''}`}
          confirmText={statusDialog === 'attivo' ? 'Riattiva' : statusDialog === 'sospeso' ? 'Sospendi' : 'Blocca'}
          destructive={statusDialog !== 'attivo'}
          onCancel={() => setStatusDialog(null)}
          onConfirm={async (motivo) => {
            const ok = await accountAction(user.id, { action: 'status', stato: statusDialog, motivo }, showToast, `Account ${STATO_LABEL[statusDialog].toLowerCase()}`)
            setStatusDialog(null)
            await afterAction(ok)
          }}
        />
      )}
      {moduleDialog && catalogo && (
        <ReasonDialog
          title={
            moduleDialog.abilitato === null
              ? `Rimuovere l’eccezione su ${catalogo.moduli.find((x) => x.codice === moduleDialog.m.codice)?.nome}?`
              : `${moduleDialog.abilitato ? 'Attivare' : 'Disattivare'} ${catalogo.moduli.find((x) => x.codice === moduleDialog.m.codice)?.nome}?`
          }
          description={
            moduleDialog.abilitato === null
              ? `Torna a valere il piano: ${moduleDialog.m.incluso_nel_piano ? 'incluso' : 'non incluso'}.`
              : moduleDialog.abilitato === moduleDialog.m.incluso_nel_piano
                ? 'Coincide con il piano: viene salvata come eccezione esplicita (utile con una scadenza).'
                : `Eccezione ${moduleDialog.abilitato ? 'positiva' : 'negativa'} rispetto al piano ${pianoNome(catalogo, c?.piano ?? null)}.`
          }
          confirmText="Conferma"
          withDate={moduleDialog.abilitato !== null}
          dateLabel="L’eccezione vale fino al (facoltativo)"
          onCancel={() => setModuleDialog(null)}
          onConfirm={async (motivo, data) => {
            const ok = await accountAction(
              user.id,
              { action: 'module', modulo: moduleDialog.m.codice, abilitato: moduleDialog.abilitato, motivo, scade_il: data },
              showToast,
              'Modulo aggiornato',
            )
            setModuleDialog(null)
            await afterAction(ok)
          }}
        />
      )}
      {subDialog && c && (
        <ReasonDialog
          title="Salvare l’abbonamento?"
          description={`${pianoNome(catalogo, c.piano)} → ${pianoNome(catalogo, sub.piano)}${sub.data_scadenza ? `, scadenza ${formatDate(sub.data_scadenza, 'dd/MM/yyyy')}` : ', senza scadenza'}${sub.rinnovo_automatico ? ', rinnovo automatico' : ''}.`}
          confirmText="Salva"
          onCancel={() => setSubDialog(false)}
          onConfirm={async (motivo) => {
            const ok = await accountAction(
              user.id,
              { action: 'subscription', piano: sub.piano, data_inizio: sub.data_inizio || null, data_scadenza: sub.data_scadenza || null, rinnovo_automatico: sub.rinnovo_automatico, note: sub.note, motivo },
              showToast,
              'Abbonamento salvato',
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
    </div>
  )
}
