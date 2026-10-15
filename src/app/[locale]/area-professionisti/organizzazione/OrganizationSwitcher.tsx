'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Building2, Check } from 'lucide-react'
import { apiErrorMessage } from '@/lib/api-error'
import type { OrganizationWithRole } from '@/lib/dashboard-data'

type Props = {
  organizations: OrganizationWithRole[]
  activeId: string
}

// Selettore fra le organizzazioni dell'utente (compare solo se sono più di una).
// Il cambio scrive `profiles.organization_id` via PATCH /api/organization/active
// e rimonta la pagina con router.refresh().
export function OrganizationSwitcher({ organizations, activeId }: Props) {
  const t = useTranslations('organization.switcher')
  const tRoles = useTranslations('organization.roles')
  const tErr = useTranslations('errors.api')
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const inFlight = useRef(false)

  async function activate(id: string) {
    if (id === activeId || inFlight.current) return
    inFlight.current = true
    setErr(null)
    setBusyId(id)
    let ok = false
    try {
      const res = await fetch('/api/organization/active', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErr(apiErrorMessage(data, tErr))
        return
      }
      ok = true
      // `busyId` resta: la pagina viene rimontata dal server con la nuova attiva.
      router.refresh()
    } catch {
      setErr(tErr('network'))
    } finally {
      if (!ok) {
        setBusyId(null)
        inFlight.current = false
      }
    }
  }

  return (
    <section className="card p-4 sm:p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Building2 size={16} className="text-teal" />
        <h2 className="font-serif text-base text-anthracite">{t('title')}</h2>
      </div>
      <p className="text-xs text-anthracite-lighter mb-3">{t('intro', { count: organizations.length })}</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {organizations.map((o) => {
          const isActive = o.id === activeId
          const isBusy = busyId === o.id
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => activate(o.id)}
                disabled={isActive || busyId !== null}
                aria-pressed={isActive}
                className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                  isActive
                    ? 'border-teal bg-teal-light/40 cursor-default'
                    : 'border-surface-border hover:border-teal hover:bg-surface disabled:opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-anthracite truncate">{o.name}</div>
                    <div className="text-xs text-anthracite-lighter mt-0.5 flex flex-wrap gap-x-2">
                      <span>{tRoles(o.my_role)}</span>
                      {o.active_members !== null && (
                        <span>{t('members', { count: o.active_members })}</span>
                      )}
                    </div>
                  </div>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-dark whitespace-nowrap">
                      <Check size={13} /> {t('active')}
                    </span>
                  ) : (
                    <span className="text-[11px] text-anthracite-lighter whitespace-nowrap">
                      {isBusy ? t('switching') : t('switch')}
                    </span>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
      {err && <div className="mt-3 px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
    </section>
  )
}
