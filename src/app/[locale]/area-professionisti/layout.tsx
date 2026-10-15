import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { getMyAccountAccess } from '@/lib/account-access'
import { SospesoView } from './sospeso/SospesoView'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta.proArea' })
  return {
    title: { default: t('title'), template: t('template') },
    description: t('description'),
    robots: { index: false, follow: false },
  }
}

// Stato commerciale dell'account (migration 024), letto UNA volta per richiesta
// (`getMyAccountAccess` è memorizzata) invece che nel middleware a ogni hop
// (audit QA 14/10, E4):
//   • bloccato → login con `?stato=bloccato` (la pagina chiude la sessione);
//   • sospeso  → la schermata "account sospeso" al posto di qualsiasi pagina.
// Login e recupero password passano anch'essi da questo layout, ma per chi non
// è loggato `userId` è nullo e non succede niente.
export default async function AreaProfessionistiLayout({ children, params }: { children: React.ReactNode; params: { locale: string } }) {
  const access = await getMyAccountAccess()
  if (access.userId && access.stato === 'bloccato') {
    redirect({ href: { pathname: '/area-professionisti/login', query: { stato: 'bloccato' } }, locale: params.locale })
  }
  if (access.userId && access.stato === 'sospeso') {
    return <SospesoView />
  }
  return <>{children}</>
}
