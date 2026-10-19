import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Link } from '@/i18n/navigation'
import { AppStoreButtons } from '@/components/AppStoreButtons'

type Params = { params: { locale: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('appClient.title'), robots: { index: false, follow: false } }
}

// Atterraggio dei CLIENTI (profiles.role = 'client'): chi arriva da un invito
// del professionista (/imposta-password, step "fatto") e chi, loggato come
// cliente, prova a entrare in /area-professionisti (redirect dal layout
// dell'area). Il sito non ha un'area per loro: tutto vive nell'app.
export default async function AppClientePage({ params }: Params) {
  setRequestLocale(params.locale)
  const t = await getTranslations('appClient.page')

  const steps = [1, 2, 3] as const

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white pt-16">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <div className="max-w-lg mx-auto">
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-light text-3xl">
                <span aria-hidden="true">📱</span>
              </div>
            </div>

            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider mb-4">
                <span>{t('eyebrow')}</span>
              </div>
              <h1 className="font-serif text-4xl sm:text-5xl font-normal text-anthracite tracking-tight mb-4">
                {t('title')}
              </h1>
              <p className="text-lg text-anthracite-light leading-relaxed">{t('intro')}</p>
            </div>

            <div className="card p-6 sm:p-8 text-left space-y-5">
              {steps.map((n) => (
                <div key={n} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center text-sm font-semibold">
                    {n}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-anthracite mb-1">{t(`step${n}Title`)}</p>
                    <p className="text-[15px] text-anthracite-light leading-relaxed">{t(`step${n}Body`)}</p>
                    {n === 1 && <AppStoreButtons className="mt-3" />}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-8 text-center text-sm text-anthracite-lighter">
              {t.rich('help', {
                link: (chunks) => (
                  <Link href="/supporto" className="text-teal hover:text-teal-dark underline underline-offset-2">
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
