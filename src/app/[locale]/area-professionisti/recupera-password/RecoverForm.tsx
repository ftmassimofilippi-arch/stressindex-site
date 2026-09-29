'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { withLocale, type Locale } from '@/i18n/routing'
import { createClient } from '@/lib/supabase-browser'
import { supabaseAuthErrorKey } from '@/lib/validation'

export function RecoverForm() {
  const t = useTranslations('auth.recover')
  const tSupabase = useTranslations('errors.supabase')
  const locale = useLocale() as Locale
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email) { setError(t('emailRequired')); return }
    setLoading(true)
    const supabase = createClient()
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''
    // Destinazione diretta: /imposta-password (nella lingua corrente) è l'unica
    // pagina che sa scambiare il token. Perché sia rispettata deve stare nella
    // Redirect URL allowlist del progetto Supabase (anche /en/... e /de/...),
    // altrimenti si ripiega sulla Site URL: per quel caso resta
    // RecoveryLinkRedirect come rete di sicurezza.
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}${withLocale('/imposta-password', locale)}`,
    })
    setLoading(false)
    if (authError) { setError(tSupabase(supabaseAuthErrorKey(authError))); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="px-4 py-3 rounded-lg bg-teal-light/60 border-l-4 border-teal text-sm text-anthracite flex items-start gap-3" role="status">
        <span aria-hidden="true" className="text-lg leading-none mt-0.5">✉️</span>
        <span>{t('sent')}</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="input-label">{t('email')}</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
          placeholder={t('emailPlaceholder')}
        />
      </div>
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm border-l-4 border-red-400 flex items-start gap-3" role="alert">
          <span aria-hidden="true" className="text-lg leading-none mt-0.5">⚠️</span>
          <span>{error}</span>
        </div>
      )}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? t('submitting') : t('submit')}
      </button>
    </form>
  )
}
