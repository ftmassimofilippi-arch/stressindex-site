import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/routing'
import { pageMetadata } from '@/lib/seo'
import { LegalDocument } from '@/components/LegalDocument'

// Termini di servizio di sito e app. Testi in
// `messages/_parts/<lingua>/legal.a.json` (namespace `legal.terms`), impianto
// condiviso con /cookie in `src/components/LegalDocument.tsx`.

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return pageMetadata({
    locale: params.locale as Locale,
    path: '/termini',
    title: t('terms.title'),
    description: t('terms.description'),
    shortDescription: t('terms.shortDescription'),
  })
}

export default function TerminiPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale)
  return <LegalDocument namespace="legal.terms" />
}
