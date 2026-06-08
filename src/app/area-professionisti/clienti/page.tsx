import Link from 'next/link'
import { ArrowLeft, Plus, Users } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { SuperadminAccessLog } from '@/components/dashboard/SuperadminAccessLog'
import { PlanToggle } from '@/components/dashboard/PlanToggle'
import { ClientsTable } from './ClientsTable'
import {
  getProfessionalPlan,
  getProfessionalProfile,
  listAlerts,
  listClientsEnriched,
  resolveViewingProfessional,
} from '@/lib/dashboard-data'

export const metadata = { title: 'Clienti' }
export const dynamic = 'force-dynamic'

export default async function ClientiPage({
  searchParams,
}: {
  searchParams?: { professionista?: string }
}) {
  const { viewing, currentUserId } = await resolveViewingProfessional(searchParams?.professionista)
  const effectiveId = viewing?.user_id
  const isSuperadminView = viewing?.access === 'superadmin'

  const [professional, clients, alerts, viewingPlan] = await Promise.all([
    getProfessionalProfile(),
    listClientsEnriched(effectiveId ? { professionistaId: effectiveId } : undefined),
    listAlerts({ status: ['new', 'seen'] }),
    isSuperadminView && viewing ? getProfessionalPlan(viewing.user_id) : Promise.resolve(null),
  ])

  const newAlertCount = alerts.filter((a) => a.status === 'new').length

  return (
    <DashboardLayout professional={professional} alertCount={newAlertCount}>
      {viewing && currentUserId && isSuperadminView && (
        <SuperadminAccessLog adminId={currentUserId} professionistaId={viewing.user_id} professionalName={viewing.full_name} />
      )}
      {viewing && (
        <div className="mb-6 flex items-center gap-3 flex-wrap px-5 py-3.5 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="text-sm text-amber-800">
            Stai visualizzando i dati di <strong>{viewing.full_name}</strong>
            {isSuperadminView ? ' — Modalità supporto' : ' in sola lettura'}
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
            <ArrowLeft size={14} /> {isSuperadminView ? 'Torna ai professionisti' : 'Torna al tuo team'}
          </Link>
        </div>
      )}

      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
            {viewing ? (
              <>Clienti di <em className="italic text-teal-dark">{viewing.full_name}</em></>
            ) : (
              <>I miei <em className="italic text-teal-dark">clienti</em></>
            )}
          </h1>
          <p className="mt-1.5 text-sm text-anthracite-lighter">{clients.length} clienti</p>
        </div>
        {!viewing && (
          <button type="button" className="btn-primary text-sm inline-flex items-center gap-2" disabled title="Aggiungi clienti dall'app mobile">
            <Plus size={16} /> Nuovo cliente
          </button>
        )}
      </header>

      {clients.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title={viewing ? 'Nessun cliente per questo professionista' : 'Non hai ancora clienti registrati'}
            description="I clienti vengono sincronizzati dall'app mobile."
          />
        </div>
      ) : (
        <ClientsTable clients={clients} professionistaId={viewing?.user_id} />
      )}
    </DashboardLayout>
  )
}
