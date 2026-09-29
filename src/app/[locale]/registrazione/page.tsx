import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { pageMetadata } from '@/lib/seo'
import type { Locale } from '@/i18n/routing'
import { RegistrationForm } from './RegistrationForm'

type Params = { params: { locale: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return pageMetadata({
    locale: params.locale as Locale,
    path: '/registrazione',
    title: t('registration.title'),
    description: t('registration.description'),
    shortDescription: t('registration.shortDescription'),
  })
}

export default async function RegistrazionePage({ params }: Params) {
  setRequestLocale(params.locale)
  const t = await getTranslations('registration.page')

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
                <span>{t('eyebrow')}</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl font-normal text-anthracite tracking-tight mb-4">
                {t('title')}
              </h1>

              <p className="text-anthracite-light text-lg leading-relaxed">{t('intro')}</p>
            </div>

            {/* Callout: cosa ottieni */}
            <div className="callout-teal mb-8">
              <span aria-hidden="true" className="text-lg leading-none mt-0.5">💡</span>
              <div className="text-[14.5px] text-anthracite leading-relaxed">
                <p className="font-semibold text-teal-dark mb-1">{t('calloutTitle')}</p>
                <p>{t('calloutBody')}</p>
              </div>
            </div>

            {/* Form card */}
            <div className="card p-6 sm:p-8">
              <RegistrationForm />
            </div>

            {/* Trust signals */}
            <div className="mt-8 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-6 text-sm text-anthracite-lighter">
              <div className="flex items-center gap-2">
                <span aria-hidden="true">🔒</span>
                <span>{t('trustGdpr')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span aria-hidden="true">🇪🇺</span>
                <span>{t('trustEu')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span aria-hidden="true">✓</span>
                <span>{t('trustNoCard')}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
