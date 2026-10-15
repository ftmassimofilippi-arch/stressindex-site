import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { getMyAccountAccess } from '@/lib/account-access'
import { SospesoView } from './SospesoView'

type Params = { params: { locale: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('suspended.title'), robots: { index: false, follow: false } }
}

export const dynamic = 'force-dynamic'

// Chi non è sospeso e apre /sospeso torna alla dashboard; per chi lo è la
// schermata la mostra già il layout dell'area, questa pagina la ripete.
export default async function AccountSospesoPage({ params }: Params) {
  const access = await getMyAccountAccess()
  if (access.stato !== 'sospeso') redirect({ href: '/area-professionisti', locale: params.locale })
  return <SospesoView />
}
