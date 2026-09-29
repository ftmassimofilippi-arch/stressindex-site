'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { splitLocale } from '@/i18n/routing'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { supabaseAuthErrorKey } from '@/lib/validation'

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations('auth.login')
  const tSupabase = useTranslations('errors.supabase')
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError(t('fillAll'))
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (authError) {
      setError(tSupabase(supabaseAuthErrorKey(authError)))
      return
    }

    // `redirectTo` è un percorso senza prefisso di lingua: il router i18n lo
    // aggiunge. Se arriva col prefisso (link costruito a mano) lo si toglie,
    // altrimenti si finirebbe con /en/en/....
    router.push(splitLocale(redirectTo).path)
    router.refresh()
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

      <div>
        <label htmlFor="password" className="input-label">{t('password')}</label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field pr-11"
            placeholder="••••••••"
          />
          <button
            type="button"
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-anthracite-lighter hover:text-anthracite"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2 text-anthracite-lighter cursor-pointer">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-teal focus:ring-teal/30"
          />
          {t('remember')}
        </label>
        <Link href="/area-professionisti/recupera-password" className="text-teal-dark font-medium hover:underline">
          {t('forgot')}
        </Link>
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
