import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Link } from '@/i18n/navigation'
import { AppStoreButtons } from '@/components/AppStoreButtons'

type Params = { params: { locale: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('registrationConfirm.title'), robots: { index: false, follow: false } }
}

export default async function ConfermaPage({ params }: Params) {
  setRequestLocale(params.locale)
  const t = await getTranslations('registration.confirm')


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
              {t('title')}
            </h1>

            <p className="text-lg text-anthracite-light leading-relaxed mb-10 text-center">{t('intro')}</p>

            {/* Next steps */}
            <div className="card p-6 sm:p-8 text-left space-y-6">
              <h2 className="text-xl font-bold text-anthracite flex items-center gap-2">
                <span aria-hidden="true">📋</span>
                <span>{t('nextSteps')}</span>
              </h2>

              <div className="space-y-5">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-anthracite mb-1">{t('step1Title')}</p>
                    <p className="text-[15px] text-anthracite-light leading-relaxed">{t('step1Body')}</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-anthracite mb-1">{t('step2Title')}</p>
                    <p className="text-[15px] text-anthracite-light leading-relaxed mb-3">{t('step2Body')}</p>
                    <AppStoreButtons />
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-anthracite mb-1">{t('step3Title')}</p>
                    <p className="text-[15px] text-anthracite-light leading-relaxed">{t('step3Body')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Help */}
            <p className="mt-8 text-center text-sm text-anthracite-lighter">
              {t.rich('help', {
                link: (chunks) => (
                  <Link href="/contatti" className="text-teal hover:text-teal-dark underline underline-offset-2">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
