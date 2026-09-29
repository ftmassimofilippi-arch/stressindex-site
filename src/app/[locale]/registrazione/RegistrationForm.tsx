'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase-browser'
import {
  validateRegistrationForm,
  translateFormErrors,
  hasErrors,
  supabaseAuthErrorKey,
  type FormErrors,
} from '@/lib/validation'

// I `value` sono salvati in professional_profiles.professione: non cambiano
// con la lingua, si traducono solo le etichette (registration.form.professions.*).
const PROFESSION_VALUES = ['medico', 'fisioterapista', 'osteopata', 'coach', 'altro'] as const

const inputErrorClass = 'border-red-400 focus:ring-red-200 focus:border-red-400'

export function RegistrationForm() {
  const t = useTranslations('registration.form')
  const tValidation = useTranslations('registration.validation')
  const tSupabase = useTranslations('errors.supabase')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    email: '',
    password: '',
    confermaPassword: '',
    professione: '',
    nomeStudio: '',
  })

  function updateField(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear field error on change
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field as keyof FormErrors]
        return next
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    // Validate
    const validationErrors = validateRegistrationForm(formData)
    if (hasErrors(validationErrors)) {
      setErrors(translateFormErrors(validationErrors, tValidation))
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      // Calculate trial expiry: 60 days from now
      const trialExpiresAt = new Date()
      trialExpiresAt.setDate(trialExpiresAt.getDate() + 60)

      // 1. Create auth user. La lingua scelta viene salvata nei metadata
      //    utente: serve alle email (template Supabase) e all'app.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          data: {
            nome: formData.nome.trim(),
            cognome: formData.cognome.trim(),
            professione: formData.professione,
            nome_studio: formData.nomeStudio.trim() || null,
            locale,
          },
        },
      })

      if (authError) {
        const key = supabaseAuthErrorKey(authError)
        if (key === 'alreadyRegistered') {
          setErrors({ email: tSupabase(key) })
        } else if (key === 'weakPassword') {
          setErrors({ password: tSupabase(key) })
        } else {
          setErrors({ general: tSupabase(key) })
        }
        setLoading(false)
        return
      }

      if (!authData.user) {
        setErrors({ general: t('createFailed') })
        setLoading(false)
        return
      }

      // 2. Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          nome: formData.nome.trim(),
          cognome: formData.cognome.trim(),
          email: formData.email.trim().toLowerCase(),
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        // Non-blocking: profile can be created later
      }

      // 3. Create/update professional_profiles with trial info
      const { error: profError } = await supabase
        .from('professional_profiles')
        .upsert({
          id: authData.user.id,
          professione: formData.professione,
          nome_studio: formData.nomeStudio.trim() || null,
          trial_expires_at: trialExpiresAt.toISOString(),
        })

      if (profError) {
        console.error('Professional profile error:', profError)
        // Non-blocking
      }

      // 4. Redirect to confirmation page
      router.push('/registrazione/conferma')

    } catch (err) {
      console.error('Registration error:', err)
      setErrors({ general: tSupabase('generic') })
    } finally {
      setLoading(false)
    }
  }

  const required = <span className="text-red-400" aria-hidden="true">*</span>

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 stagger-children">
      {/* General error */}
      {errors.general && (
        <div className="px-4 py-3 bg-red-50 border-l-4 border-red-400 rounded-lg text-sm text-red-700 flex items-start gap-3" role="alert">
          <span aria-hidden="true" className="text-lg leading-none mt-0.5">⚠️</span>
          <span>{errors.general}</span>
        </div>
      )}

      {/* Nome + Cognome */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="nome" className="input-label">
            {t('firstName')} {required}
          </label>
          <input
            id="nome"
            type="text"
            autoComplete="given-name"
            required
            value={formData.nome}
            onChange={e => updateField('nome', e.target.value)}
            className={`input-field ${errors.nome ? inputErrorClass : ''}`}
            placeholder={t('firstNamePlaceholder')}
          />
          {errors.nome && <p className="input-error">{errors.nome}</p>}
        </div>
        <div>
          <label htmlFor="cognome" className="input-label">
            {t('lastName')} {required}
          </label>
          <input
            id="cognome"
            type="text"
            autoComplete="family-name"
            required
            value={formData.cognome}
            onChange={e => updateField('cognome', e.target.value)}
            className={`input-field ${errors.cognome ? inputErrorClass : ''}`}
            placeholder={t('lastNamePlaceholder')}
          />
          {errors.cognome && <p className="input-error">{errors.cognome}</p>}
        </div>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="input-label">
          {t('email')} {required}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={formData.email}
          onChange={e => updateField('email', e.target.value)}
          className={`input-field ${errors.email ? inputErrorClass : ''}`}
          placeholder={t('emailPlaceholder')}
        />
        {errors.email && <p className="input-error">{errors.email}</p>}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="input-label">
          {t('password')} {required}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={formData.password}
          onChange={e => updateField('password', e.target.value)}
          className={`input-field ${errors.password ? inputErrorClass : ''}`}
          placeholder={t('passwordPlaceholder')}
        />
        {errors.password && <p className="input-error">{errors.password}</p>}
      </div>

      {/* Conferma Password */}
      <div>
        <label htmlFor="confermaPassword" className="input-label">
          {t('confirmPassword')} {required}
        </label>
        <input
          id="confermaPassword"
          type="password"
          autoComplete="new-password"
          required
          value={formData.confermaPassword}
          onChange={e => updateField('confermaPassword', e.target.value)}
          className={`input-field ${errors.confermaPassword ? inputErrorClass : ''}`}
          placeholder={t('confirmPasswordPlaceholder')}
        />
        {errors.confermaPassword && <p className="input-error">{errors.confermaPassword}</p>}
      </div>

      {/* Professione */}
      <div>
        <label htmlFor="professione" className="input-label">
          {t('profession')} {required}
        </label>
        <select
          id="professione"
          required
          value={formData.professione}
          onChange={e => updateField('professione', e.target.value)}
          className={`input-field ${!formData.professione ? 'text-anthracite-lighter' : ''} ${errors.professione ? inputErrorClass : ''}`}
        >
          <option value="" disabled>
            {t('professionPlaceholder')}
          </option>
          {PROFESSION_VALUES.map(value => (
            <option key={value} value={value}>
              {t(`professions.${value}`)}
            </option>
          ))}
        </select>
        {errors.professione && <p className="input-error">{errors.professione}</p>}
      </div>

      {/* Nome Studio (opzionale) */}
      <div>
        <label htmlFor="nomeStudio" className="input-label">
          {t('studioName')} <span className="text-anthracite-lighter font-normal">({tCommon('optional')})</span>
        </label>
        <input
          id="nomeStudio"
          type="text"
          autoComplete="organization"
          value={formData.nomeStudio}
          onChange={e => updateField('nomeStudio', e.target.value)}
          className="input-field"
          placeholder={t('studioNamePlaceholder')}
        />
      </div>

      {/* Privacy consent */}
      <p className="text-xs text-anthracite-lighter leading-relaxed">
        {t.rich('consent', {
          terms: (chunks) => (
            <Link href="/termini" className="text-teal hover:text-teal-dark underline underline-offset-2">
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href="/privacy" className="text-teal hover:text-teal-dark underline underline-offset-2">
              {chunks}
            </Link>
          ),
        })}
      </p>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full text-base py-3.5"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            {t('submitting')}
          </span>
        ) : (
          t('submit')
        )}
      </button>
    </form>
  )
}
