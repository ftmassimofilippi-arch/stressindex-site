import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getProfessionalProfile, listAlerts, listClientsEnriched } from '@/lib/dashboard-data'
import { createClient } from '@/lib/supabase-server'
import { AnalyticsClient } from './AnalyticsClient'
import type { Session } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Analytics' }

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const [professional, clients, alerts, sessionsRes] = await Promise.all([
    getProfessionalProfile(),
    listClientsEnriched(),
    listAlerts({ status: ['new'] }),
    supabase.from('sessions').select('*').order('created_at', { ascending: true }),
  ])

  const sessions = (sessionsRes.data ?? []) as Session[]

  return (
    <DashboardLayout professional={professional} alertCount={alerts.length}>
      <header className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">Analytics <em className="italic text-teal-dark">di studio</em></h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter">Confronta i tuoi clienti, scopri pattern, ottimizza il tuo lavoro</p>
      </header>

      <AnalyticsClient clients={clients} sessions={sessions} />
    </DashboardLayout>
  )
}
