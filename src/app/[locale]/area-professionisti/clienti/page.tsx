import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ArrowLeft, Users } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { SuperadminAccessLog } from '@/components/dashboard/SuperadminAccessLog'
import { PlanToggle } from '@/components/dashboard/PlanToggle'
import { getMyAccountAccess, hasModule } from '@/lib/account-access'
import { ClientsTable } from './ClientsTable'
import { NewClientButton } from './NewClientButton'
import {
  getProfessionalPlan,
  getProfessionalProfile,
  listAlerts,
  listClientsEnriched,
  resolveViewingProfessional,
} from '@/lib/dashboard-data'

type Params = { params: { locale: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('clientsList.title'), robots: { index: false, follow: false } }
}

export const dynamic = 'force-dynamic'

export default async function ClientiPage({
  searchParams,
}: {
  searchParams?: { professionista?: string }
}) {
  const t = await getTranslations('clients.list')
  const { viewing, currentUserId } = await resolveViewingProfessional(searchParams?.professionista)
  const effectiveId = viewing?.user_id
  const isSuperadminView = viewing?.access === 'superadmin'

  const [professional, clients, alerts, viewingPlan, access] = await Promise.all([
    getProfessionalProfile(),
    listClientsEnriched(effectiveId ? { professionistaId: effectiveId } : undefined),
    listAlerts({ status: ['new', 'seen'] }),
    isSuperadminView && viewing ? getProfessionalPlan(viewing.user_id) : Promise.resolve(null),
    getMyAccountAccess(),
  ])

  const newAlertCount = alerts.filter((a) => a.status === 'new').length

  return (
    <DashboardLayout professional={professional} alertCount={newAlertCount}>
      {viewing && currentUserId && isSuperadminView && (
        <SuperadminAccessLog adminId={currentUserId} professionistaId={viewing.user_id} professionalName={viewing.full_name} />
      )}
      {viewing && (
        <div className="mb-6 flex items-center gap-3 flex-wrap px-5 py-3.5 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="text-sm text-amber-800 min-w-0">
            {t.rich('viewing', { name: viewing.full_name, b: (c) => <strong>{c}</strong> })}
            {' '}
            {isSuperadminView ? t('supportMode') : t('readOnly')}
          </div>
          {isSuperadminView && (
            <div className="ml-auto">
              <PlanToggle userId={viewing.user_id} name={viewing.full_name} plan={viewingPlan} size="md" />
            </div>
          )}
          <Link
            href={isSuperadminView ? '/area-professionisti/professionisti' : '/area-professionisti/organizzazione'}
            className={`${isSuperadminView ? '' : 'ml-auto'} inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 hover:underline`}
          >
            <ArrowLeft size={14} className="flex-shrink-0" /> {isSuperadminView ? t('backToProfessionals') : t('backToTeam')}
          </Link>
        </div>
      )}

      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
            {viewing
              ? t.rich('titleOf', { name: viewing.full_name, em: (c) => <em className="italic text-teal-dark">{c}</em> })
              : t.rich('title', { em: (c) => <em className="italic text-teal-dark">{c}</em> })}
          </h1>
          <p className="mt-1.5 text-sm text-anthracite-lighter">{t('count', { count: clients.length })}</p>
        </div>
        {/* In vista "dati di un altro professionista" si guarda, non si crea. */}
        {!viewing && <NewClientButton sportEnabled={hasModule(access, 'sport')} />}
      </header>

      {clients.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title={viewing ? t('emptyTitleOf') : t('emptyTitle')}
            description={t('emptyBody')}
          />
        </div>
      ) : (
        <ClientsTable clients={clients} professionistaId={viewing?.user_id} />
      )}
    </DashboardLayout>
  )
}
