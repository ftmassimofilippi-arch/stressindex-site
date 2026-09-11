import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { SuperadminAccessLog } from '@/components/dashboard/SuperadminAccessLog'
import { getProfessionalProfile, listAlerts, listClientsEnriched, resolveViewingProfessional } from '@/lib/dashboard-data'
import { listMonitoringSessionsForProfessional } from '@/lib/monitoring-data'
import { MON } from '@/lib/monitoring-format'
import { MonitoringIndex } from './MonitoringIndex'

export const metadata = { title: 'Monitoraggio' }
export const dynamic = 'force-dynamic'

export default async function MonitoringPage({ searchParams }: { searchParams?: { professionista?: string } }) {
  const { viewing, currentUserId } = await resolveViewingProfessional(searchParams?.professionista)
  const professionalId = viewing?.user_id ?? currentUserId
  const [professional, alerts, sessions, clients] = await Promise.all([
    getProfessionalProfile(),
    listAlerts({ status: ['new'] }),
    professionalId ? listMonitoringSessionsForProfessional(professionalId) : Promise.resolve([]),
    listClientsEnriched(viewing ? { professionistaId: viewing.user_id } : undefined),
  ])
  const isSuperadminView = viewing?.access === 'superadmin'
  const baseQuery = viewing ? `?professionista=${viewing.user_id}` : ''
  const clientOptions = clients
    .map((c) => ({ id: c.id, name: `${c.nome ?? ''} ${c.cognome ?? ''}`.trim() || 'Cliente' }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <DashboardLayout professional={professional} alertCount={alerts.length}>
      {viewing && currentUserId && isSuperadminView && (
        <SuperadminAccessLog adminId={currentUserId} professionistaId={viewing.user_id} professionalName={viewing.full_name} />
      )}
      {viewing && (
        <div className="mb-6 flex items-center gap-3 flex-wrap px-5 py-3.5 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="text-sm text-amber-800">
            Stai visualizzando i monitoraggi di <strong>{viewing.full_name}</strong>
            {isSuperadminView ? ' — Modalità supporto' : ' in sola lettura'}
          </div>
          <Link
            href={isSuperadminView ? '/area-professionisti/professionisti' : '/area-professionisti/organizzazione'}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 hover:underline"
          >
            <ArrowLeft size={14} /> {isSuperadminView ? 'Torna ai professionisti' : 'Torna al tuo team'}
          </Link>
        </div>
      )}

      <header className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
          <em className="italic" style={{ color: MON.accentDark }}>Monitoraggio</em>
        </h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter">
          Registrazioni lunghe (24 ore, notte) e notti con il pulsossimetro dei tuoi clienti, analizzate dall&apos;app
        </p>
      </header>

      <MonitoringIndex sessions={sessions} clients={clientOptions} baseQuery={baseQuery} />
    </DashboardLayout>
  )
}
