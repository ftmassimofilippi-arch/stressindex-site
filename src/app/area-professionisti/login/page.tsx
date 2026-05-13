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
    <div className="min-h-screen flex flex-col lg:flex-row">
      <section
        className="lg:w-1/2 px-8 sm:px-12 lg:px-16 py-12 lg:py-0 flex items-center justify-center text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #4FA39A 0%, #2E746C 100%)' }}
      >
        <div className="max-w-md">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-12 group">
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight">Stress Index</span>
          </Link>
          <h1 className="font-serif text-4xl lg:text-5xl leading-tight">
            Il tuo studio.<br />
            <em className="font-serif italic">Sempre con te.</em>
          </h1>
          <p className="mt-6 text-white/85 text-base leading-relaxed">
            Accedi alla tua area professionisti per monitorare i clienti, leggere le misurazioni HRV, esportare report.
          </p>

          <div className="mt-12 space-y-4 text-sm text-white/85">
            <div className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-white/70" /> Dashboard clinica multi-cliente</div>
            <div className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-white/70" /> Alert intelligenti su soglie e trend</div>
            <div className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-white/70" /> Report PDF brandizzati</div>
          </div>
        </div>

        <div className="hidden lg:block absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        <div className="hidden lg:block absolute -top-10 -left-10 w-60 h-60 rounded-full bg-white/10 blur-3xl" />
      </section>

      <section className="lg:w-1/2 flex items-center justify-center px-6 sm:px-12 py-12 bg-surface">
        <div className="w-full max-w-sm">
          <h2 className="font-serif text-3xl text-anthracite">Area Professionisti</h2>
          <p className="text-sm text-anthracite-lighter mt-1.5">Accedi con le credenziali della tua app</p>

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
      </section>
    </div>
  )
}
