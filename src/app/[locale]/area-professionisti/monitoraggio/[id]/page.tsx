import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { SuperadminAccessLog } from '@/components/dashboard/SuperadminAccessLog'
import { Monitoring24hDetail } from '@/components/monitoring/Monitoring24hDetail'
import { SleepDetail } from '@/components/monitoring/SleepDetail'
import { getProfessionalProfile, listAlerts, resolveViewingProfessional } from '@/lib/dashboard-data'
import { getMonitoringSession } from '@/lib/monitoring-data'
import { isSleepSession } from '@/lib/monitoring-types'
import { ModuleLocked } from '@/components/dashboard/ModuleLocked'
import { filterMonitoringByModules, getMyAccountAccess } from '@/lib/account-access'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { locale: string; id: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('monitoringDetail.title'), robots: { index: false, follow: false } }
}

export default async function MonitoringDetailPage({
  params,
  searchParams,
}: {
  params: { locale: string; id: string }
  searchParams?: { professionista?: string }
}) {
  const t = await getTranslations('monitoring')
  const { viewing, currentUserId } = await resolveViewingProfessional(searchParams?.professionista)
  const professionalId = viewing?.user_id ?? currentUserId
  const [professional, alerts, session] = await Promise.all([
    getProfessionalProfile(),
    listAlerts({ status: ['new'] }),
    getMonitoringSession(params.id, professionalId),
  ])
  if (!session) notFound()
  if (filterMonitoringByModules([session], await getMyAccountAccess()).length === 0) {
    const sleep = isSleepSession(session)
    return (
      <DashboardLayout professional={professional} alertCount={alerts.length}>
        <ModuleLocked
          title={sleep ? t('detail.lockedSleepTitle') : t('detail.lockedMonitoringTitle')}
          description={sleep ? t('detail.lockedSleepDescription') : t('detail.lockedMonitoringDescription')}
        />
      </DashboardLayout>
    )
  }

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
            {t.rich(isSuperadminView ? 'detail.viewingSupport' : 'detail.viewingReadOnly', { name: viewing.full_name, b: (chunks) => <strong>{chunks}</strong> })}
          </div>
          <Link href={isSuperadminView ? '/area-professionisti/professionisti' : '/area-professionisti/organizzazione'} className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 hover:underline">
            <ArrowLeft size={14} /> {isSuperadminView ? t('index.backToProfessionals') : t('index.backToTeam')}
          </Link>
        </div>
      )}
      <div className="mb-5 flex flex-wrap gap-4">
        <Link href={`/area-professionisti/monitoraggio${baseQuery}`} className="inline-flex items-center gap-1.5 text-sm text-anthracite-lighter hover:text-anthracite">
          <ArrowLeft size={14} /> {t('index.title')}
        </Link>
        {clientHref && (
          <Link href={clientHref} className="inline-flex items-center gap-1.5 text-sm text-anthracite-lighter hover:text-anthracite">
            {t('detail.clientRecord')}
          </Link>
        )}
      </div>

      {isSleepSession(session) ? (
        <SleepDetail session={session} readOnly={readOnly} clientHref={clientHref} />
      ) : (
        <Monitoring24hDetail session={session} readOnly={readOnly} baseQuery={baseQuery} clientHref={clientHref} />
      )}
    </DashboardLayout>
  )
}
