'use client'

import { useTranslations } from 'next-intl'
import { initials } from '@/lib/format'
import type { OrganizationMember } from '@/lib/dashboard-data'

export function MemberView({ members }: { members: OrganizationMember[] }) {
  const t = useTranslations('organization')
  const active = members.filter((m) => m.status === 'active')
  return (
    <section className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-border">
        <h2 className="font-serif text-lg text-anthracite">{t('memberView.title')}</h2>
        <p className="text-xs text-anthracite-lighter mt-1">{t('memberView.count', { count: active.length })}</p>
      </div>
      <ul className="divide-y divide-surface-border">
        {active.map((m) => (
          <li key={m.id} className="px-6 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-light text-teal-dark flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {initials({ nome: m.email.split('@')[0]?.[0], cognome: '' })}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-anthracite truncate">{m.email}</div>
              <div className="text-xs text-anthracite-lighter">{t(`roles.${m.role}`)}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
