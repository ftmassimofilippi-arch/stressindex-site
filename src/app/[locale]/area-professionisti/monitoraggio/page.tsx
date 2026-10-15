import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ArrowLeft } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getDataScope } from '@/lib/data-scope-server'
import { GlobalScopePanel } from '@/components/dashboard/GlobalScopePanel'
import { SuperadminAccessLog } from '@/components/dashboard/SuperadminAccessLog'
import { getProfessionalProfile, listClientsEnriched, resolveViewingProfessional } from '@/lib/dashboard-data'
import { listMonitoringSessionsForProfessional } from '@/lib/monitoring-data'
import { MON } from '@/lib/monitoring-format'
import { MonitoringIndex } from './MonitoringIndex'
import { ModuleLocked } from '@/components/dashboard/ModuleLocked'
import { filterMonitoringByModules, getMyAccountAccess, hasModule } from '@/lib/account-access'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('monitoring.title'), robots: { index: false, follow: false } }
}

export default async function MonitoringPage({ searchParams }: { params: { locale: string }; searchParams?: { professionista?: string } }) {
  // Vista globale del superadmin (data-scope.ts): conteggi, nessuna riga altrui.
  const { scope } = await getDataScope()
  if (scope === 'all') {
    const tScope = await getTranslations('dashboard.scope')
    return (
      <DashboardLayout professional={await getProfessionalProfile()}>
        <header className="mb-6">
          <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">{tScope('homeTitle')}</h1>
        </header>
        <GlobalScopePanel />
      </DashboardLayout>
    )
  }
  const t = await getTranslations('monitoring')
  const { viewing, currentUserId } = await resolveViewingProfessional(searchParams?.professionista)
  const professionalId = viewing?.user_id ?? currentUserId
  const [professional, allSessions, clients, access] = await Promise.all([
    getProfessionalProfile(),
    professionalId ? listMonitoringSessionsForProfessional(professionalId) : Promise.resolve([]),
    listClientsEnriched(viewing ? { professionistaId: viewing.user_id } : undefined),
    getMyAccountAccess(),
  ])
  if (!hasModule(access, 'monitoring') && !hasModule(access, 'sleep')) {
    return (
      <DashboardLayout professional={professional}>
        <ModuleLocked title={t('index.lockedTitle')} description={t('index.lockedDescription')} />
      </DashboardLayout>
    )
  }
  const sessions = filterMonitoringByModules(allSessions, access)
  const isSuperadminView = viewing?.access === 'superadmin'
  const baseQuery = viewing ? `?professionista=${viewing.user_id}` : ''
  // Nel filtro "Tutti i clienti" solo le schede con almeno un monitoraggio fra
  // quelli caricati (non le 800 dell'anagrafica), in ordine di cognome.
  const withMonitoring = new Set(sessions.map((s) => s.client_id).filter((id): id is string => !!id))
  const clientOptions = clients
    .filter((c) => withMonitoring.has(c.id))
    .sort((a, b) => `${a.cognome ?? ''} ${a.nome ?? ''}`.localeCompare(`${b.cognome ?? ''} ${b.nome ?? ''}`))
    .map((c) => ({ id: c.id, name: `${c.nome ?? ''} ${c.cognome ?? ''}`.trim() || t('client') }))

  return (
    <DashboardLayout professional={professional}>
      {viewing && currentUserId && isSuperadminView && (
        <SuperadminAccessLog adminId={currentUserId} professionistaId={viewing.user_id} professionalName={viewing.full_name} />
      )}
      {viewing && (
        <div className="mb-6 flex items-center gap-3 flex-wrap px-5 py-3.5 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="text-sm text-amber-800">
            {t.rich(isSuperadminView ? 'index.viewingSupport' : 'index.viewingReadOnly', { name: viewing.full_name, b: (chunks) => <strong>{chunks}</strong> })}
          </div>
          <Link
            href={isSuperadminView ? '/area-professionisti/professionisti' : '/area-professionisti/organizzazione'}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 hover:underline"
          >
            <ArrowLeft size={14} /> {isSuperadminView ? t('index.backToProfessionals') : t('index.backToTeam')}
          </Link>
        </div>
      )}

      <header className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
          <em className="italic" style={{ color: MON.accentDark }}>{t('index.title')}</em>
        </h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter">{t('index.subtitle')}</p>
      </header>

      <MonitoringIndex sessions={sessions} clients={clientOptions} baseQuery={baseQuery} />
    </DashboardLayout>
  )
}
