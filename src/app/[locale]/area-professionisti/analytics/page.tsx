import { getTranslations } from 'next-intl/server'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getCurrentUser, getProfessionalProfile, listAllMeasurements, listClientsEnriched } from '@/lib/dashboard-data'
import { listMonitoringSessionsForProfessional } from '@/lib/monitoring-data'
import { filterMonitoringByModules, getMyAccountAccess } from '@/lib/account-access'
import { AnalyticsClient } from './AnalyticsClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('analytics.title'), robots: { index: false, follow: false } }
}

export default async function AnalyticsPage() {
  const t = await getTranslations('dashboard.analytics')
  const user = await getCurrentUser()
  const [professional, clients, measurements, monitoring] = await Promise.all([
    getProfessionalProfile(),
    listClientsEnriched(),
    listAllMeasurements(),
    user ? listMonitoringSessionsForProfessional(user.id) : Promise.resolve([]),
  ])

  return (
    <DashboardLayout professional={professional}>
      <header className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
          {t.rich('title', { em: (c) => <em className="italic text-teal-dark">{c}</em> })}
        </h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter">{t('subtitle')}</p>
      </header>

      <AnalyticsClient clients={clients} measurements={measurements} monitoring={filterMonitoringByModules(monitoring, await getMyAccountAccess())} />
    </DashboardLayout>
  )
}
