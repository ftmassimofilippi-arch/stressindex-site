import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
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
import { listMonitoringSessionsForClient } from '@/lib/monitoring-data'
import { mergeAlerts } from '@/lib/alert-rules'
import { listAlertEvents, listAlertRules } from '@/lib/alert-rules-server'
import { filterMonitoringByModules, getMyAccountAccess } from '@/lib/account-access'
import { ClientProfile } from './ClientProfile'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('clientProfile.title'), robots: { index: false, follow: false } }
}

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: { locale: string; id: string }
  searchParams?: { professionista?: string }
}) {
  const { viewing, currentUserId } = await resolveViewingProfessional(searchParams?.professionista)
  const readOnly = !!viewing
  const superadminAccess = viewing?.access === 'superadmin'

  const professionalId = viewing?.user_id ?? currentUserId
  const [client, professional, measurements, cronAlerts, notes, settings, messages, allAlerts, allMonitoring, access, alertRules, appEvents] = await Promise.all([
    getClient(params.id),
    getProfessionalProfile(),
    listMeasurementsForClient(params.id),
    listAlerts({ clientId: params.id, status: ['new', 'seen'] }),
    listNotesForClient(params.id),
    getClientSettings(params.id),
    listMessagesForClient(params.id),
    listAlerts({ status: ['new'] }),
    professionalId ? listMonitoringSessionsForClient(professionalId, params.id) : Promise.resolve([]),
    getMyAccountAccess(),
    // Regole di alert_rules (generali + override del cliente) ed eventi
    // dell'app: la stessa precedenza per cliente dell'app.
    readOnly ? Promise.resolve([]) : listAlertRules(),
    listAlertEvents({ clientId: params.id, unreadOnly: true, days: 30 }),
  ])
  const monitoring = filterMonitoringByModules(allMonitoring, access)
  const alerts = mergeAlerts(cronAlerts, appEvents)

  if (!client) notFound()

  return (
    <DashboardLayout professional={professional}>
      <ClientProfile
        client={client}
        measurements={measurements}
        monitoring={monitoring}
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
        alertRules={alertRules}
        currentUserId={currentUserId ?? undefined}
      />
    </DashboardLayout>
  )
}
