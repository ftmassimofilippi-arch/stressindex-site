'use client'

import { Bell } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useMemo } from 'react'
import { GlobalSearch } from './GlobalSearch'

const SEGMENT_LABEL: Record<string, string> = {
  'area-professionisti': 'Area Professionisti',
  clienti: 'Clienti',
  analytics: 'Analytics',
  impostazioni: 'Impostazioni',
  misurazione: 'Misurazione',
}

export function TopBar({ alertCount = 0 }: { alertCount?: number }) {
  const pathname = usePathname()

  const breadcrumbs = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean)
    return parts.map((seg, i) => {
      const href = '/' + parts.slice(0, i + 1).join('/')
      const label = SEGMENT_LABEL[seg] ?? seg
      return { href, label }
    })
  }, [pathname])

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

          <button
            type="button"
            aria-label={`Notifiche${alertCount ? ` (${alertCount} nuove)` : ''}`}
            className="relative w-10 h-10 rounded-xl hover:bg-surface flex items-center justify-center text-anthracite-lighter hover:text-anthracite transition-colors flex-shrink-0"
          >
            <Bell size={18} />
            {alertCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
