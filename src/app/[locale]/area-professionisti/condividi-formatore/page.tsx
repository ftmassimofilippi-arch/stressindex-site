import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { GraduationCap } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getProfessionalProfile } from '@/lib/dashboard-data'
import { trainerShareCandidates } from '@/lib/trainer-share-server'
import { CondividiFormatoreView } from './CondividiFormatoreView'

export const dynamic = 'force-dynamic'

// Link diretto condivisibile (/area-professionisti/condividi-formatore, con il
// redirect da /dashboard/condividi-formatore in next.config.js): se l'utente
// non è loggato il middleware lo manda al login con `?redirect=` e il login lo
// riporta qui.
export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('trainerShare.title'), robots: { index: false, follow: false } }
}

export default async function CondividiFormatorePage() {
  const locale = await getLocale()
  const [professional, t, { rows, error }] = await Promise.all([
    getProfessionalProfile(),
    getTranslations('dashboard.trainerShare'),
    trainerShareCandidates(),
  ])

  return (
    <DashboardLayout professional={professional}>
      <header className="mb-6">
        <div className="flex items-center gap-2 text-teal-dark mb-1.5">
          <GraduationCap size={18} />
          <span className="text-xs font-medium uppercase tracking-wider">{t('badge')}</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">{t('title')}</h1>
      </header>
      <CondividiFormatoreView initialCandidates={rows} loadError={error} locale={locale} />
    </DashboardLayout>
  )
}
