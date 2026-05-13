import { notFound } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import {
  getClient,
  getClientSettings,
  getProfessionalProfile,
  listAlerts,
  listMeasurementsForClient,
  listMessagesForClient,
  listNotesForClient,
} from '@/lib/dashboard-data'
import { ClientProfile } from './ClientProfile'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Profilo cliente' }

export default async function ClientPage({ params }: { params: { id: string } }) {
  const [client, professional, measurements, alerts, notes, settings, messages, allAlerts] = await Promise.all([
    getClient(params.id),
    getProfessionalProfile(),
    listMeasurementsForClient(params.id),
    listAlerts({ clientId: params.id, status: ['new', 'seen'] }),
    listNotesForClient(params.id),
    getClientSettings(params.id),
    listMessagesForClient(params.id),
    listAlerts({ status: ['new'] }),
  ])

  if (!client) notFound()

  return (
    <DashboardLayout professional={professional} alertCount={allAlerts.length}>
      <ClientProfile
        client={client}
        measurements={measurements}
        alerts={alerts}
        notes={notes}
        settings={settings}
        messages={messages}
        professional={professional}
      />
    </DashboardLayout>
  )
}
