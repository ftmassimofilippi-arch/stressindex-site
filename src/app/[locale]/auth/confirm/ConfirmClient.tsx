'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { withLocale, type Locale } from '@/i18n/routing'
import { createClient } from '@/lib/supabase-browser'
import type { EmailOtpType } from '@supabase/supabase-js'

// Pagina intermedia dei link email con `token_hash` (audit QA, punto D6).
// Il token è monouso: i prescanner delle caselle di posta (Gmail, Outlook)
// aprono il link prima dell'utente e lo bruciavano (log Auth del 14/10:
// `403 One-time token not found`, IP di Google). Qui il GET non consuma nulla:
// `verifyOtp` parte solo al clic sul pulsante. Dopo, recovery e invite vanno a
// /imposta-password (che trova la sessione e mostra il form), gli altri tipi
// all'area professionisti.

const TIPI: Record<string, EmailOtpType> = {
  recovery: 'recovery',
  invite: 'invite',
  signup: 'signup',
  email: 'email',
  magiclink: 'magiclink',
  email_change: 'email_change',
}

type Stato = { step: 'idle' } | { step: 'working' } | { step: 'missing' } | { step: 'failed'; detail?: string }

export function ConfirmClient() {
  const t = useTranslations('auth.confirm')
  const locale = useLocale() as Locale
  const [tokenHash, setTokenHash] = useState<string | null>(null)
  const [type, setType] = useState<EmailOtpType>('recovery')
  const [next, setNext] = useState<string | null>(null)
  const [stato, setStato] = useState<Stato>({ step: 'idle' })
  // Letto una volta sola: in sviluppo React esegue l'effect due volte e la
  // seconda non troverebbe più il token tolto dall'URL.
  const letto = useRef(false)

  useEffect(() => {
    if (letto.current) return
    letto.current = true
    const q = new URLSearchParams(window.location.search)
    const th = q.get('token_hash') ?? q.get('token')
    const tp = TIPI[(q.get('type') ?? 'recovery').toLowerCase()] ?? 'recovery'
    setTokenHash(th)
    setType(tp)
    setNext(q.get('next'))
    if (!th) setStato({ step: 'missing' })
    // Il token non resta nella barra degli indirizzi né nella cronologia.
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  async function conferma() {
    if (!tokenHash || stato.step === 'working') return
    setStato({ step: 'working' })
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) {
      console.error('[auth/confirm] verifyOtp fallita', error)
      setStato({ step: 'failed', detail: error.message })
      return
    }
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null
    const dest = type === 'recovery' || type === 'invite' ? '/imposta-password' : (safeNext ?? '/area-professionisti')
    window.location.replace(withLocale(dest, locale))
  }

  const ns = type === 'recovery' ? 'recovery' : type === 'invite' ? 'invite' : type === 'signup' ? 'signup' : 'other'

  return (
    <div className="text-center">
      <h1 className="font-serif text-3xl text-anthracite">{t(`${ns}.title`)}</h1>
      <p className="mt-3 text-sm text-anthracite-light leading-relaxed">{t(`${ns}.intro`)}</p>

      {stato.step === 'missing' || stato.step === 'failed' ? (
        <div className="mt-6 space-y-4">
          <div className="px-4 py-3 bg-red-50 border-l-4 border-red-400 rounded-lg text-sm text-red-700 text-left" role="alert">
            {stato.step === 'missing' ? t('missing') : t('failed')}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/area-professionisti/recupera-password" className="btn-primary text-sm">{t('requestNew')}</Link>
            <Link href="/area-professionisti/login" prefetch={false} className="btn-secondary text-sm">{t('backLogin')}</Link>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={conferma}
          disabled={!tokenHash || stato.step === 'working'}
          className="btn-primary mt-7 w-full justify-center"
        >
          {stato.step === 'working' ? t('working') : t(`${ns}.cta`)}
        </button>
      )}
    </div>
  )
}
