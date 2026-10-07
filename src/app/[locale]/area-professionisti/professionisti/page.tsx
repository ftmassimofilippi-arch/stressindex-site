import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ShieldCheck } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getCurrentProfileFlags, getProfessionalProfile } from '@/lib/dashboard-data'
import { hasServiceRole } from '@/lib/supabase-admin'
import { getPlatformCounts } from '@/lib/admin-counts'
import { num } from '@/lib/format'
import { AdminPanel } from './AdminPanel'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('superadmin.title'), robots: { index: false, follow: false } }
}

export default async function SuperAdminPage({ params }: { params: { locale: string } }) {
  const { isSuperadmin } = await getCurrentProfileFlags()
  if (!isSuperadmin) notFound()

  const t = await getTranslations('admin')
  const professional = await getProfessionalProfile()
  const serviceRoleConfigured = hasServiceRole()
  // Conteggi aggregati: tutto ciò che il superadmin vede dell'attività degli
  // altri professionisti (vedi superadmin-scope.ts). Numeri, mai righe.
  const counts = serviceRoleConfigured ? await getPlatformCounts() : null
  const n = (v: number) => num(v, 0, params.locale)

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

      {serviceRoleConfigured && (
        <section className="card p-5 mb-6">
          <h2 className="font-serif text-lg text-anthracite">{t('platform.title')}</h2>
          <p className="mt-1 text-sm text-anthracite-lighter max-w-3xl">{t('platform.intro')}</p>
          {counts ? (
            <dl className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: t('platform.today'), value: n(counts.misurazioniOggi) },
                { label: t('platform.todayInStudio'), value: n(counts.misurazioniOggiInStudio) },
                { label: t('platform.todayRemote'), value: n(counts.misurazioniOggiDaRemoto) },
                { label: t('platform.activeToday'), value: n(counts.professionistiAttiviOggi) },
                { label: t('platform.professionals'), value: n(counts.professionisti) },
                { label: t('platform.cards'), value: n(counts.schede) },
                { label: t('platform.activeLinks'), value: n(counts.collegamentiAttivi) },
                { label: t('platform.measurements'), value: n(counts.misurazioni) },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border border-surface-border bg-surface px-4 py-3 min-w-0">
                  <dt className="text-[12px] text-anthracite-lighter truncate">{k.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold text-anthracite tabular-nums">{k.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-anthracite-lighter">{t('platform.unavailable')}</p>
          )}
        </section>
      )}

      <AdminPanel serviceRoleConfigured={serviceRoleConfigured} />
    </DashboardLayout>
  )
}
