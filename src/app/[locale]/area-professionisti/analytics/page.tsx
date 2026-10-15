import { getTranslations } from 'next-intl/server'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getDataScope } from '@/lib/data-scope-server'
import { GlobalScopePanel } from '@/components/dashboard/GlobalScopePanel'
import { DataLoadNotice } from '@/components/dashboard/DataLoadNotice'
import { caricaOErrore } from '@/lib/data-error'
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
  // Vista globale del superadmin (data-scope.ts): conteggi di piattaforma,
  // nessuna riga dei clienti altrui.
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
  const t = await getTranslations('dashboard.analytics')
  const user = await getCurrentUser()
  const [professional, clients, measurements, monitoring] = await Promise.all([
    getProfessionalProfile(),
    listClientsEnriched(),
    // Un errore di lettura non diventa una pagina di zeri: si mostra l'avviso.
    caricaOErrore(listAllMeasurements()),
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

      {measurements.ok ? (
        <AnalyticsClient clients={clients.map((c) => ({ id: c.id, nome: c.nome, cognome: c.cognome, sesso: c.sesso, atleta: c.atleta, fumatore: c.fumatore, activeAlerts: c.activeAlerts, settings: c.settings ? { tags: c.settings.tags ?? null } : null }))} measurements={measurements.data} monitoring={filterMonitoringByModules(monitoring, await getMyAccountAccess())} />
      ) : (
        <DataLoadNotice />
      )}
    </DashboardLayout>
  )
}
