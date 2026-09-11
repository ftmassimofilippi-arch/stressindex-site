import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getCurrentUser, getProfessionalProfile, listAlerts, listAllMeasurements, listClientsEnriched } from '@/lib/dashboard-data'
import { listMonitoringSessionsForProfessional } from '@/lib/monitoring-data'
import { AnalyticsClient } from './AnalyticsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Analytics' }

export default async function AnalyticsPage() {
  const user = await getCurrentUser()
  const [professional, clients, alerts, measurements, monitoring] = await Promise.all([
    getProfessionalProfile(),
    listClientsEnriched(),
    listAlerts({ status: ['new'] }),
    listAllMeasurements(),
    user ? listMonitoringSessionsForProfessional(user.id) : Promise.resolve([]),
  ])

  return (
    <DashboardLayout professional={professional} alertCount={alerts.length}>
      <header className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">Analytics <em className="italic text-teal-dark">di studio</em></h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter">Confronta i tuoi clienti, scopri pattern, ottimizza il tuo lavoro</p>
      </header>

      <AnalyticsClient clients={clients} measurements={measurements} monitoring={monitoring} />
    </DashboardLayout>
  )
}
