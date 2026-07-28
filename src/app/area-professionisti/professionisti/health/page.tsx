import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, HeartPulse } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getCurrentProfileFlags, getProfessionalProfile } from '@/lib/dashboard-data'
import { hasServiceRole } from '@/lib/supabase-admin'
import { HealthPanel } from './HealthPanel'

export const metadata = { title: 'Health check dati' }
export const dynamic = 'force-dynamic'

export default async function DataHealthPage() {
  const { isSuperadmin } = await getCurrentProfileFlags()
  if (!isSuperadmin) notFound()

  const professional = await getProfessionalProfile()
  const serviceRoleConfigured = hasServiceRole()

  return (
    <DashboardLayout professional={professional}>
      <div className="mb-6">
        <Link href="/area-professionisti/professionisti" className="inline-flex items-center gap-1.5 text-sm text-anthracite-lighter hover:text-anthracite transition-colors">
          <ArrowLeft size={14} /> Pannello Super Admin
        </Link>
      </div>

      <header className="mb-8">
        <div className="flex items-center gap-2 text-teal-dark mb-1.5">
          <HeartPulse size={18} />
          <span className="text-xs font-medium uppercase tracking-wider">Modalità superadmin</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
          Health check <em className="italic text-teal-dark">dati</em>
        </h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter max-w-2xl">
          Problemi sui dati visibili prima che li segnalino i professionisti: agganci rotti, misurazioni orfane,
          anagrafiche duplicate e richieste dimenticate.
        </p>
      </header>

      <HealthPanel serviceRoleConfigured={serviceRoleConfigured} />
    </DashboardLayout>
  )
}
