'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Globe, User } from 'lucide-react'
import type { DataScope } from '@/lib/data-scope'

// Interruttore "I miei dati / Tutta la piattaforma" per il superadmin
// (data-scope.ts). Scrive il cookie tramite /api/scope e ricarica i dati del
// server; non compare ai professionisti normali.
export function ScopeSwitch({ scope }: { scope: DataScope }) {
  const t = useTranslations('dashboard.scope')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function change(next: DataScope) {
    if (next === scope || pending) return
    setError(null)
    const res = await fetch('/api/scope', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: next }),
    }).catch(() => null)
    if (!res || !res.ok) {
      setError(t('switchError'))
      return
    }
    startTransition(() => router.refresh())
  }

  const btn = (active: boolean) =>
    `inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
      active ? 'bg-anthracite text-white' : 'text-anthracite-lighter hover:text-anthracite'
    }`

  return (
    <div className="flex items-center gap-1.5" title={error ?? t('label')}>
      <div
        role="group"
        aria-label={t('label')}
        className={`inline-flex items-center p-0.5 rounded-lg border ${scope === 'all' ? 'border-rose-300 bg-rose-50' : 'border-surface-border bg-white'} ${pending ? 'opacity-60' : ''}`}
      >
        <button type="button" onClick={() => change('mine')} aria-pressed={scope === 'mine'} className={btn(scope === 'mine')}>
          <User size={12} /> <span className="hidden sm:inline">{t('mine')}</span>
        </button>
        <button type="button" onClick={() => change('all')} aria-pressed={scope === 'all'} className={btn(scope === 'all')}>
          <Globe size={12} /> <span className="hidden sm:inline">{t('all')}</span>
        </button>
      </div>
      {scope === 'all' && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold tracking-wider whitespace-nowrap">
          {t('badge')}
        </span>
      )}
    </div>
  )
}
