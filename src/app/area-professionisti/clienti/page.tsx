import Link from 'next/link'
import { ArrowLeft, Plus, Users } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { ClientsTable } from './ClientsTable'
import {
  getOrganizationContext,
  getOrgMembersStats,
  getProfessionalProfile,
  listAlerts,
  listClientsEnriched,
} from '@/lib/dashboard-data'

export const metadata = { title: 'Clienti' }
export const dynamic = 'force-dynamic'

export default async function ClientiPage({
  searchParams,
}: {
  searchParams?: { professionista?: string }
}) {
  const professionistaId = searchParams?.professionista
  let viewingMember: { user_id: string; full_name: string } | null = null

  if (professionistaId) {
    const ctx = await getOrganizationContext()
    const isAuthorizedViewer = ctx.role === 'owner' || ctx.role === 'admin'
    if (isAuthorizedViewer) {
      const stats = await getOrgMembersStats()
      const member = stats.find((s) => s.user_id === professionistaId)
      if (member) viewingMember = { user_id: member.user_id, full_name: member.full_name }
    }
  }

  const effectiveId = viewingMember?.user_id

  const [professional, clients, alerts] = await Promise.all([
    getProfessionalProfile(),
    listClientsEnriched(effectiveId ? { professionistaId: effectiveId } : undefined),
    listAlerts({ status: ['new', 'seen'] }),
  ])

  const newAlertCount = alerts.filter((a) => a.status === 'new').length

  return (
    <DashboardLayout professional={professional} alertCount={newAlertCount}>
      {viewingMember && (
        <div className="mb-6 flex items-center gap-3 flex-wrap px-5 py-3.5 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="text-sm text-amber-800">
            Stai visualizzando i dati di <strong>{viewingMember.full_name}</strong> in sola lettura
          </div>
          <Link
            href="/area-professionisti/organizzazione"
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 hover:underline"
          >
            <ArrowLeft size={14} /> Torna al tuo team
          </Link>
        </div>
      )}

      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
            {viewingMember ? (
              <>Clienti di <em className="italic text-teal-dark">{viewingMember.full_name}</em></>
            ) : (
              <>I miei <em className="italic text-teal-dark">clienti</em></>
            )}
          </h1>
          <p className="mt-1.5 text-sm text-anthracite-lighter">{clients.length} clienti</p>
        </div>
        {!viewingMember && (
          <button type="button" className="btn-primary text-sm inline-flex items-center gap-2" disabled title="Aggiungi clienti dall'app mobile">
            <Plus size={16} /> Nuovo cliente
          </button>
        )}
      </header>

      {clients.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title={viewingMember ? 'Nessun cliente per questo professionista' : 'Non hai ancora clienti registrati'}
            description="I clienti vengono sincronizzati dall'app mobile."
          />
        </div>
      ) : (
        <ClientsTable clients={clients} professionistaId={viewingMember?.user_id} />
      )}
    </DashboardLayout>
  )
}
