'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'

export function CreateOrganizationForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!name.trim()) return
    setSaving(true)
    const res = await fetch('/api/organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setErr(data?.error ?? 'Errore nella creazione')
      return
    }
    router.refresh()
  }

  return (
    <section className="card p-6 max-w-2xl">
      <div className="w-12 h-12 rounded-xl bg-teal-light text-teal-dark flex items-center justify-center mb-4">
        <Building2 size={22} />
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="input-label">Nome organizzazione</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. Centro Medico Aurora"
            className="input-field"
            autoFocus
            required
          />
        </div>
        {err && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="btn-primary text-sm"
        >
          {saving ? 'Creazione…' : 'Crea organizzazione'}
        </button>
      </form>
    </section>
  )
}
