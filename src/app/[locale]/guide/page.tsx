import { getTranslations, setRequestLocale } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo'
import type { Locale } from '@/i18n/routing'
import GuideClient from './GuideClient'
import { blocksToText, type GuideFaqItem } from './guide-content'

type Params = { params: { locale: string } }

export async function generateMetadata({ params }: Params) {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return pageMetadata({
    locale: params.locale as Locale,
    path: '/guide',
    title: t('guide.title'),
    description: t('guide.description'),
  })
}

export default async function GuidePage({ params }: Params) {
  setRequestLocale(params.locale)
  const t = await getTranslations({ locale: params.locale, namespace: 'guide' })
  const faq = t.raw('faq') as GuideFaqItem[]

  // FAQPage con gli stessi testi tradotti mostrati nella sezione Troubleshooting.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: blocksToText(item.a) },
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <GuideClient />
    </>
  )
}
