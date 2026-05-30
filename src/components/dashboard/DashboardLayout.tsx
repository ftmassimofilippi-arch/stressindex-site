import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { getSportAccess } from '@/lib/sport-data'

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
  const { isSuperadmin, isPro } = await getSportAccess()
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar professional={professional} isSuperadmin={isSuperadmin} isPro={isPro} />
      <div className="lg:pl-[260px]">
        <TopBar alertCount={alertCount} />
        <main className="px-4 sm:px-8 py-6 sm:py-10 max-w-[1400px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
