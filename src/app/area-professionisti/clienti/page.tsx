import { Plus, Users } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { ClientsTable } from './ClientsTable'
import { getProfessionalProfile, listAlerts, listClientsEnriched } from '@/lib/dashboard-data'

export const metadata = { title: 'Clienti' }
export const dynamic = 'force-dynamic'

export default async function ClientiPage() {
  const [professional, clients, alerts] = await Promise.all([
    getProfessionalProfile(),
    listClientsEnriched(),
    listAlerts({ status: ['new', 'seen'] }),
  ])

  const newAlertCount = alerts.filter((a) => a.status === 'new').length

  return (
    <DashboardLayout professional={professional} alertCount={newAlertCount}>
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">I miei <em className="italic text-teal-dark">clienti</em></h1>
          <p className="mt-1.5 text-sm text-anthracite-lighter">{clients.length} clienti attivi</p>
        </div>
        <button type="button" className="btn-primary text-sm inline-flex items-center gap-2" disabled title="Aggiungi clienti dall'app mobile">
          <Plus size={16} /> Nuovo cliente
        </button>
      </header>

      {clients.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title="Non hai ancora clienti registrati"
            description="I clienti che aggiungi dall'app appariranno qui automaticamente."
          />
        </div>
      ) : (
        <ClientsTable clients={clients} />
      )}
    </DashboardLayout>
  )
}
