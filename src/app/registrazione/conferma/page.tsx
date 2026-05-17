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
      <main className="min-h-screen bg-white pt-16">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <div className="max-w-lg mx-auto">
            {/* Success icon */}
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-light text-3xl">
                <span aria-hidden="true">🎉</span>
              </div>
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl font-normal text-anthracite tracking-tight mb-4 text-center">
              Benvenuto in Stress Index
            </h1>

            <p className="text-lg text-anthracite-light leading-relaxed mb-10 text-center">
              Il tuo account è stato creato con successo. Hai 90 giorni di accesso
              completo a tutte le funzionalità.
            </p>

            {/* Next steps */}
            <div className="card p-6 sm:p-8 text-left space-y-6">
              <h2 className="text-xl font-bold text-anthracite flex items-center gap-2">
                <span aria-hidden="true">📋</span>
                <span>Prossimi passi</span>
              </h2>

              <div className="space-y-5">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-anthracite mb-1">
                      Controlla la tua email
                    </p>
                    <p className="text-[15px] text-anthracite-light leading-relaxed">
                      Ti abbiamo inviato un&apos;email di conferma. Clicca sul link per
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
                    <p className="font-semibold text-anthracite mb-1">
                      Scarica l&apos;app
                    </p>
                    <p className="text-[15px] text-anthracite-light leading-relaxed mb-3">
                      Scarica Stress Index sul tuo dispositivo.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <a
                        href="#"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-anthracite text-white rounded-lg text-sm font-medium hover:bg-anthracite-light transition-colors"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                        </svg>
                        App Store
                      </a>
                      <a
                        href="#"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-anthracite text-white rounded-lg text-sm font-medium hover:bg-anthracite-light transition-colors"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
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
                    <p className="font-semibold text-anthracite mb-1">
                      Collega il sensore
                    </p>
                    <p className="text-[15px] text-anthracite-light leading-relaxed">
                      Accedi con le credenziali appena create e collega il tuo Polar H10
                      (o altro sensore ECG compatibile) via Bluetooth per iniziare
                      le tue prime misurazioni.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Help */}
            <p className="mt-8 text-center text-sm text-anthracite-lighter">
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
