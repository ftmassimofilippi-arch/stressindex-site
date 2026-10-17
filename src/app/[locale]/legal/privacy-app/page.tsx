import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/routing'
import { pageMetadata } from '@/lib/seo'
import { LegalDocument } from '@/components/LegalDocument'

// Pacchetto legale 2.1, namespace `legal.privacyApp`. Testi in
// `messages/_parts/<lingua>/legal.v21.json`, impianto in `src/components/LegalDocument.tsx`.

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return pageMetadata({
    locale: params.locale as Locale,
    path: '/legal/privacy-app',
    title: t('privacyApp.title'),
    description: t('privacyApp.description'),
    shortDescription: t('privacyApp.shortDescription'),
  })
}

export default function PrivacyAppPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale)
  return <LegalDocument namespace="legal.privacyApp" />
}
