import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/routing'
import { pageMetadata } from '@/lib/seo'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { LegalLinks } from '@/components/LegalLinks'
import { interpolate } from '@/components/LegalDocument'

// Informativa privacy del SITO (pacchetto legale 2.1, Doc 4), in tre lingue.
// Testi in `messages/_parts/<lingua>/privacy.a.json`. L'informativa dell'app
// (professionisti e clienti con account) è su /legal/privacy-app e la schermata
// "Informativa Privacy" dell'app deve rimandare lì (ARB `setPrivacy*`).

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return pageMetadata({
    locale: params.locale as Locale,
    path: '/privacy',
    title: t('privacy.title'),
    description: t('privacy.description'),
    shortDescription: t('privacy.shortDescription'),
  })
}

type Section = { title: string; body: string }

export default async function PrivacyPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale)
  const t = await getTranslations('privacy')
  const sections = t.raw('sections') as Section[]

  return (
    <main className="bg-white text-anthracite">
      <Header />

      <section className="pt-16 md:pt-24 pb-16 md:pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-serif text-[36px] md:text-[52px] leading-[1.08] tracking-tight text-anthracite">
            {t('title')}
          </h1>
          <p className="mt-4 text-[17px] md:text-lg text-anthracite-light leading-relaxed">{t('subtitle')}</p>
          <p className="mt-2 text-sm text-anthracite-lighter">{t('updated')}</p>

          <div className="mt-12 divide-y divide-gray-100 border-t border-gray-100">
            {sections.map((s) => (
              <div key={s.title} className="py-8">
                <h2 className="font-serif text-xl text-anthracite">{s.title}</h2>
                <p className="mt-3 text-[15px] text-anthracite-light leading-relaxed whitespace-pre-line">{interpolate(s.body)}</p>
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
