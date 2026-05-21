import { notFound } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import {
  getClient,
  getClientSettings,
  getOrganizationContext,
  getOrgMembersStats,
  getProfessionalProfile,
  listAlerts,
  listMeasurementsForClient,
  listMessagesForClient,
  listNotesForClient,
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
  let viewingMember: { user_id: string; full_name: string } | null = null
  if (searchParams?.professionista) {
    const ctx = await getOrganizationContext()
    if (ctx.role === 'owner' || ctx.role === 'admin') {
      const stats = await getOrgMembersStats()
      const m = stats.find((s) => s.user_id === searchParams.professionista)
      if (m) viewingMember = { user_id: m.user_id, full_name: m.full_name }
    }
  }
  const readOnly = !!viewingMember

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
        viewingMemberName={viewingMember?.full_name}
        professionistaId={viewingMember?.user_id}
      />
    </DashboardLayout>
  )
}
