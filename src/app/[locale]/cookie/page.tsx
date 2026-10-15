import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/routing'
import { pageMetadata } from '@/lib/seo'
import { LegalDocument } from '@/components/LegalDocument'

// Cookie policy del sito. Testi in `messages/_parts/<lingua>/legal.a.json`
// (namespace `legal.cookie`), impianto condiviso con /termini in
// `src/components/LegalDocument.tsx`. Se il sito comincia a usare nuovi cookie
// o nuovo storage locale, va aggiornata la sezione "Cookie tecnici".

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return pageMetadata({
    locale: params.locale as Locale,
    path: '/cookie',
    title: t('cookie.title'),
    description: t('cookie.description'),
    shortDescription: t('cookie.shortDescription'),
  })
}

export default function CookiePage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale)
  return <LegalDocument namespace="legal.cookie" />
}
