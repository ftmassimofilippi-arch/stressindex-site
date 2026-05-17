'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { validateRegistrationForm, hasErrors, type FormErrors } from '@/lib/validation'

const PROFESSIONI = [
  { value: '', label: 'Seleziona la tua professione' },
  { value: 'medico', label: 'Medico' },
  { value: 'fisioterapista', label: 'Fisioterapista' },
  { value: 'osteopata', label: 'Osteopata' },
  { value: 'coach', label: 'Coach' },
  { value: 'altro', label: 'Altro' },
]

export function RegistrationForm() {
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
      setErrors(validationErrors)
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      // Calculate trial expiry: 90 days from now
      const trialExpiresAt = new Date()
      trialExpiresAt.setDate(trialExpiresAt.getDate() + 90)

      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          data: {
            nome: formData.nome.trim(),
            cognome: formData.cognome.trim(),
            professione: formData.professione,
            nome_studio: formData.nomeStudio.trim() || null,
          },
        },
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          setErrors({ email: 'Questa email è già registrata. Prova ad accedere.' })
        } else if (authError.message.includes('password')) {
          setErrors({ password: 'La password deve avere almeno 8 caratteri.' })
        } else {
          setErrors({ general: authError.message })
        }
        setLoading(false)
        return
      }

      if (!authData.user) {
        setErrors({ general: 'Errore nella creazione dell\'account. Riprova.' })
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
      setErrors({ general: 'Si è verificato un errore. Riprova tra qualche istante.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 stagger-children">
      {/* General error */}
      {errors.general && (
        <div className="px-4 py-3 bg-red-50 border-l-4 border-red-400 rounded-lg text-sm text-red-700 flex items-start gap-3">
          <span aria-hidden="true" className="text-lg leading-none mt-0.5">⚠️</span>
          <span>{errors.general}</span>
        </div>
      )}

      {/* Nome + Cognome */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="nome" className="input-label">
            Nome <span className="text-red-400">*</span>
          </label>
          <input
            id="nome"
            type="text"
            autoComplete="given-name"
            value={formData.nome}
            onChange={e => updateField('nome', e.target.value)}
            className={`input-field ${errors.nome ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : ''}`}
            placeholder="Mario"
          />
          {errors.nome && <p className="input-error">{errors.nome}</p>}
        </div>
        <div>
          <label htmlFor="cognome" className="input-label">
            Cognome <span className="text-red-400">*</span>
          </label>
          <input
            id="cognome"
            type="text"
            autoComplete="family-name"
            value={formData.cognome}
            onChange={e => updateField('cognome', e.target.value)}
            className={`input-field ${errors.cognome ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : ''}`}
            placeholder="Rossi"
          />
          {errors.cognome && <p className="input-error">{errors.cognome}</p>}
        </div>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="input-label">
          Email professionale <span className="text-red-400">*</span>
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={formData.email}
          onChange={e => updateField('email', e.target.value)}
          className={`input-field ${errors.email ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : ''}`}
          placeholder="mario.rossi@studio.it"
        />
        {errors.email && <p className="input-error">{errors.email}</p>}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="input-label">
          Password <span className="text-red-400">*</span>
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={formData.password}
          onChange={e => updateField('password', e.target.value)}
          className={`input-field ${errors.password ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : ''}`}
          placeholder="Minimo 8 caratteri"
        />
        {errors.password && <p className="input-error">{errors.password}</p>}
      </div>

      {/* Conferma Password */}
      <div>
        <label htmlFor="confermaPassword" className="input-label">
          Conferma password <span className="text-red-400">*</span>
        </label>
        <input
          id="confermaPassword"
          type="password"
          autoComplete="new-password"
          value={formData.confermaPassword}
          onChange={e => updateField('confermaPassword', e.target.value)}
          className={`input-field ${errors.confermaPassword ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : ''}`}
          placeholder="Ripeti la password"
        />
        {errors.confermaPassword && <p className="input-error">{errors.confermaPassword}</p>}
      </div>

      {/* Professione */}
      <div>
        <label htmlFor="professione" className="input-label">
          Professione <span className="text-red-400">*</span>
        </label>
        <select
          id="professione"
          value={formData.professione}
          onChange={e => updateField('professione', e.target.value)}
          className={`input-field ${!formData.professione ? 'text-anthracite-lighter' : ''} ${errors.professione ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : ''}`}
        >
          {PROFESSIONI.map(p => (
            <option key={p.value} value={p.value} disabled={p.value === ''}>
              {p.label}
            </option>
          ))}
        </select>
        {errors.professione && <p className="input-error">{errors.professione}</p>}
      </div>

      {/* Nome Studio (opzionale) */}
      <div>
        <label htmlFor="nomeStudio" className="input-label">
          Nome studio <span className="text-anthracite-lighter font-normal">(opzionale)</span>
        </label>
        <input
          id="nomeStudio"
          type="text"
          autoComplete="organization"
          value={formData.nomeStudio}
          onChange={e => updateField('nomeStudio', e.target.value)}
          className="input-field"
          placeholder="Studio Benessere Milano"
        />
      </div>

      {/* Privacy consent */}
      <p className="text-xs text-anthracite-lighter leading-relaxed">
        Registrandoti accetti i{' '}
        <a href="/termini" className="text-teal hover:text-teal-dark underline underline-offset-2">
          Termini di Servizio
        </a>{' '}
        e la{' '}
        <a href="/privacy" className="text-teal hover:text-teal-dark underline underline-offset-2">
          Privacy Policy
        </a>
        . I tuoi dati sono protetti e conservati su server EU in conformità al GDPR.
      </p>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full text-base py-3.5"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            Creazione account in corso...
          </span>
        ) : (
          'Crea il tuo account gratuito'
        )}
      </button>
    </form>
  )
}
