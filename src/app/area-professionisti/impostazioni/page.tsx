import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getNotificationPreferences, getProfessionalProfile, listAlerts } from '@/lib/dashboard-data'
import { SettingsTabs } from './SettingsTabs'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Impostazioni' }

export default async function SettingsPage({
  searchParams,
}: {
  // ?tab=notifiche: ci arriva il link "cambia le preferenze" in fondo alle email.
  searchParams?: { tab?: string }
}) {
  const [professional, prefs, alerts] = await Promise.all([
    getProfessionalProfile(),
    getNotificationPreferences(),
    listAlerts({ status: ['new'] }),
  ])

  return (
    <DashboardLayout professional={professional} alertCount={alerts.length}>
      <header className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">Impostazioni</h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter">Gestisci il tuo profilo, notifiche e account</p>
      </header>

      <SettingsTabs professional={professional} preferences={prefs} initialTab={searchParams?.tab} />
    </DashboardLayout>
  )
}
