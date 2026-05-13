'use client'

import { Bell, Search } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useMemo } from 'react'

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
      <div className="h-16 px-4 sm:px-8 flex items-center justify-between gap-4">
        <nav className="hidden sm:flex items-center gap-1.5 text-sm text-anthracite-lighter min-w-0">
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

        <div className="flex items-center gap-2 ml-auto">
          <div className="relative hidden md:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-anthracite-lighter" />
            <input
              type="search"
              placeholder="Cerca clienti, misurazioni..."
              disabled
              className="w-72 pl-9 pr-3 py-2 text-sm bg-surface border border-surface-border rounded-xl placeholder:text-anthracite-lighter disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <button
            type="button"
            aria-label={`Notifiche${alertCount ? ` (${alertCount} nuove)` : ''}`}
            className="relative w-10 h-10 rounded-xl hover:bg-surface flex items-center justify-center text-anthracite-lighter hover:text-anthracite transition-colors"
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
