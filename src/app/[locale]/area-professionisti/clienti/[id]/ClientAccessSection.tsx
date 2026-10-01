'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Copy, KeyRound, Link2, Mail, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import {
  PASSWORD_MIN,
  RATE_LIMIT_24H,
  generaPasswordTemporanea,
  type ClientAccessState,
} from '@/lib/access-password'
import { apiErrorMessage } from '@/lib/api-error'
import { intlTag } from '@/lib/format'

// =============================================================================
// Sezione "Accesso all'app" della scheda cliente
// =============================================================================
//
// Mostra una cosa sola, che è quella che conta: il cliente ha già usato il suo
// account o no?
//
//   • mai usato  → si stanno ancora consegnando le credenziali: si può
//                  impostare una password temporanea e dettarla al cliente;
//   • attivo     → la password è sua. Il professionista non la imposta e non la
//                  vede: può solo far ripartire il recupero via email o
//                  passargli un link.
//
// La regola è imposta dalla route (409 account_in_use): qui si nasconde solo il
// bottone che non avrebbe senso premere. Gli errori della route sono codici
// (`errors.api.*`) tradotti con apiErrorMessage.

type Props = {
  clientId: string
  clientName: string
}

type Esito = { kind: 'ok' | 'err'; text: string } | null

export function ClientAccessSection({ clientId, clientName }: Props) {
  const t = useTranslations('clients.access')
  const tErr = useTranslations('errors.api')
  const locale = useLocale()
  const [state, setState] = useState<ClientAccessState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [esito, setEsito] = useState<Esito>(null)

  const [password, setPassword] = useState('')
  const [pwCopied, setPwCopied] = useState(false)
  const [resetLink, setResetLink] = useState<{ link: string; message: string } | null>(null)
  const [linkCopied, setLinkCopied] = useState<'link' | 'msg' | null>(null)

  const carica = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clienti/${encodeURIComponent(clientId)}/accesso`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.state) setState(json.state as ClientAccessState)
      else setEsito({ kind: 'err', text: apiErrorMessage(json, tErr, t('stateUnreadable')) })
    } catch {
      setEsito({ kind: 'err', text: t('stateUnreachable') })
    } finally {
      setLoading(false)
    }
  }, [clientId, t, tErr])

  useEffect(() => {
    void carica()
  }, [carica])

  // Motivo del mancato avviso: codice tradotto, oppure il testo grezzo (SMTP).
  function noticeReason(reason: unknown): string {
    const r = String(reason ?? '')
    return t.has(`noticeReasons.${r}`) ? t(`noticeReasons.${r}`) : r
  }

  async function azione(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action)
    setEsito(null)
    try {
      const res = await fetch(`/api/clienti/${encodeURIComponent(clientId)}/accesso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setEsito({ kind: 'err', text: apiErrorMessage(json, tErr, t('actionFailed')) })
        return
      }
      if (action === 'copy_reset_link' && json?.link) {
        setResetLink({ link: json.link, message: json.message })
      }
      const coda: string[] = []
      // `create_access` non ha un esito unico: ogni valore di `result` ha il
      // suo messaggio, gli stessi che dà l'app. Un esito sconosciuto si dice
      // com'è, invece di passare per riuscito.
      if (action === 'create_access') {
        const r = String(json?.result ?? '')
        coda.push(t.has(`createResults.${r}`) ? t(`createResults.${r}`) : t('createResults.unknown', { result: r }))
      }
      if (action === 'set_temp_password') coda.push(t('results.tempPasswordSet'))
      if (action === 'send_reset_email') coda.push(json?.email ? t('results.resetSent', { email: json.email }) : t('results.resetSentNoEmail'))
      if (action === 'copy_reset_link') coda.push(t('results.linkGenerated'))
      if (json?.warning) {
        const w = String(json.warning)
        coda.push(t.has(`warnings.${w}`) ? t(`warnings.${w}`) : w)
      }
      if (json?.noticeSent === false) coda.push(t('results.noticeNotSent', { reason: noticeReason(json.noticeError) }))
      if (json?.logged === false) coda.push(t('results.notLogged'))
      setEsito({ kind: 'ok', text: coda.join(' ') })
      await carica()
    } catch {
      setEsito({ kind: 'err', text: t('networkError') })
    } finally {
      setBusy(null)
    }
  }

  async function copia(testo: string, quale: 'pw' | 'link' | 'msg') {
    try {
      await navigator.clipboard.writeText(testo)
      if (quale === 'pw') { setPwCopied(true); setTimeout(() => setPwCopied(false), 2000) }
      else { setLinkCopied(quale); setTimeout(() => setLinkCopied(null), 2000) }
    } catch {
      setEsito({ kind: 'err', text: t('clipboardDenied') })
    }
  }

  function formatData(iso: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat(intlTag(locale), {
      timeZone: 'Europe/Rome',
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(d)
  }

  if (loading && !state) {
    return (
      <section className="card p-6">
        <h3 className="font-serif text-lg text-anthracite mb-1">{t('title')}</h3>
        <p className="text-sm text-anthracite-lighter">{t('reading')}</p>
      </section>
    )
  }

  if (!state) {
    return (
      <section className="card p-6">
        <h3 className="font-serif text-lg text-anthracite mb-1">{t('title')}</h3>
        <p className="text-sm text-red-600">{esito?.text ?? t('stateUnavailable')}</p>
      </section>
    )
  }

  // ── Nessun account app: si può crearlo da qui ─────────────────────────────
  if (!state.hasAccount) {
    return (
      <section className="card p-6">
        <h3 className="font-serif text-lg text-anthracite mb-1">{t('title')}</h3>
        <p className="text-sm text-anthracite-lighter">
          {t.rich('noAccount', { name: clientName, b: (chunks) => <strong>{chunks}</strong> })}
        </p>
        {state.email ? (
          <>
            <button
              type="button"
              onClick={() => void azione('create_access')}
              disabled={busy !== null}
              className="btn-primary mt-4 text-sm"
            >
              {busy === 'create_access' ? t('creating') : t('createAccess')}
            </button>
            <p className="mt-2 text-xs text-anthracite-lighter">{t('createAccessHint', { email: state.email })}</p>
          </>
        ) : (
          <p className="mt-4 text-sm text-amber-700">{t('createAccessNoEmail')}</p>
        )}
        {esito && (
          <p className={`mt-3 text-sm ${esito.kind === 'ok' ? 'text-teal-dark' : 'text-red-600'}`}>{esito.text}</p>
        )}
      </section>
    )
  }

  const esaurito = state.actionsLeft <= 0

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div className="min-w-0">
          <h3 className="font-serif text-lg text-anthracite mb-1">{t('title')}</h3>
          <p className="text-sm text-anthracite-lighter truncate">{state.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void carica()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs text-anthracite-lighter hover:text-anthracite"
          title={t('refreshTitle')}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> {t('refresh')}
        </button>
      </div>

      {/* Stato */}
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border mb-5 ${
          state.neverUsed ? 'border-amber-200 bg-amber-50' : 'border-teal-200 bg-teal-light/60'
        }`}
      >
        {state.neverUsed ? (
          <Smartphone size={18} className="text-amber-700 mt-0.5 shrink-0" />
        ) : (
          <ShieldCheck size={18} className="text-teal-dark mt-0.5 shrink-0" />
        )}
        <div className="text-sm">
          {state.neverUsed ? (
            <>
              <div className="font-medium text-amber-900">{t('neverUsedTitle')}</div>
              <div className="text-amber-800 mt-0.5">{t('neverUsedBody', { name: clientName })}</div>
            </>
          ) : (
            <>
              <div className="font-medium text-teal-dark">{t('activeTitle')}</div>
              <div className="text-anthracite-light mt-0.5">{t('activeBody', { date: formatData(state.lastSignInAt) })}</div>
            </>
          )}
          {state.mustChangePassword && (
            <div className="text-xs text-amber-800 mt-1.5">{t('mustChange')}</div>
          )}
        </div>
      </div>

      {/* Azioni */}
      {state.neverUsed ? (
        <div className="space-y-3">
          <label className="input-label">{t('tempPasswordLabel', { min: PASSWORD_MIN })}</label>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field flex-1 min-w-[200px] font-mono"
              placeholder={t('tempPasswordPlaceholder')}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setPassword(generaPasswordTemporanea())}
              className="btn-secondary text-sm whitespace-nowrap"
            >
              {t('generate')}
            </button>
            <button
              type="button"
              onClick={() => void copia(password, 'pw')}
              disabled={!password}
              className="btn-secondary text-sm inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              {pwCopied ? <Check size={14} /> : <Copy size={14} />} {pwCopied ? t('copied') : t('copy')}
            </button>
          </div>
          <p className="text-xs text-anthracite-lighter">{t('tempPasswordHint')}</p>
          <button
            type="button"
            onClick={() => void azione('set_temp_password', { password })}
            disabled={password.length < PASSWORD_MIN || busy !== null || esaurito}
            className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <KeyRound size={15} /> {busy === 'set_temp_password' ? t('settingPassword') : t('setTempPassword')}
          </button>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void azione('send_reset_email')}
            disabled={busy !== null || esaurito}
            className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Mail size={15} /> {busy === 'send_reset_email' ? t('sending') : t('sendReset')}
          </button>
          <button
            type="button"
            onClick={() => void azione('copy_reset_link')}
            disabled={busy !== null || esaurito}
            className="btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Link2 size={15} /> {busy === 'copy_reset_link' ? t('generating') : t('copyResetLink')}
          </button>
        </div>
      )}

      {/* Link generato, pronto da incollare */}
      {resetLink && (
        <div className="mt-4 p-4 rounded-xl border border-surface-border bg-surface">
          <div className="text-sm font-medium text-anthracite mb-2">{t('pasteTitle')}</div>
          <textarea
            readOnly
            value={resetLink.message}
            rows={6}
            className="input-field w-full text-xs font-mono resize-y"
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="flex gap-2 flex-wrap mt-2">
            <button
              type="button"
              onClick={() => void copia(resetLink.message, 'msg')}
              className="btn-primary text-sm inline-flex items-center gap-1.5"
            >
              {linkCopied === 'msg' ? <Check size={14} /> : <Copy size={14} />} {linkCopied === 'msg' ? t('copiedGeneric') : t('copyMessage')}
            </button>
            <button
              type="button"
              onClick={() => void copia(resetLink.link, 'link')}
              className="btn-secondary text-sm inline-flex items-center gap-1.5"
            >
              {linkCopied === 'link' ? <Check size={14} /> : <Copy size={14} />} {linkCopied === 'link' ? t('copiedGeneric') : t('copyLinkOnly')}
            </button>
          </div>
          <p className="text-xs text-anthracite-lighter mt-2">{t('linkNote')}</p>
        </div>
      )}

      {/* Esito */}
      {esito && (
        <div
          className={`mt-4 px-3.5 py-2.5 rounded-xl text-sm ${
            esito.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {esito.text}
        </div>
      )}

      {/* Limite e storico */}
      <div className="mt-5 pt-4 border-t border-surface-border text-xs text-anthracite-lighter space-y-1.5">
        <div>
          {esaurito ? (
            <span className="text-amber-700">{t('limitReached', { max: RATE_LIMIT_24H })}</span>
          ) : (
            t.rich('actionsLeft', { left: state.actionsLeft, max: RATE_LIMIT_24H, b: (chunks) => <strong>{chunks}</strong> })
          )}
        </div>
        <div>{t('logged')}</div>
        {state.recent.length > 0 && (
          <ul className="pt-1 space-y-0.5">
            {state.recent.map((r, i) => (
              <li key={`${r.created_at}-${i}`}>
                {formatData(r.created_at)} · {t.has(`actions.${r.action}`) ? t(`actions.${r.action}`) : r.action}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
