'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'

const ANCHORS = [
  { href: '#come-funziona', label: 'Come funziona' },
  { href: '#benefici', label: 'Funzionalità' },
  { href: '#prezzi', label: 'Prezzi' },
  { href: '#faq', label: 'FAQ' },
] as const

function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 group" aria-label="Stress Index — Home">
      <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="text-lg font-semibold tracking-tight text-anthracite">Stress Index</span>
    </Link>
  )
}

// Navbar della homepage con menu hamburger su mobile (la homepage usa una sua
// barra dedicata, separata dall'Header condiviso delle altre pagine).
export function HomeNavbar() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
        <Logo />

        <nav className="hidden md:flex items-center gap-1 text-[14px] text-anthracite-light">
          {ANCHORS.map((a) => (
            <a key={a.href} href={a.href} className="px-3 py-2 rounded-md hover:text-teal transition-colors">{a.label}</a>
          ))}
          <Link href="/guide" className="px-3 py-2 rounded-md hover:text-teal transition-colors">Guide</Link>
          <Link href="/area-professionisti/login" className="px-3 py-2 rounded-md hover:text-teal transition-colors">Area Professionisti</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/registrazione"
            className="inline-flex items-center justify-center px-3.5 sm:px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-dark transition-colors"
          >
            Inizia gratis
          </Link>
          <button
            type="button"
            aria-label={open ? 'Chiudi menu' : 'Apri menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="md:hidden w-10 h-10 -mr-1 rounded-lg flex items-center justify-center text-anthracite hover:bg-surface transition-colors"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="md:hidden fixed inset-0 top-16 bg-anthracite/30 backdrop-blur-sm z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <nav className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-100 shadow-elevated z-50 px-5 py-4">
            <ul className="flex flex-col gap-1">
              {ANCHORS.map((a) => (
                <li key={a.href}>
                  <a href={a.href} onClick={() => setOpen(false)} className="block px-3 py-3 rounded-lg text-base font-medium text-anthracite hover:bg-surface transition-colors">{a.label}</a>
                </li>
              ))}
              <li>
                <Link href="/guide" onClick={() => setOpen(false)} className="block px-3 py-3 rounded-lg text-base font-medium text-anthracite hover:bg-surface transition-colors">Guide</Link>
              </li>
              <li className="pt-2 mt-2 border-t border-gray-100">
                <Link href="/area-professionisti/login" onClick={() => setOpen(false)} className="block px-3 py-3 rounded-lg text-base font-medium text-anthracite hover:bg-surface transition-colors">Area Professionisti</Link>
              </li>
            </ul>
          </nav>
        </>
      )}
    </header>
  )
}
