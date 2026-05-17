'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export function RecoverForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email) { setError('Inserisci la tua email'); return }
    setLoading(true)
    const supabase = createClient()
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/area-professionisti/login`,
    })
    setLoading(false)
    if (authError) { setError(authError.message); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="px-4 py-3 rounded-lg bg-teal-light/60 border-l-4 border-teal text-sm text-anthracite flex items-start gap-3">
        <span aria-hidden="true" className="text-lg leading-none mt-0.5">✉️</span>
        <span>Ti abbiamo inviato un&apos;email con le istruzioni per reimpostare la password. Controlla anche la cartella spam.</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="input-label">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
          placeholder="nome@studio.it"
        />
      </div>
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm border-l-4 border-red-400 flex items-start gap-3">
          <span aria-hidden="true" className="text-lg leading-none mt-0.5">⚠️</span>
          <span>{error}</span>
        </div>
      )}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Invio in corso…' : 'Invia link di recupero'}
      </button>
    </form>
  )
}
