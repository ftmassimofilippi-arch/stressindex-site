import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, GraduationCap } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getCurrentProfileFlags, getProfessionalProfile } from '@/lib/dashboard-data'
import { CasiDidatticiView } from './CasiDidatticiView'

export const dynamic = 'force-dynamic'

// Casi didattici: le misurazioni che i professionisti hanno condiviso con il
// formatore (sito-051), pseudonimizzate. Solo superadmin. I dati arrivano da
// /api/admin/casi-didattici, che chiama `trainer_shared_measurements()` con la
// sessione dell'utente: il blocco privacy delle altre sezioni admin non cambia.
export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('casiDidattici.title'), robots: { index: false, follow: false } }
}

export default async function CasiDidatticiPage() {
  const { isSuperadmin } = await getCurrentProfileFlags()
  if (!isSuperadmin) notFound()

  const [t, tAdmin, professional] = await Promise.all([
    getTranslations('admin.casi'),
    getTranslations('admin'),
    getProfessionalProfile(),
  ])

  return (
    <DashboardLayout professional={professional}>
      <div className="mb-6">
        <Link href="/area-professionisti/professionisti" className="inline-flex items-center gap-1.5 text-sm text-anthracite-lighter hover:text-anthracite transition-colors">
          <ArrowLeft size={14} /> {t('back')}
        </Link>
      </div>
      <header className="mb-6">
        <div className="flex items-center gap-2 text-teal-dark mb-1.5">
          <GraduationCap size={18} />
          <span className="text-xs font-medium uppercase tracking-wider">{tAdmin('page.badge')}</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
          {t.rich('title', { em: (c) => <em className="italic text-teal-dark">{c}</em> })}
        </h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter max-w-3xl">{t('intro')}</p>
      </header>
      <CasiDidatticiView />
    </DashboardLayout>
  )
}
