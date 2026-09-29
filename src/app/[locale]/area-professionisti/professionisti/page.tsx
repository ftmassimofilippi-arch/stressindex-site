import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ShieldCheck } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getCurrentProfileFlags, getProfessionalProfile } from '@/lib/dashboard-data'
import { hasServiceRole } from '@/lib/supabase-admin'
import { AdminPanel } from './AdminPanel'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('superadmin.title'), robots: { index: false, follow: false } }
}

export default async function SuperAdminPage() {
  const { isSuperadmin } = await getCurrentProfileFlags()
  if (!isSuperadmin) notFound()

  const t = await getTranslations('admin')
  const professional = await getProfessionalProfile()
  const serviceRoleConfigured = hasServiceRole()

  return (
    <DashboardLayout professional={professional}>
      <header className="mb-6">
        <div className="flex items-center gap-2 text-teal-dark mb-1.5">
          <ShieldCheck size={18} />
          <span className="text-xs font-medium uppercase tracking-wider">{t('page.badge')}</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
          {t.rich('page.title', { em: (c) => <em className="italic text-teal-dark">{c}</em> })}
        </h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter">{t('page.intro')}</p>
      </header>

      <AdminPanel serviceRoleConfigured={serviceRoleConfigured} />
    </DashboardLayout>
  )
}
