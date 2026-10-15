import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { withLocale, type Locale } from '@/i18n/routing'

// /contatti è un alias storico di /supporto (linkato da vecchie email e dal
// vecchio footer): redirect permanente che conserva la lingua. Il metadata
// serve solo a non ereditare titolo e `index: true` della home se mai la
// pagina venisse renderizzata; la risposta normale è il 308.

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('contacts.title'), description: t('contacts.description'), robots: { index: false, follow: true } }
}

export default function ContattiPage({ params }: { params: { locale: string } }) {
  permanentRedirect(withLocale('/supporto', params.locale as Locale))
}
