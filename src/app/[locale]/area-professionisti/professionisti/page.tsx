import { notFound } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getCurrentProfileFlags, getProfessionalProfile } from '@/lib/dashboard-data'
import { hasServiceRole } from '@/lib/supabase-admin'
import { AdminPanel } from './AdminPanel'

export const metadata = { title: 'Super Admin' }
export const dynamic = 'force-dynamic'

export default async function SuperAdminPage() {
  const { isSuperadmin } = await getCurrentProfileFlags()
  if (!isSuperadmin) notFound()

  const professional = await getProfessionalProfile()
  const serviceRoleConfigured = hasServiceRole()

  return (
    <DashboardLayout professional={professional}>
      <header className="mb-6">
        <div className="flex items-center gap-2 text-teal-dark mb-1.5">
          <ShieldCheck size={18} />
          <span className="text-xs font-medium uppercase tracking-wider">Modalità superadmin</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
          Pannello <em className="italic text-teal-dark">Super Admin</em>
        </h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter">
          Gestione completa di utenti, clienti e collegamenti. Le azioni privilegiate sono eseguite lato server con service role.
        </p>
      </header>

      <AdminPanel serviceRoleConfigured={serviceRoleConfigured} />
    </DashboardLayout>
  )
}
