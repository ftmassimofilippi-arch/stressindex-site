'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase-browser'
import { PASSWORD_MIN_LENGTH, supabaseAuthErrorKey } from '@/lib/validation'

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
// IMPORTANTE: il client browser di @supabase/ssr forza `flowType: 'pkce'` e
// `detectSessionInUrl: true`, e `initialize()` parte già dal costruttore. Se
// nell'URL c'è `?code=` e il verifier è in storage, il client scambia il codice
// DA SOLO e subito dopo cancella il verifier. Il codice è monouso: un secondo
// `exchangeCodeForSession` sullo stesso codice fallisce sempre, anche quando il
// primo è andato a buon fine e la sessione esiste già.
//
// Perciò l'ordine qui è: prima si aspetta l'init e si guarda la sessione, e solo
// se non c'è si tenta lo scambio a mano. E nessun errore viene mostrato senza
// aver ricontrollato la sessione.
//
// In nessun caso la pagina resta bianca: o form, o messaggio d'errore chiaro.
//
// I testi vivono in `auth.setPassword.*`: lo stato di errore conserva la CHIAVE
// (`errors.<kind>Title` / `errors.<kind>Detail`) e, solo per il caso "link non
// valido", l'eventuale `error_description` grezza di Supabase come testo.

type Mode = 'recovery' | 'invite'
type ErrorKind = 'sameBrowser' | 'expired' | 'expiredExchange' | 'invalid' | 'session' | 'tokenInvalid' | 'missing' | 'unexpected'
type State =
  | { step: 'loading' }
  | { step: 'ready'; mode: Mode; email: string | null }
  | { step: 'done'; mode: Mode }
  | { step: 'error'; kind: ErrorKind; detailText?: string; canRetry: boolean }

export function SetPasswordForm() {
  const t = useTranslations('auth.setPassword')
  const tSupabase = useTranslations('errors.supabase')
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

    // Il verifier PKCE è un cookie host-only scritto dal browser che ha chiesto
    // il recupero: se il link viene aperto altrove non c'è, e lo scambio non può
    // riuscire. È un errore diverso da "link scaduto" e va detto all'utente,
    // perché la soluzione è riaprire il link nel browser giusto.
    function isVerifierMissing(error: unknown): boolean {
      const e = error as { code?: string; name?: string } | null
      return e?.code === 'pkce_code_verifier_not_found' || e?.name === 'AuthPKCECodeVerifierMissingError'
    }

    function exchangeFailure(error: unknown): State {
      if (isVerifierMissing(error)) {
        return { step: 'error', kind: 'sameBrowser', canRetry: true }
      }
      return { step: 'error', kind: 'expiredExchange', canRetry: true }
    }

    async function run() {
      const supabase = createClient()
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const query = new URLSearchParams(window.location.search)
      const get = (k: string) => hash.get(k) ?? query.get(k)

      const rawType = get('type')
      const mode: Mode = rawType === 'invite' || rawType === 'signup' ? 'invite' : 'recovery'

      // Mostra un errore solo se davvero non c'è sessione: lo scambio può
      // essere già riuscito e il fallimento essere solo il secondo tentativo.
      async function failWith(next: State) {
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        if (data.session) {
          await finish(mode)
          return
        }
        setState(next)
      }

      // 1. Errori restituiti da Supabase (link scaduto, già usato, revocato).
      const errorCode = get('error_code')
      const errorKind = get('error')
      if (errorCode || errorKind) {
        const expired = errorCode === 'otp_expired' || errorCode === 'access_denied' || errorKind === 'access_denied'
        if (!cancelled) {
          if (expired) {
            setState({ step: 'error', kind: 'expired', canRetry: true })
          } else {
            const description = decodeURIComponent(get('error_description') ?? '').replace(/\+/g, ' ')
            setState({ step: 'error', kind: 'invalid', detailText: description || undefined, canRetry: true })
          }
        }
        return
      }

      // 2. Scambio automatico: `initialize()` è già partito dal costruttore e,
      //    se l'URL è un callback riconoscibile, ha già consumato il token.
      //    Aspettarlo qui evita di riscambiare un codice monouso già speso.
      const { error: initError } = await supabase.auth.initialize()
      if (cancelled) return
      const { data: initial } = await supabase.auth.getSession()
      if (cancelled) return
      if (initial.session) {
        await finish(mode)
        return
      }
      if (initError) {
        console.error('[imposta-password] initialize ha fallito lo scambio', initError)
      }

      // 3. Implicit flow: token già pronti nel fragment.
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
          await failWith({ step: 'error', kind: 'session', canRetry: true })
          return
        }
        await finish(mode)
        return
      }

      // 4. PKCE a mano: solo se lo scambio automatico non è scattato (verifier
      //    assente, oppure `code` arrivato in una forma che il client non
      //    riconosce come callback).
      const code = query.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (error) {
          console.error('[imposta-password] exchangeCodeForSession fallita', error)
          await failWith(exchangeFailure(error))
          return
        }
        await finish(mode)
        return
      }

      // 5. token_hash: verifica OTP lato client.
      const tokenHash = query.get('token_hash') ?? query.get('token')
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: mode === 'invite' ? 'invite' : 'recovery',
        })
        if (cancelled) return
        if (error) {
          console.error('[imposta-password] verifyOtp fallita', error)
          await failWith({ step: 'error', kind: 'tokenInvalid', canRetry: true })
          return
        }
        await finish(mode)
        return
      }

      // 6. Nessun token nell'URL e nessuna sessione: link incompleto.
      if (initError && isVerifierMissing(initError)) {
        setState(exchangeFailure(initError))
        return
      }
      setState({ step: 'error', kind: 'missing', canRetry: true })
    }

    run().catch((e) => {
      console.error('[imposta-password] errore inatteso', e)
      if (!cancelled) {
        setState({ step: 'error', kind: 'unexpected', canRetry: true })
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
    if (password.length < PASSWORD_MIN_LENGTH) {
      setFormError(t('passwordTooShort', { min: PASSWORD_MIN_LENGTH }))
      return
    }
    if (password !== confirm) {
      setFormError(t('passwordMismatch'))
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      console.error('[imposta-password] updateUser fallita', error)
      const key = supabaseAuthErrorKey(error)
      setFormError(key === 'sessionMissing' ? t('sessionExpired') : tSupabase(key))
      return
    }
    setState({ step: 'done', mode: state.mode })
  }

  if (state.step === 'loading') {
    return (
      <div className="text-center py-10" role="status">
        <div className="w-8 h-8 mx-auto rounded-full border-2 border-teal border-t-transparent animate-spin" />
        <p className="mt-4 text-sm text-anthracite-lighter">{t('checking')}</p>
      </div>
    )
  }

  if (state.step === 'error') {
    return (
      <div>
        <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider mb-4">
          <span aria-hidden="true">⚠️</span>
          <span>{t('unusable')}</span>
        </div>
        <h1 className="font-serif text-3xl text-anthracite tracking-tight">{t(`errors.${state.kind}Title`)}</h1>
        <p className="mt-3 text-anthracite-light">{state.detailText ?? t(`errors.${state.kind}Detail`)}</p>
        {state.canRetry && (
          <Link href="/area-professionisti/recupera-password" className="btn-primary w-full mt-8 inline-block text-center">
            {t('requestNew')}
          </Link>
        )}
        <p className="mt-6 text-sm text-anthracite-lighter text-center">
          <Link href="/area-professionisti/login" className="text-teal-dark font-medium hover:underline">
            {t('backToLogin')}
          </Link>
        </p>
      </div>
    )
  }

  if (state.step === 'done') {
    return (
      <div>
        <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider mb-4">
          <span aria-hidden="true">✅</span>
          <span>{t('doneEyebrow')}</span>
        </div>
        <h1 className="font-serif text-3xl text-anthracite tracking-tight">{t('doneTitle')}</h1>
        <p className="mt-3 text-anthracite-light">{t(`${state.mode}.done`)}</p>
        <Link href="/area-professionisti" className="btn-primary w-full mt-8 inline-block text-center">
          {t('goToArea')}
        </Link>
      </div>
    )
  }

  const mode = state.mode
  return (
    <div>
      <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider mb-4">
        <span aria-hidden="true">{mode === 'invite' ? '✨' : '🔑'}</span>
        <span>{t(`${mode}.eyebrow`)}</span>
      </div>
      <h1 className="font-serif text-4xl text-anthracite tracking-tight">{t(`${mode}.title`)}</h1>
      <p className="mt-3 text-anthracite-light">{t(`${mode}.intro`)}</p>
      {state.email && (
        <p className="mt-2 text-sm text-anthracite-lighter break-words">
          {t.rich('account', {
            email: state.email,
            b: (chunks) => <strong className="text-anthracite">{chunks}</strong>,
          })}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 mt-8" noValidate>
        <div>
          <label htmlFor="password" className="input-label">{t('newPassword')}</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            placeholder={t('newPasswordPlaceholder', { min: PASSWORD_MIN_LENGTH })}
          />
        </div>
        <div>
          <label htmlFor="confirm" className="input-label">{t('confirmPassword')}</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input-field"
            placeholder={t('confirmPasswordPlaceholder')}
          />
        </div>
        {formError && (
          <div className="px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm border-l-4 border-red-400 flex items-start gap-3" role="alert">
            <span aria-hidden="true" className="text-lg leading-none mt-0.5">⚠️</span>
            <span>{formError}</span>
          </div>
        )}
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? t('saving') : t(`${mode}.cta`)}
        </button>
      </form>
    </div>
  )
}
