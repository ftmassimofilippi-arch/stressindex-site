import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { getMyAccountAccess, hasModule } from '@/lib/account-access'
import { loadNotifications } from '@/lib/notifications'

type Props = {
  children: React.ReactNode
  professional: {
    nome?: string | null
    cognome?: string | null
    professione?: string | null
    logo_url?: string | null
  } | null
}

// Il contatore della campanella lo calcola il layout, non le pagine: prima ogni
// pagina passava un numero diverso (alert totali, alert nuovi, zero) e il badge
// cambiava valore navigando. `loadNotifications` è memoizzata per richiesta.
export async function DashboardLayout({ children, professional }: Props) {
  const [access, notifiche] = await Promise.all([getMyAccountAccess(), loadNotifications()])
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar
        professional={professional}
        isSuperadmin={access.isSuperadmin}
        isPro={hasModule(access, 'sport')}
        hasMonitoring={hasModule(access, 'monitoring') || hasModule(access, 'sleep')}
      />
      <div className="lg:pl-[260px]">
        <TopBar alertCount={notifiche.unread} />
        <main className="px-4 sm:px-8 py-6 sm:py-10 max-w-[1400px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
