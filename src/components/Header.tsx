'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export function Header() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-lg font-semibold text-anthracite tracking-tight">
            Stress Index
          </span>
        </Link>

        <nav className="hidden sm:flex items-center gap-1 sm:gap-2">
          <Link
            href="/guide"
            className="text-sm font-medium text-anthracite-light hover:text-teal transition-colors px-3 py-2 rounded-md"
          >
            Guide
          </Link>
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

        <button
          type="button"
          aria-label={open ? 'Chiudi menu' : 'Apri menu'}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
          className="sm:hidden inline-flex items-center justify-center w-10 h-10 rounded-md text-anthracite hover:bg-gray-100 transition-colors"
        >
          {open ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <>
          <button
            type="button"
            aria-label="Chiudi menu"
            onClick={() => setOpen(false)}
            className="sm:hidden fixed inset-0 top-16 bg-black/20 z-40"
          />
          <div
            id="mobile-nav"
            className="sm:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-100 shadow-lg z-50"
          >
            <nav className="flex flex-col px-6 py-4 gap-1">
              <Link
                href="/guide"
                className="text-base font-medium text-anthracite-light hover:text-teal hover:bg-gray-50 transition-colors px-3 py-3 rounded-md"
              >
                Guide
              </Link>
              <Link
                href="/area-professionisti/login"
                className="text-base font-medium text-anthracite-light hover:text-teal hover:bg-gray-50 transition-colors px-3 py-3 rounded-md"
              >
                Area Professionisti
              </Link>
              <Link
                href="/registrazione"
                className="mt-2 inline-flex items-center justify-center px-4 py-3 bg-teal text-white text-base font-medium rounded-lg hover:bg-teal-dark transition-colors"
              >
                Prova gratuita
              </Link>
            </nav>
          </div>
        </>
      )}
    </header>
  )
}
