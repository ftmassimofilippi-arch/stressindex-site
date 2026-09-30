'use client'

import { Suspense, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { GlobalSearch } from './GlobalSearch'
import { NotificationsBell } from './NotificationsBell'

// Segmento di URL → chiave in dashboard.breadcrumb. Gli slug restano italiani
// in tutte le lingue; i segmenti non elencati (id di clienti e sessioni)
// si mostrano com'è.
const SEGMENT_KEY: Record<string, string> = {
  'area-professionisti': 'areaProfessionisti',
  clienti: 'clienti',
  analytics: 'analytics',
  impostazioni: 'impostazioni',
  misurazione: 'misurazione',
  monitoraggio: 'monitoraggio',
  sport: 'sport',
  'team-live': 'teamLive',
  atleta: 'atleta',
  sessione: 'sessione',
  organizzazione: 'organizzazione',
  professionisti: 'professionisti',
}

export function TopBar({ alertCount = 0 }: { alertCount?: number }) {
  const t = useTranslations('dashboard.breadcrumb')
  // `usePathname` di @/i18n/navigation restituisce il percorso senza prefisso di lingua.
  const pathname = usePathname()

  const breadcrumbs = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean)
    return parts.map((seg, i) => {
      const href = '/' + parts.slice(0, i + 1).join('/')
      const key = SEGMENT_KEY[seg]
      return { href, label: key ? t(key) : seg }
    })
  }, [pathname, t])

  return (
    <div className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-surface-border">
      {/* pl-16 su mobile lascia spazio al pulsante hamburger (fixed top-left) */}
      <div className="h-16 pl-16 pr-4 lg:pl-8 sm:pr-8 flex items-center justify-between gap-3">
        <nav className="hidden lg:flex items-center gap-1.5 text-sm text-anthracite-lighter min-w-0">
          {breadcrumbs.map((b, i) => (
            <span key={b.href} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <span className="opacity-50">/</span>}
              {i === breadcrumbs.length - 1 ? (
                <span className="text-anthracite font-medium truncate">{b.label}</span>
              ) : (
                <Link href={b.href} className="hover:text-teal transition-colors truncate">
                  {b.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-auto min-w-0 flex-1 lg:flex-initial justify-end">
          <GlobalSearch className="w-full max-w-xs sm:w-72" />

          <NotificationsBell alertCount={alertCount} />

          {/* Lo switcher legge i query param: Suspense evita il bail-out del
              rendering statico quando la TopBar finisce in una pagina non dinamica. */}
          <Suspense fallback={null}>
            <LanguageSwitcher className="flex-shrink-0 pl-1" />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
