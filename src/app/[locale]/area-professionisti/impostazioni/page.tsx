import { getTranslations } from 'next-intl/server'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getNotificationPreferences, getProfessionalProfile } from '@/lib/dashboard-data'
import { SettingsTabs } from './SettingsTabs'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('settings.title'), robots: { index: false, follow: false } }
}

export default async function SettingsPage({
  searchParams,
}: {
  // ?tab=notifiche: ci arriva il link "cambia le preferenze" in fondo alle email.
  searchParams?: { tab?: string }
}) {
  const [professional, prefs, t] = await Promise.all([
    getProfessionalProfile(),
    getNotificationPreferences(),
    getTranslations('settings'),
  ])

  return (
    <DashboardLayout professional={professional}>
      <header className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">{t('title')}</h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter">{t('intro')}</p>
      </header>

      <SettingsTabs professional={professional} preferences={prefs} initialTab={searchParams?.tab} />
    </DashboardLayout>
  )
}
