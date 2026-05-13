import type { Metadata } from 'next'
import Link from 'next/link'
import { RecoverForm } from './RecoverForm'

export const metadata: Metadata = {
  title: 'Recupera password',
  robots: { index: false, follow: false },
}

export default function RecuperaPasswordPage() {
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
            Recupera <em className="font-serif italic">l&apos;accesso.</em>
          </h1>
          <p className="mt-6 text-white/85 text-base leading-relaxed">
            Inserisci la tua email e riceverai un link per reimpostare la password.
          </p>
        </div>
      </section>

      <section className="lg:w-1/2 flex items-center justify-center px-6 sm:px-12 py-12 bg-surface">
        <div className="w-full max-w-sm">
          <h2 className="font-serif text-3xl text-anthracite">Password dimenticata</h2>
          <p className="text-sm text-anthracite-lighter mt-1.5">Ti invieremo un&apos;email con il link di recupero</p>
          <div className="mt-8">
            <RecoverForm />
          </div>
          <p className="mt-8 text-sm text-anthracite-lighter text-center">
            <Link href="/area-professionisti/login" className="text-teal-dark font-medium hover:underline">
              ← Torna al login
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
