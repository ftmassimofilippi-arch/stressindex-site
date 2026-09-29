import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { pageMetadata } from '@/lib/seo'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return pageMetadata({
    locale: params.locale as Locale,
    path: '/supporto',
    title: t('support.title'),
    description: t('support.description'),
    shortDescription: t('support.shortDescription'),
  })
}

export default async function SupportoPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale)
  const t = await getTranslations('support')

  const sections = [
    {
      emoji: '📧',
      title: t('email'),
      body: (
        <a
          href="mailto:support@stressindex.io"
          className="text-teal hover:text-teal-dark transition-colors font-medium"
        >
          support@stressindex.io
        </a>
      ),
    },
    {
      emoji: '📖',
      title: t('guides'),
      body: (
        <Link href="/guide" className="text-teal hover:text-teal-dark transition-colors font-medium">
          {t('guidesLink')}
        </Link>
      ),
    },
    {
      emoji: '❓',
      title: t('faq'),
      body: (
        <Link href="/#faq" className="text-teal hover:text-teal-dark transition-colors font-medium">
          {t('faqLink')}
        </Link>
      ),
    },
    {
      emoji: '🕐',
      title: t('hours'),
      body: <span className="text-anthracite-light">{t('hoursValue')}</span>,
    },
  ]

  return (
    <main className="bg-white text-anthracite">
      <Header />

      <section className="pt-16 md:pt-24 pb-16 md:pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-serif text-[36px] md:text-[52px] leading-[1.08] tracking-tight text-anthracite">
            {t('title')}
          </h1>
          <p className="mt-4 text-[17px] md:text-lg text-anthracite-light leading-relaxed">
            {t('subtitle')}
          </p>

          <div className="mt-12 divide-y divide-gray-100 border-t border-gray-100">
            {sections.map((s) => (
              <div key={s.title} className="flex items-start gap-4 py-6">
                <span className="text-2xl leading-none" aria-hidden>
                  {s.emoji}
                </span>
                <div>
                  <h2 className="text-base font-semibold text-anthracite">{s.title}</h2>
                  <div className="mt-1 text-[15px]">{s.body}</div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-12 text-sm text-anthracite-lighter">
            {t('madeBy')}
          </p>
        </div>
      </section>

      <Footer />
    </main>
  )
}
