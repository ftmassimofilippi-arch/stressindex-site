import type { Metadata } from 'next'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { RegistrationForm } from './RegistrationForm'

export const metadata: Metadata = {
  title: 'Registrazione Trial Gratuito 90 Giorni',
  description:
    'Registrati per provare Stress Index gratuitamente per 90 giorni. Nessuna carta di credito richiesta. Per medici, fisioterapisti, osteopati e coach.',
}

export default function RegistrazionePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-surface pt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-xl mx-auto">
            {/* Header section */}
            <div className="text-center mb-10 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-light text-teal-dark text-sm font-medium rounded-full mb-6">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                </svg>
                Trial gratuito 90 giorni
              </div>

              <h1 className="text-3xl sm:text-4xl font-semibold text-anthracite tracking-tight mb-3">
                Inizia a misurare
              </h1>
              
              <p className="text-anthracite-lighter text-lg leading-relaxed">
                Crea il tuo account professionale e accedi a tutte le funzionalità 
                di Stress Index per 90 giorni, senza impegno.
              </p>
            </div>

            {/* Form card */}
            <div className="card p-6 sm:p-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <RegistrationForm />
            </div>

            {/* Trust signals */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-anthracite-lighter animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-teal">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Dati protetti GDPR
              </div>
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-teal">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Server EU Frankfurt
              </div>
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-teal">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Nessuna carta richiesta
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
