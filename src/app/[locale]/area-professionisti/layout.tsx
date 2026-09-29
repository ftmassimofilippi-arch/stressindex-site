import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta.proArea' })
  return {
    title: { default: t('title'), template: t('template') },
    description: t('description'),
    robots: { index: false, follow: false },
  }
}

export default function AreaProfessionistiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
