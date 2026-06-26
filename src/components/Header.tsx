'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { href: '/funzionalita', label: 'Funzionalità' },
  { href: '/sport', label: 'Sport', badge: 'Nuovo' },
  { href: '/guide', label: 'Guide' },
] as const

export function Header() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Chiudi il menu mobile quando cambia pagina.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Blocca lo scroll del body quando il menu mobile è aperto.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [open])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-lg font-semibold text-anthracite tracking-tight">
            Stress Index
          </span>
        </Link>

        {/* Nav desktop */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-anthracite-light hover:text-teal transition-colors px-3 py-2 rounded-md"
            >
              {l.label}
              {'badge' in l && l.badge && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-teal text-white text-[10px] font-semibold uppercase tracking-wider">
                  {l.badge}
                </span>
              )}
            </Link>
          ))}
          <Link
            href="/area-professionisti/login"
            className="text-sm font-medium text-anthracite-light hover:text-teal transition-colors px-3 py-2 rounded-md"
          >
            Area Professionisti
          </Link>
          <Link
            href="/registrazione"
            className="ml-2 inline-flex items-center justify-center px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-dark transition-colors"
          >
            Prova gratuita
          </Link>
        </nav>

        {/* Azioni mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            href="/registrazione"
            className="inline-flex items-center justify-center px-3.5 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-dark transition-colors"
          >
            Prova gratuita
          </Link>
          <button
            type="button"
            aria-label={open ? 'Chiudi menu' : 'Apri menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="w-10 h-10 -mr-1 rounded-lg flex items-center justify-center text-anthracite hover:bg-surface transition-colors"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Pannello menu mobile */}
      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 top-16 bg-anthracite/30 backdrop-blur-sm z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-100 shadow-elevated z-50 px-5 py-4">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="flex items-center gap-2 px-3 py-3 rounded-lg text-base font-medium text-anthracite hover:bg-surface transition-colors"
                  >
                    {l.label}
                    {'badge' in l && l.badge && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-teal text-white text-[10px] font-semibold uppercase tracking-wider">
                        {l.badge}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
              <li className="pt-2 mt-2 border-t border-gray-100">
                <Link
                  href="/area-professionisti/login"
                  className="flex items-center px-3 py-3 rounded-lg text-base font-medium text-anthracite hover:bg-surface transition-colors"
                >
                  Area Professionisti
                </Link>
              </li>
            </ul>
          </nav>
        </>
      )}
    </header>
  )
}
