'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Crown, Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/lib/api-error'

type Plan = 'base' | 'pro'

function normalize(plan: string | null | undefined): Plan {
  return plan === 'pro' ? 'pro' : 'base'
}

// Badge piano + toggle Base/Pro riservato al superadmin. Al click chiede conferma,
// chiama PATCH /api/admin/plan e aggiorna la UI (refresh dei dati server-side).
export function PlanToggle({
  userId,
  name,
  plan: initialPlan,
  size = 'sm',
}: {
  userId: string
  name: string
  plan: string | null
  size?: 'sm' | 'md'
}) {
  const t = useTranslations('admin.planToggle')
  const tErr = useTranslations('errors.api')
  const router = useRouter()
  const [plan, setPlan] = useState<Plan>(normalize(initialPlan))
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const isPro = plan === 'pro'

  async function toggle() {
    const next: Plan = isPro ? 'base' : 'pro'
    const ok = window.confirm(next === 'pro' ? t('confirmPro', { name }) : t('confirmBase', { name }))
    if (!ok) return

    setBusy(true)
    try {
      const res = await fetch('/api/admin/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plan: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        window.alert(t('updateFailed', { error: apiErrorMessage(j, tErr, String(res.status)) }))
        return
      }
      setPlan(next)
      startTransition(() => router.refresh())
    } catch {
      window.alert(t('networkError'))
    } finally {
      setBusy(false)
    }
  }

  const loading = busy || pending
  const badgeCls = isPro
    ? 'bg-teal-50 text-teal-dark border-teal-200'
    : 'bg-surface text-anthracite-lighter border-surface-border'
  const pad = size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'

  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <span className={`inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap ${pad} ${badgeCls}`}>
        {isPro && <Crown size={size === 'md' ? 14 : 12} />}
        {isPro ? t('pro') : t('base')}
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={`inline-flex items-center gap-1 rounded-lg border font-medium transition-colors disabled:opacity-50 whitespace-nowrap ${pad} ${
          isPro
            ? 'border-surface-border text-anthracite-lighter hover:bg-surface'
            : 'border-teal-dark text-teal-dark hover:bg-teal-50'
        }`}
        title={isPro ? t('toBase') : t('toPro')}
      >
        {loading ? (
          <Loader2 size={size === 'md' ? 14 : 12} className="animate-spin" />
        ) : isPro ? (
          t('disablePro')
        ) : (
          t('enablePro')
        )}
      </button>
    </div>
  )
}
