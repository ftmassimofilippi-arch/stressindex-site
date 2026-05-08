import type { Metadata } from 'next'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Registrazione completata',
}

export default function ConfermaPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-surface pt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="max-w-lg mx-auto text-center">
            {/* Success icon */}
            <div className="mb-8 animate-fade-in">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-teal-light">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-teal">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-semibold text-anthracite tracking-tight mb-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Benvenuto in Stress Index
            </h1>

            <p className="text-lg text-anthracite-lighter leading-relaxed mb-10 animate-fade-in" style={{ animationDelay: '0.15s' }}>
              Il tuo account è stato creato con successo. Hai 90 giorni di accesso 
              completo a tutte le funzionalità.
            </p>

            {/* Next steps */}
            <div className="card p-6 sm:p-8 text-left space-y-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <h2 className="text-lg font-semibold text-anthracite">
                Prossimi passi
              </h2>

              <div className="space-y-5">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-anthracite mb-1">
                      Controlla la tua email
                    </p>
                    <p className="text-sm text-anthracite-lighter leading-relaxed">
                      Ti abbiamo inviato un'email di conferma. Clicca sul link per 
                      attivare il tuo account.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-anthracite mb-1">
                      Scarica l'app
                    </p>
                    <p className="text-sm text-anthracite-lighter leading-relaxed mb-3">
                      Scarica Stress Index sul tuo dispositivo.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <a
                        href="#"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-anthracite text-white rounded-xl text-sm font-medium hover:bg-anthracite-light transition-colors"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                        </svg>
                        App Store
                      </a>
                      <a
                        href="#"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-anthracite text-white rounded-xl text-sm font-medium hover:bg-anthracite-light transition-colors"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 010 1.38l-2.302 2.302L15.396 12l2.302-3.492zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z"/>
                        </svg>
                        Google Play
                      </a>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-anthracite mb-1">
                      Collega il sensore
                    </p>
                    <p className="text-sm text-anthracite-lighter leading-relaxed">
                      Accedi con le credenziali appena create e collega il tuo Polar H10 
                      (o altro sensore ECG compatibile) via Bluetooth per iniziare 
                      le tue prime misurazioni.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Help */}
            <p className="mt-8 text-sm text-anthracite-lighter animate-fade-in" style={{ animationDelay: '0.3s' }}>
              Hai bisogno di aiuto?{' '}
              <a href="/contatti" className="text-teal hover:text-teal-dark underline underline-offset-2">
                Contattaci
              </a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
