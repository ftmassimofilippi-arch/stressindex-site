import type { Metadata } from 'next'
import { LoginForm } from './LoginForm'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Accedi',
  robots: { index: false, follow: false },
}

export default function LoginPage({ searchParams }: { searchParams: { redirect?: string } }) {
  const redirectTo = searchParams.redirect ?? '/area-professionisti'

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar minimale */}
      <header className="border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-lg font-semibold text-anthracite tracking-tight">Stress Index</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider mb-4">
            <span aria-hidden="true">🔐</span>
            <span>Area Professionisti</span>
          </div>
          <h1 className="font-serif text-4xl text-anthracite tracking-tight">
            Accedi
          </h1>
          <p className="mt-3 text-anthracite-light">
            Inserisci le credenziali della tua app per accedere alla dashboard clinica.
          </p>

          <div className="mt-8">
            <LoginForm redirectTo={redirectTo} />
          </div>

          <p className="mt-8 text-sm text-anthracite-lighter text-center">
            Non hai ancora un account?{' '}
            <Link href="/registrazione" className="text-teal-dark font-medium hover:underline">
              Inizia gratis →
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
