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
  resolveViewingProfessional,
} from '@/lib/dashboard-data'
import { ClientProfile } from './ClientProfile'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Profilo cliente' }

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: { professionista?: string }
}) {
  const { viewing, currentUserId } = await resolveViewingProfessional(searchParams?.professionista)
  const readOnly = !!viewing
  const superadminAccess = viewing?.access === 'superadmin'

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
        readOnly={readOnly}
        viewingMemberName={viewing?.full_name}
        professionistaId={viewing?.user_id}
        superadminAccess={superadminAccess}
        adminId={currentUserId ?? undefined}
      />
    </DashboardLayout>
  )
}
