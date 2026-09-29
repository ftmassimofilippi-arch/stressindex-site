import type { Metadata } from 'next'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { RegistrationForm } from './RegistrationForm'

export const metadata: Metadata = {
  title: 'Prova Gratis 60 Giorni | Stress Index',
  description:
    'Registrati e prova Stress Index gratis per 60 giorni. Tutte le funzionalità, nessun vincolo. Per fisioterapisti e professionisti.',
  alternates: { canonical: 'https://stressindex.io/registrazione' },
  openGraph: {
    title: 'Prova Gratis 60 Giorni | Stress Index',
    description:
      'Registrati e prova Stress Index gratis per 60 giorni. Tutte le funzionalità, nessun vincolo. Per fisioterapisti e professionisti.',
    url: 'https://stressindex.io/registrazione',
    siteName: 'Stress Index',
    locale: 'it_IT',
    type: 'website',
    images: [{ url: 'https://stressindex.io/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prova Gratis 60 Giorni | Stress Index',
    description:
      'Registrati e prova Stress Index gratis per 60 giorni. Tutte le funzionalità, nessun vincolo.',
    images: ['https://stressindex.io/og-image.png'],
  },
}

export default function RegistrazionePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white pt-16">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
          <div className="max-w-xl mx-auto">
            {/* Header section */}
            <div className="mb-10">
              <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider mb-4">
                <span aria-hidden="true">🚀</span>
                <span>Trial gratuito 60 giorni</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl font-normal text-anthracite tracking-tight mb-4">
                Inizia a misurare
              </h1>

              <p className="text-anthracite-light text-lg leading-relaxed">
                Crea il tuo account professionale e accedi a tutte le funzionalità
                di Stress Index per 60 giorni, senza impegno.
              </p>
            </div>

            {/* Callout: cosa ottieni */}
            <div className="callout-teal mb-8">
              <span aria-hidden="true" className="text-lg leading-none mt-0.5">💡</span>
              <div className="text-[14.5px] text-anthracite leading-relaxed">
                <p className="font-semibold text-teal-dark mb-1">Cosa ottieni subito</p>
                <p>
                  Accesso completo all&apos;app, CRM clienti illimitato, report PDF
                  professionali e tutti i 24 parametri HRV. Nessuna carta richiesta.
                </p>
              </div>
            </div>

            {/* Form card */}
            <div className="card p-6 sm:p-8">
              <RegistrationForm />
            </div>

            {/* Trust signals */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-anthracite-lighter">
              <div className="flex items-center gap-2">
                <span aria-hidden="true">🔒</span>
                <span>Dati protetti GDPR</span>
              </div>
              <div className="flex items-center gap-2">
                <span aria-hidden="true">🇪🇺</span>
                <span>Server EU Frankfurt</span>
              </div>
              <div className="flex items-center gap-2">
                <span aria-hidden="true">✓</span>
                <span>Nessuna carta richiesta</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
