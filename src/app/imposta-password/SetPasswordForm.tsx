'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

// =============================================================================
// Atterraggio dei link email Supabase: recovery (reset password) e invite.
// =============================================================================
//
// Supabase può consegnare il token in tre formati diversi, a seconda del
// template email e del flow del progetto. Li gestiamo tutti:
//
//   1. implicit flow  → #access_token=…&refresh_token=…&type=recovery|invite
//   2. PKCE           → ?code=…                       (exchangeCodeForSession)
//   3. token_hash     → ?token_hash=…&type=recovery   (verifyOtp)
//
// e gli errori, che Supabase mette nel fragment o nella query:
//   #error=access_denied&error_code=otp_expired&error_description=…
//
// Nota: il client browser di @supabase/ssr ha detectSessionInUrl attivo, quindi
// può aver già consumato il fragment prima che questo effetto giri. Per questo
// l'ultimo controllo è getSession(): se una sessione c'è, il link era valido.
// In nessun caso la pagina resta bianca: o form, o messaggio d'errore chiaro.

type Mode = 'recovery' | 'invite'
type State =
  | { step: 'loading' }
  | { step: 'ready'; mode: Mode; email: string | null }
  | { step: 'done'; mode: Mode }
  | { step: 'error'; title: string; detail: string; canRetry: boolean }

const COPY: Record<Mode, { eyebrow: string; icon: string; title: string; intro: string; cta: string; done: string }> = {
  recovery: {
    eyebrow: 'Recupera accesso',
    icon: '🔑',
    title: 'Nuova password',
    intro: 'Scegli una nuova password per il tuo account Stress Index.',
    cta: 'Salva la nuova password',
    done: 'Password aggiornata. Ora puoi accedere con le nuove credenziali, sia sul sito sia nell’app.',
  },
  invite: {
    eyebrow: 'Attiva account',
    icon: '✨',
    title: 'Imposta la password',
    intro: 'Benvenuto in Stress Index. Scegli una password per attivare il tuo account.',
    cta: 'Attiva account',
    done: 'Account attivato. Ora puoi accedere con la tua email e la password appena scelta.',
  },
}

export function SetPasswordForm() {
  const [state, setState] = useState<State>({ step: 'loading' })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const finish = useCallback(async (mode: Mode) => {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    setState({ step: 'ready', mode, email: data.user?.email ?? null })
    // Ripulisce l'URL: i token non devono restare nella barra degli indirizzi
    // (né finire nella cronologia o in un eventuale screenshot).
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function run() {
      const supabase = createClient()
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const query = new URLSearchParams(window.location.search)
      const get = (k: string) => hash.get(k) ?? query.get(k)

      const rawType = get('type')
      const mode: Mode = rawType === 'invite' || rawType === 'signup' ? 'invite' : 'recovery'

      // 1. Errori restituiti da Supabase (link scaduto, già usato, revocato).
      const errorCode = get('error_code')
      const errorKind = get('error')
      if (errorCode || errorKind) {
        const expired = errorCode === 'otp_expired' || errorCode === 'access_denied' || errorKind === 'access_denied'
        if (!cancelled) {
          setState({
            step: 'error',
            title: expired ? 'Link scaduto o già utilizzato' : 'Link non valido',
            detail: expired
              ? 'I link di recupero valgono una sola volta e scadono dopo poco tempo. Richiedine uno nuovo: arriverà subito via email.'
              : decodeURIComponent(get('error_description') ?? '').replace(/\+/g, ' ') ||
                'Il link non è stato riconosciuto. Richiedine uno nuovo.',
            canRetry: true,
          })
        }
        return
      }

      // 2. Implicit flow: token già pronti nel fragment.
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (cancelled) return
        if (error) {
          console.error('[imposta-password] setSession fallita', error)
          setState({
            step: 'error',
            title: 'Sessione di recupero non valida',
            detail: 'Il token del link non è più utilizzabile. Richiedi un nuovo link di recupero.',
            canRetry: true,
          })
          return
        }
        await finish(mode)
        return
      }

      // 3. PKCE: codice da scambiare per una sessione.
      const code = query.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (error) {
          console.error('[imposta-password] exchangeCodeForSession fallita', error)
          setState({
            step: 'error',
            title: 'Link scaduto o già utilizzato',
            detail: 'Non è stato possibile completare il recupero con questo link. Richiedine uno nuovo.',
            canRetry: true,
          })
          return
        }
        await finish(mode)
        return
      }

      // 4. token_hash: verifica OTP lato client.
      const tokenHash = query.get('token_hash') ?? query.get('token')
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: mode === 'invite' ? 'invite' : 'recovery',
        })
        if (cancelled) return
        if (error) {
          console.error('[imposta-password] verifyOtp fallita', error)
          setState({
            step: 'error',
            title: 'Link scaduto o già utilizzato',
            detail: 'Il token non è più valido. Richiedi un nuovo link di recupero.',
            canRetry: true,
          })
          return
        }
        await finish(mode)
        return
      }

      // 5. Nessun token nell'URL: può essere già stato consumato da
      //    detectSessionInUrl. Se una sessione esiste, si procede lo stesso.
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) {
        await finish(mode)
        return
      }
      setState({
        step: 'error',
        title: 'Token mancante',
        detail:
          'Questa pagina va aperta dal link ricevuto via email. Se hai copiato l’indirizzo a mano potresti aver perso la parte finale: riapri il link dall’email, oppure richiedine uno nuovo.',
        canRetry: true,
      })
    }

    run().catch((e) => {
      console.error('[imposta-password] errore inatteso', e)
      if (!cancelled) {
        setState({
          step: 'error',
          title: 'Qualcosa è andato storto',
          detail: 'Non è stato possibile validare il link. Riprova a richiedere il recupero password.',
          canRetry: true,
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [finish])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state.step !== 'ready') return
    setFormError(null)
    if (password.length < 8) {
      setFormError('La password deve avere almeno 8 caratteri')
      return
    }
    if (password !== confirm) {
      setFormError('Le due password non coincidono')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      console.error('[imposta-password] updateUser fallita', error)
      setFormError(
        error.message.toLowerCase().includes('session')
          ? 'La sessione di recupero è scaduta. Richiedi un nuovo link di recupero.'
          : error.message,
      )
      return
    }
    setState({ step: 'done', mode: state.mode })
  }

  if (state.step === 'loading') {
    return (
      <div className="text-center py-10">
        <div className="w-8 h-8 mx-auto rounded-full border-2 border-teal border-t-transparent animate-spin" />
        <p className="mt-4 text-sm text-anthracite-lighter">Verifica del link in corso…</p>
      </div>
    )
  }

  if (state.step === 'error') {
    return (
      <div>
        <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider mb-4">
          <span aria-hidden="true">⚠️</span>
          <span>Link non utilizzabile</span>
        </div>
        <h1 className="font-serif text-3xl text-anthracite tracking-tight">{state.title}</h1>
        <p className="mt-3 text-anthracite-light">{state.detail}</p>
        {state.canRetry && (
          <Link href="/area-professionisti/recupera-password" className="btn-primary w-full mt-8 inline-block text-center">
            Richiedi un nuovo link
          </Link>
        )}
        <p className="mt-6 text-sm text-anthracite-lighter text-center">
          <Link href="/area-professionisti/login" className="text-teal-dark font-medium hover:underline">
            ← Torna al login
          </Link>
        </p>
      </div>
    )
  }

  if (state.step === 'done') {
    const copy = COPY[state.mode]
    return (
      <div>
        <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider mb-4">
          <span aria-hidden="true">✅</span>
          <span>Fatto</span>
        </div>
        <h1 className="font-serif text-3xl text-anthracite tracking-tight">Tutto a posto</h1>
        <p className="mt-3 text-anthracite-light">{copy.done}</p>
        <Link href="/area-professionisti" className="btn-primary w-full mt-8 inline-block text-center">
          Vai alla tua area
        </Link>
      </div>
    )
  }

  const copy = COPY[state.mode]
  return (
    <div>
      <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider mb-4">
        <span aria-hidden="true">{copy.icon}</span>
        <span>{copy.eyebrow}</span>
      </div>
      <h1 className="font-serif text-4xl text-anthracite tracking-tight">{copy.title}</h1>
      <p className="mt-3 text-anthracite-light">{copy.intro}</p>
      {state.email && (
        <p className="mt-2 text-sm text-anthracite-lighter">
          Account: <strong className="text-anthracite">{state.email}</strong>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 mt-8" noValidate>
        <div>
          <label htmlFor="password" className="input-label">Nuova password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            placeholder="Almeno 8 caratteri"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="input-label">Conferma password</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input-field"
            placeholder="Ripeti la password"
          />
        </div>
        {formError && (
          <div className="px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm border-l-4 border-red-400 flex items-start gap-3">
            <span aria-hidden="true" className="text-lg leading-none mt-0.5">⚠️</span>
            <span>{formError}</span>
          </div>
        )}
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Salvataggio…' : copy.cta}
        </button>
      </form>
    </div>
  )
}
