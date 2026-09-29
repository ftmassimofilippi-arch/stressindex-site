'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { Check, Copy, Plus } from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import { generaPasswordTemporanea } from '@/lib/access-password'
import { apiErrorMessage } from '@/lib/api-error'
import {
  FORM_VUOTO,
  LIVELLI_ATTIVITA,
  LIVELLI_COMPETITIVI,
  SESSI,
  testoErroreCampo,
  validaClientForm,
  type AccessMode,
  type ClientFormData,
  type ErroriForm,
} from '@/lib/client-form'

// =============================================================================
// "Nuovo cliente": crea la scheda e, se si vuole, l'accesso all'app
// =============================================================================
//
// Stessi campi e stesse validazioni del form dell'app (src/lib/client-form.ts è
// condiviso con la route, quindi i due lati non possono divergere).
//
// Sull'accesso il professionista scegli fra tre cose, e la differenza conta:
//   • invito  → il cliente riceve un'email e sceglie la password da sé. Nessuno
//               a parte lui la conosce: è la via preferibile, ed è il default.
//   • password temporanea → utile quando il cliente è davanti a te o non usa
//               l'email. Gliela detti, e l'app gli chiederà di cambiarla al
//               primo accesso.
//   • nessuno → solo la scheda, l'accesso si crea più tardi.

type Props = {
  /** La sezione "Dati sport" nell'app compare solo col modulo sport attivo. */
  sportEnabled: boolean
}

type Esito =
  | { kind: 'ok'; clientId: string; righe: string[] }
  | { kind: 'duplicate'; clientId: string; message: string }
  | { kind: 'err'; message: string }
  | null

export function NewClientButton({ sportEnabled }: Props) {
  const t = useTranslations('clients.form')
  const tc = useTranslations('common')
  const tErr = useTranslations('errors.api')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ClientFormData>(FORM_VUOTO)
  const [errori, setErrori] = useState<ErroriForm>({})
  const [busy, setBusy] = useState(false)
  const [esito, setEsito] = useState<Esito>(null)
  const [pwCopied, setPwCopied] = useState(false)

  function set<K extends keyof ClientFormData>(k: K, v: ClientFormData[K]) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errori[k]) setErrori((e) => ({ ...e, [k]: undefined }))
  }

  function chiudi() {
    setOpen(false)
    setForm(FORM_VUOTO)
    setErrori({})
    setEsito(null)
  }

  async function submit() {
    const e = validaClientForm(form)
    setErrori(e)
    if (Object.keys(e).length > 0) {
      setEsito({ kind: 'err', message: t('checkFields') })
      return
    }
    setBusy(true)
    setEsito(null)
    try {
      const res = await fetch('/api/clienti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => null)

      if (res.status === 409 && json?.error === 'duplicate_client') {
        setEsito({
          kind: 'duplicate',
          clientId: json.client_id,
          message: t('duplicate', { name: json.client_name || t('thisClient') }),
        })
        return
      }
      if (!res.ok) {
        if (json?.errors) setErrori(json.errors as ErroriForm)
        const base = apiErrorMessage(json, tErr, t('createFailed'))
        setEsito({ kind: 'err', message: json?.detail ? `${base}: ${json.detail}` : base })
        return
      }

      const righe: string[] = []
      if (json.emailAlreadyRegistered) {
        righe.push(t('outcome.existingLinked'))
      } else if (json.inviteSent) {
        righe.push(t('outcome.inviteSent'))
      } else if (json.passwordSet) {
        righe.push(t('outcome.passwordSet'))
      } else {
        righe.push(t('outcome.recordOnly'))
      }
      if ((json.merged ?? []).length > 0) righe.push(t('outcome.merged'))
      if (json.linkWarning) righe.push(t('outcome.linkWarning', { detail: String(json.linkWarning) }))
      // Codice di errors.api.* oppure messaggio grezzo di Supabase.
      if (json.accessError) righe.push(apiErrorMessage(json.accessError, tErr))

      setEsito({ kind: 'ok', clientId: json.client_id, righe })
      router.refresh()
    } catch {
      setEsito({ kind: 'err', message: t('networkError') })
    } finally {
      setBusy(false)
    }
  }

  async function copiaPassword() {
    try {
      await navigator.clipboard.writeText(form.password)
      setPwCopied(true)
      setTimeout(() => setPwCopied(false), 2000)
    } catch {
      setEsito({ kind: 'err', message: t('copyFailed') })
    }
  }

  const creato = esito?.kind === 'ok'
  const err = (k: keyof ClientFormData) => testoErroreCampo(errori[k], t)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary text-sm inline-flex items-center gap-2 whitespace-nowrap"
      >
        <Plus size={16} className="flex-shrink-0" /> {t('newClient')}
      </button>

      <Modal
        open={open}
        onClose={chiudi}
        title={creato ? t('createdTitle') : t('title')}
        description={creato ? undefined : t('intro')}
        size="lg"
        footer={
          creato ? (
            <div className="flex justify-end gap-2 flex-wrap">
              <button type="button" onClick={chiudi} className="btn-secondary text-sm py-2">{tc('close')}</button>
              <Link
                href={`/area-professionisti/clienti/${encodeURIComponent(esito.clientId)}`}
                className="text-sm px-5 py-2 rounded-xl bg-teal hover:bg-teal-dark text-white font-medium whitespace-nowrap"
              >
                {t('openRecord')}
              </Link>
            </div>
          ) : (
            <div className="flex justify-end gap-2 flex-wrap">
              <button type="button" onClick={chiudi} className="btn-secondary text-sm py-2">{tc('cancel')}</button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="text-sm px-5 py-2 rounded-xl bg-teal hover:bg-teal-dark text-white font-medium disabled:opacity-50 whitespace-nowrap"
              >
                {busy ? t('creating') : t('create')}
              </button>
            </div>
          )
        }
      >
        {creato ? (
          <div className="space-y-3">
            {esito.righe.map((r, i) => (
              <p key={i} className="text-sm text-anthracite-light leading-relaxed">{r}</p>
            ))}
            {form.accessMode === 'password' && form.password && (
              <div className="p-3.5 rounded-xl bg-surface border border-surface-border">
                <div className="text-xs text-anthracite-lighter mb-1.5">{t('tempPasswordNotice')}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="flex-1 text-sm font-mono text-anthracite break-all min-w-0">{form.password}</code>
                  <button type="button" onClick={copiaPassword} className="btn-secondary text-xs inline-flex items-center gap-1.5 whitespace-nowrap">
                    {pwCopied ? <Check size={13} /> : <Copy size={13} />} {pwCopied ? t('copied') : t('copy')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <Sezione titolo={t('sections.personal')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Campo label={`${t('fields.firstName')} *`} errore={err('nome')}>
                  <input className="input-field" value={form.nome} onChange={(e) => set('nome', e.target.value)} autoComplete="off" />
                </Campo>
                <Campo label={`${t('fields.lastName')} *`} errore={err('cognome')}>
                  <input className="input-field" value={form.cognome} onChange={(e) => set('cognome', e.target.value)} autoComplete="off" />
                </Campo>
                <Campo label={t('fields.birthDate')} errore={err('data_nascita')}>
                  <input
                    className="input-field"
                    type="date"
                    min="1900-01-01"
                    max={new Date().toISOString().slice(0, 10)}
                    value={form.data_nascita}
                    onChange={(e) => set('data_nascita', e.target.value)}
                  />
                </Campo>
                <Campo label={t('fields.sex')} errore={err('sesso')}>
                  <select className="input-field" value={form.sesso} onChange={(e) => set('sesso', e.target.value)}>
                    <option value="">{tc('select')}</option>
                    {SESSI.map((s) => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
                  </select>
                </Campo>
                <Campo label={t('fields.weight')} errore={err('peso')}>
                  <input className="input-field" inputMode="decimal" placeholder={t('placeholders.weight')} value={form.peso} onChange={(e) => set('peso', e.target.value)} />
                </Campo>
                <Campo label={t('fields.height')} errore={err('altezza')}>
                  <input className="input-field" inputMode="decimal" placeholder={t('placeholders.height')} value={form.altezza} onChange={(e) => set('altezza', e.target.value)} />
                </Campo>
              </div>
            </Sezione>

            <Sezione titolo={t('sections.lifestyle')}>
              <div className="space-y-3">
                <TriToggle label={t('fields.smoker')} value={form.fumatore} onChange={(v) => set('fumatore', v)} yes={tc('yes')} no={tc('no')} />
                <TriToggle label={t('fields.athlete')} value={form.atleta} onChange={(v) => set('atleta', v)} yes={tc('yes')} no={tc('no')} />
                <Campo label={t('fields.activityLevel')} errore={err('livello_attivita')}>
                  <select className="input-field" value={form.livello_attivita} onChange={(e) => set('livello_attivita', e.target.value)}>
                    <option value="">{tc('select')}</option>
                    {LIVELLI_ATTIVITA.map((l) => <option key={l.value} value={l.value}>{t(l.labelKey)}</option>)}
                  </select>
                </Campo>
              </div>
            </Sezione>

            <Sezione titolo={t('sections.contacts')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Campo label={`${t('fields.email')} *`} errore={err('email')}>
                  <input className="input-field" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />
                </Campo>
                <Campo label={t('fields.phone')} errore={err('telefono')}>
                  <input className="input-field" type="tel" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} autoComplete="off" />
                </Campo>
              </div>
            </Sezione>

            <Sezione titolo={t('sections.access')}>
              <div className="space-y-2">
                <ModoAccesso
                  id="invito"
                  attivo={form.accessMode === 'invito'}
                  onSelect={() => set('accessMode', 'invito')}
                  titolo={t('access.inviteTitle')}
                  desc={t('access.inviteDesc')}
                />
                <ModoAccesso
                  id="password"
                  attivo={form.accessMode === 'password'}
                  onSelect={() => set('accessMode', 'password')}
                  titolo={t('access.passwordTitle')}
                  desc={t('access.passwordDesc')}
                />
                <ModoAccesso
                  id="nessuno"
                  attivo={form.accessMode === 'nessuno'}
                  onSelect={() => set('accessMode', 'nessuno')}
                  titolo={t('access.noneTitle')}
                  desc={t('access.noneDesc')}
                />

                {form.accessMode === 'password' && (
                  <div className="pt-2">
                    <Campo label={t('fields.tempPassword', { min: 8 })} errore={err('password')}>
                      <div className="flex gap-2 flex-wrap">
                        <input
                          className="input-field flex-1 min-w-[180px] font-mono"
                          type="text"
                          value={form.password}
                          onChange={(e) => set('password', e.target.value)}
                          placeholder={t('placeholders.password')}
                          autoComplete="off"
                        />
                        <button type="button" onClick={() => set('password', generaPasswordTemporanea())} className="btn-secondary text-sm whitespace-nowrap">
                          {t('generate')}
                        </button>
                        <button
                          type="button"
                          onClick={copiaPassword}
                          disabled={!form.password}
                          className="btn-secondary text-sm inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                        >
                          {pwCopied ? <Check size={14} /> : <Copy size={14} />} {pwCopied ? t('copied') : t('copy')}
                        </button>
                      </div>
                    </Campo>
                  </div>
                )}
              </div>
            </Sezione>

            <Sezione titolo={t('sections.notes')}>
              <textarea className="input-field w-full" rows={4} value={form.note} onChange={(e) => set('note', e.target.value)} aria-label={t('sections.notes')} />
            </Sezione>

            {sportEnabled && (
              <Sezione titolo={t('sections.sport')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Campo label={t('fields.sport')} errore={err('sport')}>
                    <input className="input-field" value={form.sport} onChange={(e) => set('sport', e.target.value)} />
                  </Campo>
                  <Campo label={t('fields.competitiveLevel')} errore={err('competitive_level')}>
                    <select className="input-field" value={form.competitive_level} onChange={(e) => set('competitive_level', e.target.value)}>
                      <option value="">{tc('select')}</option>
                      {LIVELLI_COMPETITIVI.map((l) => <option key={l.value} value={l.value}>{t(l.labelKey)}</option>)}
                    </select>
                  </Campo>
                  <Campo label={t('fields.hrMax')} errore={err('hr_max')}>
                    <input className="input-field" inputMode="numeric" placeholder={t('placeholders.hrMax')} value={form.hr_max} onChange={(e) => set('hr_max', e.target.value)} />
                  </Campo>
                  <Campo label={t('fields.ftp')} errore={err('ftp_estimated')}>
                    <input className="input-field" inputMode="numeric" placeholder={t('placeholders.ftp')} value={form.ftp_estimated} onChange={(e) => set('ftp_estimated', e.target.value)} />
                  </Campo>
                  <div className="sm:col-span-2">
                    <Campo label={t('fields.currentGoal')} errore={err('current_goal')}>
                      <textarea className="input-field w-full" rows={3} value={form.current_goal} onChange={(e) => set('current_goal', e.target.value)} />
                    </Campo>
                  </div>
                </div>
              </Sezione>
            )}

            {esito?.kind === 'duplicate' && (
              <div className="px-3.5 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                {esito.message}{' '}
                {t.rich('openExisting', {
                  link: (c) => (
                    <Link href={`/area-professionisti/clienti/${encodeURIComponent(esito.clientId)}`} className="font-medium underline">
                      {c}
                    </Link>
                  ),
                })}
              </div>
            )}
            {esito?.kind === 'err' && (
              <div className="px-3.5 py-2.5 rounded-xl bg-red-50 text-sm text-red-700">{esito.message}</div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

// ── Pezzi di form ────────────────────────────────────────────────────────────

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-anthracite-lighter mb-3">{titolo}</h3>
      {children}
    </section>
  )
}

function Campo({ label, errore, children }: { label: string; errore?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="input-label">{label}</label>
      {children}
      {errore && <p className="text-xs text-red-600 mt-1">{errore}</p>}
    </div>
  )
}

/** Tre stati come nell'app: non indicato, sì, no. */
function TriToggle({
  label, value, onChange, yes, no,
}: { label: string; value: boolean | null; onChange: (v: boolean | null) => void; yes: string; no: string }) {
  const opzioni: Array<{ v: boolean | null; l: string }> = [
    { v: null, l: '—' },
    { v: true, l: yes },
    { v: false, l: no },
  ]
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <span className="text-sm text-anthracite">{label}</span>
      <div className="flex gap-1">
        {opzioni.map((o) => (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => onChange(o.v)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              value === o.v ? 'border-teal bg-teal-light text-teal-dark font-medium' : 'border-surface-border text-anthracite-lighter hover:bg-surface'
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  )
}

function ModoAccesso({
  id, attivo, onSelect, titolo, desc,
}: { id: AccessMode; attivo: boolean; onSelect: () => void; titolo: string; desc: string }) {
  return (
    <label
      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
        attivo ? 'border-teal bg-teal-light/50' : 'border-surface-border hover:bg-surface'
      }`}
    >
      <input type="radio" name="accessMode" value={id} checked={attivo} onChange={onSelect} className="mt-0.5 accent-teal" />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-anthracite">{titolo}</span>
        <span className="block text-xs text-anthracite-lighter mt-0.5">{desc}</span>
      </span>
    </label>
  )
}
