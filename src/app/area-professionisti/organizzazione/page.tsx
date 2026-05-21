import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import {
  getOrganizationContext,
  getOrgMembersStats,
  getOrgOverview,
  getProfessionalProfile,
  listAlerts,
} from '@/lib/dashboard-data'
import { CreateOrganizationForm } from './CreateOrganizationForm'
import { OrganizationTabs } from './OrganizationTabs'
import { MemberView } from './MemberView'

export const metadata = { title: 'Organizzazione' }
export const dynamic = 'force-dynamic'

export default async function OrganizationPage() {
  const [professional, alerts, ctx] = await Promise.all([
    getProfessionalProfile(),
    listAlerts({ status: ['new'] }),
    getOrganizationContext(),
  ])

  if (!ctx.organization) {
    return (
      <DashboardLayout professional={professional} alertCount={alerts.length}>
        <header className="mb-6">
          <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
            Crea la tua <em className="italic text-teal-dark">organizzazione</em>
          </h1>
          <p className="mt-1.5 text-sm text-anthracite-lighter max-w-2xl">
            Gestisci il tuo team di professionisti da un&apos;unica dashboard. Invita i tuoi
            collaboratori e monitora l&apos;attività di tutti i clienti.
          </p>
        </header>
        <CreateOrganizationForm />
      </DashboardLayout>
    )
  }

  if (ctx.role === 'owner' || ctx.role === 'admin') {
    const [stats, overview] = await Promise.all([getOrgMembersStats(), getOrgOverview()])
    return (
      <DashboardLayout professional={professional} alertCount={alerts.length}>
        <header className="mb-6">
          <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
            {ctx.organization.name}
          </h1>
          <p className="mt-1.5 text-sm text-anthracite-lighter">
            Gestisci il tuo team e monitora l&apos;attività dei professionisti
          </p>
        </header>
        <OrganizationTabs
          organization={ctx.organization}
          members={ctx.members}
          role={ctx.role}
          stats={stats}
          overview={overview}
        />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout professional={professional} alertCount={alerts.length}>
      <header className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
          {ctx.organization.name}
        </h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter">Il tuo team</p>
      </header>
      <MemberView members={ctx.members} />
    </DashboardLayout>
  )
}
