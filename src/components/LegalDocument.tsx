import { getTranslations } from 'next-intl/server'
import { COMPANY } from '@/config/company'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { LegalLinks } from '@/components/LegalLinks'

// Pagina legale "a sezioni" (Termini, Cookie): stesso impianto di /privacy.
// I testi stanno in `messages/_parts/<lingua>/legal.a.json`, sotto il
// namespace passato (`legal.terms`, `legal.cookie`): `title`, `subtitle`,
// `updated` e `sections`, un oggetto di { title, body } con chiavi s01..., s02...
// (l'ordine di lettura è quello delle chiavi).
// Dalla versione 2.1 (17/10/2026) nessun testo pubblico porta segnaposto: ciò
// che il legale deve ancora validare è tracciato nel pacchetto legale, non nella
// pagina. Nei corpi, {company}, {email}, {privacyEmail}, {address}, {vat}, {pec}
// e {court} vengono da `src/config/company.ts`.
// Usata da /termini, /cookie, /legal/dpa, /legal/privacy-app, /legal/subprocessors.

type Section = { title: string; body: string }

const VARS: Record<string, string> = {
  company: COMPANY.legalName,
  email: COMPANY.email,
  privacyEmail: COMPANY.privacyEmail,
  address: COMPANY.address,
  vat: COMPANY.vat,
  pec: COMPANY.pec,
  court: COMPANY.court,
}

export type LegalNamespace =
  | 'legal.terms'
  | 'legal.cookie'
  | 'legal.dpa'
  | 'legal.privacyApp'
  | 'legal.subprocessors'

// `t.raw` non interpola: sostituisce a mano le variabili societarie.
export function interpolate(text: string): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => VARS[k] ?? m)
}

export async function LegalDocument({ namespace }: { namespace: LegalNamespace }) {
  const t = await getTranslations(namespace)
  // Le chiavi delle sezioni hanno un prefisso numerico (s01..., s02...): i file
  // messaggi vengono riordinati alfabeticamente da i18n-merge, quindi l'ordine
  // di lettura è quello delle chiavi, non quello del JSON.
  const sections = Object.entries(t.raw('sections') as Record<string, Section>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, s]) => s)

  return (
    <main className="bg-white text-anthracite">
      <Header />

      <section className="pt-16 md:pt-24 pb-16 md:pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-serif text-[36px] md:text-[52px] leading-[1.08] tracking-tight text-anthracite">
            {t('title')}
          </h1>
          <p className="mt-4 text-[17px] md:text-lg text-anthracite-light leading-relaxed">{t('subtitle', VARS)}</p>
          <p className="mt-2 text-sm text-anthracite-lighter">{t('updated')}</p>

          <div className="mt-12 divide-y divide-gray-100 border-t border-gray-100">
            {sections.map((s) => (
              <div key={s.title} className="py-8">
                <h2 className="font-serif text-xl text-anthracite">{s.title}</h2>
                <p className="mt-3 text-[15px] text-anthracite-light leading-relaxed whitespace-pre-line">
                  {interpolate(s.body)}
                </p>
              </div>
            ))}
          </div>

          <LegalLinks />
        </div>
      </section>

      <Footer />
    </main>
  )
}
