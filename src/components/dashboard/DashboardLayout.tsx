import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { getMyAccountAccess, hasModule } from '@/lib/account-access'

type Props = {
  children: React.ReactNode
  professional: {
    nome?: string | null
    cognome?: string | null
    professione?: string | null
    logo_url?: string | null
  } | null
  alertCount?: number
}

export async function DashboardLayout({ children, professional, alertCount }: Props) {
  const access = await getMyAccountAccess()
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar
        professional={professional}
        isSuperadmin={access.isSuperadmin}
        isPro={hasModule(access, 'sport')}
        hasMonitoring={hasModule(access, 'monitoring') || hasModule(access, 'sleep')}
      />
      <div className="lg:pl-[260px]">
        <TopBar alertCount={alertCount} />
        <main className="px-4 sm:px-8 py-6 sm:py-10 max-w-[1400px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
