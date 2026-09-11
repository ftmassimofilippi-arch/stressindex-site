import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { SuperadminAccessLog } from '@/components/dashboard/SuperadminAccessLog'
import { Monitoring24hDetail } from '@/components/monitoring/Monitoring24hDetail'
import { getProfessionalProfile, listAlerts, resolveViewingProfessional } from '@/lib/dashboard-data'
import { getMonitoringSession } from '@/lib/monitoring-data'
import { isSleepSession } from '@/lib/monitoring-types'

export const metadata = { title: 'Dettaglio monitoraggio' }
export const dynamic = 'force-dynamic'

export default async function MonitoringDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: { professionista?: string }
}) {
  const { viewing, currentUserId } = await resolveViewingProfessional(searchParams?.professionista)
  const professionalId = viewing?.user_id ?? currentUserId
  const [professional, alerts, session] = await Promise.all([
    getProfessionalProfile(),
    listAlerts({ status: ['new'] }),
    getMonitoringSession(params.id, professionalId),
  ])
  if (!session) notFound()

  const readOnly = !!viewing
  const isSuperadminView = viewing?.access === 'superadmin'
  const baseQuery = viewing ? `?professionista=${viewing.user_id}` : ''
  const clientHref = session.client_id ? `/area-professionisti/clienti/${session.client_id}${baseQuery}` : undefined

  return (
    <DashboardLayout professional={professional} alertCount={alerts.length}>
      {viewing && currentUserId && isSuperadminView && (
        <SuperadminAccessLog adminId={currentUserId} professionistaId={viewing.user_id} professionalName={viewing.full_name} />
      )}
      {viewing && (
        <div className="mb-4 flex items-center gap-3 flex-wrap px-5 py-3 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="text-sm text-amber-800">
            Stai visualizzando i dati di <strong>{viewing.full_name}</strong>
            {isSuperadminView ? ' — Modalità supporto' : ' in sola lettura'}
          </div>
          <Link href={isSuperadminView ? '/area-professionisti/professionisti' : '/area-professionisti/organizzazione'} className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 hover:underline">
            <ArrowLeft size={14} /> {isSuperadminView ? 'Torna ai professionisti' : 'Torna al tuo team'}
          </Link>
        </div>
      )}
      <div className="mb-5 flex flex-wrap gap-4">
        <Link href={`/area-professionisti/monitoraggio${baseQuery}`} className="inline-flex items-center gap-1.5 text-sm text-anthracite-lighter hover:text-anthracite">
          <ArrowLeft size={14} /> Monitoraggio
        </Link>
        {clientHref && (
          <Link href={clientHref} className="inline-flex items-center gap-1.5 text-sm text-anthracite-lighter hover:text-anthracite">
            Scheda cliente
          </Link>
        )}
      </div>

      {isSleepSession(session) ? (
        <div className="card p-8 text-center text-sm text-anthracite-lighter">Dettaglio del modulo Sonno in arrivo.</div>
      ) : (
        <Monitoring24hDetail session={session} readOnly={readOnly} baseQuery={baseQuery} clientHref={clientHref} />
      )}
    </DashboardLayout>
  )
}
