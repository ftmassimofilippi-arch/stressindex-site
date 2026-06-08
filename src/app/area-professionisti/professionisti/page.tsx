import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ShieldCheck, ArrowRight, Users } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { EmptyState } from '@/components/dashboard/EmptyState'
import {
  getCurrentProfileFlags,
  getProfessionalProfile,
  listAllProfessionalsStats,
} from '@/lib/dashboard-data'
import { formatRelative, formatDate } from '@/lib/format'
import { PlanToggle } from '@/components/dashboard/PlanToggle'

export const metadata = { title: 'Tutti i professionisti' }
export const dynamic = 'force-dynamic'

export default async function ProfessionistiPage() {
  const { isSuperadmin } = await getCurrentProfileFlags()
  if (!isSuperadmin) notFound()

  const [professional, professionals] = await Promise.all([
    getProfessionalProfile(),
    listAllProfessionalsStats(),
  ])

  return (
    <DashboardLayout professional={professional}>
      <header className="mb-6">
        <div className="flex items-center gap-2 text-teal-dark mb-1.5">
          <ShieldCheck size={18} />
          <span className="text-xs font-medium uppercase tracking-wider">Modalità superadmin</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
          Tutti i <em className="italic text-teal-dark">professionisti</em>
        </h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter">
          {professionals.length} professionisti · clicca per visualizzarne i clienti in sola lettura
        </p>
      </header>

      {professionals.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title="Nessun professionista trovato"
            description="Quando i professionisti si registreranno appariranno qui. Verifica di aver applicato la migration 010 su Supabase."
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-anthracite-lighter border-b border-surface-border">
                <th className="px-6 py-3 font-medium">Professionista</th>
                <th className="px-3 py-3 font-medium">Piano</th>
                <th className="px-3 py-3 font-medium text-right">Clienti</th>
                <th className="px-3 py-3 font-medium text-right">Misurazioni</th>
                <th className="px-3 py-3 font-medium">Ultima attività</th>
                <th className="px-3 py-3 font-medium">Registrazione</th>
                <th className="px-6 py-3 font-medium text-right" />
              </tr>
            </thead>
            <tbody>
              {professionals.map((p) => (
                <tr key={p.user_id} className="border-t border-surface-border hover:bg-surface transition-colors">
                  <td className="px-6 py-3">
                    <Link
                      href={`/area-professionisti/clienti?professionista=${p.user_id}`}
                      className="block"
                    >
                      <div className="font-medium text-anthracite">{p.full_name}</div>
                      {p.email && <div className="text-xs text-anthracite-lighter">{p.email}</div>}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <PlanToggle userId={p.user_id} name={p.full_name} plan={p.plan} />
                  </td>
                  <td className="px-3 py-3 text-right text-anthracite">{p.clients_count}</td>
                  <td className="px-3 py-3 text-right text-anthracite">{p.measurements_count}</td>
                  <td className="px-3 py-3 text-anthracite-lighter">
                    {p.last_activity ? formatRelative(p.last_activity) : '—'}
                  </td>
                  <td className="px-3 py-3 text-anthracite-lighter">
                    {p.created_at ? formatDate(p.created_at) : '—'}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      href={`/area-professionisti/clienti?professionista=${p.user_id}`}
                      className="inline-flex items-center gap-1 text-teal-dark hover:underline"
                    >
                      Apri <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  )
}
