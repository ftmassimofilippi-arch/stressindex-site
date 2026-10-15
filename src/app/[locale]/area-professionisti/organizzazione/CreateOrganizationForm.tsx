'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Building2 } from 'lucide-react'
import { apiErrorMessage } from '@/lib/api-error'

export function CreateOrganizationForm() {
  const t = useTranslations('organization.form')
  const tErr = useTranslations('errors.api')
  const router = useRouter()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Un solo POST in volo: il doppio click del 27/05 ha creato tre organizzazioni.
  const inFlight = useRef(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (inFlight.current) return
    const trimmed = name.trim()
    if (!trimmed) return
    inFlight.current = true
    setErr(null)
    setSaving(true)
    let ok = false
    try {
      const res = await fetch('/api/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErr(apiErrorMessage(data, tErr, t('error')))
        return
      }
      ok = true
      // `saving` resta true: la pagina viene rimontata dal server con l'organizzazione.
      router.refresh()
    } catch {
      setErr(tErr('network'))
    } finally {
      if (!ok) {
        setSaving(false)
        inFlight.current = false
      }
    }
  }

  return (
    <section className="card p-6 max-w-2xl">
      <div className="w-12 h-12 rounded-xl bg-teal-light text-teal-dark flex items-center justify-center mb-4">
        <Building2 size={22} />
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="input-label">{t('name')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('placeholder')}
            className="input-field"
            autoFocus
            required
            disabled={saving}
          />
        </div>
        {err && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="btn-primary text-sm"
        >
          {saving ? t('creating') : t('create')}
        </button>
      </form>
    </section>
  )
}
