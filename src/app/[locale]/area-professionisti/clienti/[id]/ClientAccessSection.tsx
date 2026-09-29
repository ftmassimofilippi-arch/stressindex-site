'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, KeyRound, Link2, Mail, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import {
  AZIONE_LABEL,
  PASSWORD_MIN,
  RATE_LIMIT_24H,
  generaPasswordTemporanea,
  type ClientAccessState,
} from '@/lib/access-password'

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
// bottone che non avrebbe senso premere.

type Props = {
  clientId: string
  clientName: string
}

type Esito = { kind: 'ok' | 'err'; text: string } | null

export function ClientAccessSection({ clientId, clientName }: Props) {
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
      else setEsito({ kind: 'err', text: json?.message ?? 'Stato dell\'accesso non leggibile.' })
    } catch {
      setEsito({ kind: 'err', text: 'Stato dell\'accesso non raggiungibile.' })
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    void carica()
  }, [carica])

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
        setEsito({ kind: 'err', text: json?.message ?? json?.error ?? 'Operazione non riuscita.' })
        return
      }
      if (action === 'copy_reset_link' && json?.link) {
        setResetLink({ link: json.link, message: json.message })
      }
      const coda: string[] = []
      if (action === 'set_temp_password') coda.push('Password temporanea impostata. Il cliente dovrà cambiarla al primo accesso.')
      if (action === 'send_reset_email') coda.push(`Email di ripristino inviata a ${json?.email ?? 'il cliente'}.`)
      if (action === 'copy_reset_link') coda.push('Link generato: vale un\'ora e si usa una sola volta.')
      if (json?.warning) coda.push(json.warning)
      if (json?.noticeSent === false) coda.push(`Avviso al cliente non inviato (${json.noticeError}).`)
      if (json?.logged === false) coda.push('Attenzione: l\'azione non è stata registrata nel log.')
      setEsito({ kind: 'ok', text: coda.join(' ') })
      await carica()
    } catch {
      setEsito({ kind: 'err', text: 'Errore di rete.' })
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
      setEsito({ kind: 'err', text: 'Il browser non ha permesso la copia: seleziona il testo a mano.' })
    }
  }

  if (loading && !state) {
    return (
      <section className="card p-6">
        <h3 className="font-serif text-lg text-anthracite mb-1">Accesso all&apos;app</h3>
        <p className="text-sm text-anthracite-lighter">Lettura dello stato…</p>
      </section>
    )
  }

  if (!state) {
    return (
      <section className="card p-6">
        <h3 className="font-serif text-lg text-anthracite mb-1">Accesso all&apos;app</h3>
        <p className="text-sm text-red-600">{esito?.text ?? 'Stato non disponibile.'}</p>
      </section>
    )
  }

  // ── Nessun account app ────────────────────────────────────────────────────
  if (!state.hasAccount) {
    return (
      <section className="card p-6">
        <h3 className="font-serif text-lg text-anthracite mb-1">Accesso all&apos;app</h3>
        <p className="text-sm text-anthracite-lighter">
          {clientName} non ha ancora un account per l&apos;app. Puoi crearlo dalla lista clienti, con
          <strong> Nuovo cliente</strong>, usando la stessa email di questa scheda: la scheda esistente viene collegata,
          non duplicata.
        </p>
      </section>
    )
  }

  const esaurito = state.actionsLeft <= 0

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h3 className="font-serif text-lg text-anthracite mb-1">Accesso all&apos;app</h3>
          <p className="text-sm text-anthracite-lighter">{state.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void carica()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs text-anthracite-lighter hover:text-anthracite"
          title="Rileggi lo stato"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Aggiorna
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
              <div className="font-medium text-amber-900">Account mai usato</div>
              <div className="text-amber-800 mt-0.5">
                {clientName} non è ancora entrato nell&apos;app. Puoi impostargli una password temporanea e comunicargliela.
              </div>
            </>
          ) : (
            <>
              <div className="font-medium text-teal-dark">Account attivo</div>
              <div className="text-anthracite-light mt-0.5">
                Ultimo accesso: {formatData(state.lastSignInAt)}. La password è del cliente: non puoi impostarla né vederla,
                puoi solo far ripartire il ripristino.
              </div>
            </>
          )}
          {state.mustChangePassword && (
            <div className="text-xs text-amber-800 mt-1.5">
              In attesa che il cliente scelga la sua password al prossimo accesso.
            </div>
          )}
        </div>
      </div>

      {/* Azioni */}
      {state.neverUsed ? (
        <div className="space-y-3">
          <label className="input-label">Password temporanea (min {PASSWORD_MIN} caratteri)</label>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field flex-1 min-w-[200px] font-mono"
              placeholder="Genera o scrivi una password"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setPassword(generaPasswordTemporanea())}
              className="btn-secondary text-sm whitespace-nowrap"
            >
              Genera
            </button>
            <button
              type="button"
              onClick={() => void copia(password, 'pw')}
              disabled={!password}
              className="btn-secondary text-sm inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              {pwCopied ? <Check size={14} /> : <Copy size={14} />} {pwCopied ? 'Copiata' : 'Copia'}
            </button>
          </div>
          <p className="text-xs text-anthracite-lighter">
            Comunicala al cliente a voce o su un canale che usate già. Al primo accesso l&apos;app gli chiederà di
            sceglierne una sua, che tu non vedrai.
          </p>
          <button
            type="button"
            onClick={() => void azione('set_temp_password', { password })}
            disabled={password.length < PASSWORD_MIN || busy !== null || esaurito}
            className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <KeyRound size={15} /> {busy === 'set_temp_password' ? 'Impostazione…' : 'Imposta password temporanea'}
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
            <Mail size={15} /> {busy === 'send_reset_email' ? 'Invio…' : 'Reinvia email di reset'}
          </button>
          <button
            type="button"
            onClick={() => void azione('copy_reset_link')}
            disabled={busy !== null || esaurito}
            className="btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Link2 size={15} /> {busy === 'copy_reset_link' ? 'Generazione…' : 'Copia link di reset'}
          </button>
        </div>
      )}

      {/* Link generato, pronto da incollare */}
      {resetLink && (
        <div className="mt-4 p-4 rounded-xl border border-surface-border bg-surface">
          <div className="text-sm font-medium text-anthracite mb-2">Messaggio pronto da incollare</div>
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
              {linkCopied === 'msg' ? <Check size={14} /> : <Copy size={14} />} {linkCopied === 'msg' ? 'Copiato' : 'Copia messaggio'}
            </button>
            <button
              type="button"
              onClick={() => void copia(resetLink.link, 'link')}
              className="btn-secondary text-sm inline-flex items-center gap-1.5"
            >
              {linkCopied === 'link' ? <Check size={14} /> : <Copy size={14} />} {linkCopied === 'link' ? 'Copiato' : 'Copia solo il link'}
            </button>
          </div>
          <p className="text-xs text-anthracite-lighter mt-2">
            Vale un&apos;ora e si può usare una sola volta. Non resta salvato: se lo perdi, generane un altro.
          </p>
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
            <span className="text-amber-700">
              Limite raggiunto: {RATE_LIMIT_24H} interventi sull&apos;accesso di questo cliente nelle ultime 24 ore. Riprova domani.
            </span>
          ) : (
            <>Interventi rimasti nelle prossime 24 ore: <strong>{state.actionsLeft}</strong> su {RATE_LIMIT_24H}.</>
          )}
        </div>
        <div>Ogni intervento è registrato e il cliente riceve un avviso via email.</div>
        {state.recent.length > 0 && (
          <ul className="pt-1 space-y-0.5">
            {state.recent.map((r, i) => (
              <li key={`${r.created_at}-${i}`}>
                {formatData(r.created_at)} — {AZIONE_LABEL[r.action] ?? r.action}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function formatData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d)
}
