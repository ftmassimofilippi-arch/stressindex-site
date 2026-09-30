import { getTranslations } from 'next-intl/server'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import {
  getOrganizationContext,
  getOrgMembersStats,
  getOrgOverview,
  getProfessionalProfile,
} from '@/lib/dashboard-data'
import { CreateOrganizationForm } from './CreateOrganizationForm'
import { OrganizationTabs } from './OrganizationTabs'
import { MemberView } from './MemberView'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('organization.title'), robots: { index: false, follow: false } }
}

export default async function OrganizationPage() {
  const [professional, ctx, t] = await Promise.all([
    getProfessionalProfile(),
    getOrganizationContext(),
    getTranslations('organization'),
  ])

  if (!ctx.organization) {
    return (
      <DashboardLayout professional={professional}>
        <header className="mb-6">
          <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
            {t.rich('createTitle', { em: (c) => <em className="italic text-teal-dark">{c}</em> })}
          </h1>
          <p className="mt-1.5 text-sm text-anthracite-lighter max-w-2xl">{t('createIntro')}</p>
        </header>
        <CreateOrganizationForm />
      </DashboardLayout>
    )
  }

  if (ctx.role === 'owner' || ctx.role === 'admin') {
    const [stats, overview] = await Promise.all([getOrgMembersStats(), getOrgOverview()])
    return (
      <DashboardLayout professional={professional}>
        <header className="mb-6">
          <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
            {ctx.organization.name}
          </h1>
          <p className="mt-1.5 text-sm text-anthracite-lighter">{t('adminIntro')}</p>
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
    <DashboardLayout professional={professional}>
      <header className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
          {ctx.organization.name}
        </h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter">{t('memberIntro')}</p>
      </header>
      <MemberView members={ctx.members} />
    </DashboardLayout>
  )
}
