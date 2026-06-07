'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, BarChart3, Settings, LogOut, Menu, X, Building2, ShieldCheck, Dumbbell, Radio } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { initials } from '@/lib/format'

type SidebarProps = {
  professional: {
    nome?: string | null
    cognome?: string | null
    professione?: string | null
    logo_url?: string | null
  } | null
  isSuperadmin?: boolean
  isPro?: boolean
}

type NavItem = {
  href: string
  label: string
  icon: typeof Home
  exact?: boolean
  badge?: string
  live?: boolean // mostra il pallino "live" quando ci sono sessioni attive
}

const NAV_ITEMS: NavItem[] = [
  { href: '/area-professionisti', label: 'Oggi', icon: Home, exact: true },
  { href: '/area-professionisti/clienti', label: 'Clienti', icon: Users },
  { href: '/area-professionisti/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/area-professionisti/impostazioni', label: 'Impostazioni', icon: Settings },
  { href: '/area-professionisti/organizzazione', label: 'Organizzazione', icon: Building2 },
]

// Voce Sport: visibile solo ai professionisti Pro (o superadmin). Inserita
// dopo "Analytics" e prima di "Impostazioni".
const SPORT_ITEM: NavItem = {
  href: '/area-professionisti/sport',
  label: 'Sport',
  icon: Dumbbell,
  badge: 'Pro',
}

// Team Live: monitoraggio real-time degli atleti in sessione (subito sotto Sport).
const TEAM_LIVE_ITEM: NavItem = {
  href: '/area-professionisti/sport/team-live',
  label: 'Team Live',
  icon: Radio,
  live: true,
}

const SUPERADMIN_ITEM: NavItem = {
  href: '/area-professionisti/professionisti',
  label: 'Tutti i professionisti',
  icon: ShieldCheck,
}

export function Sidebar({ professional, isSuperadmin, isPro }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [liveActive, setLiveActive] = useState(false)
  // Sport + Team Live vanno dopo Analytics (indice 3, prima di Impostazioni).
  const baseItems = isPro
    ? [...NAV_ITEMS.slice(0, 3), SPORT_ITEM, TEAM_LIVE_ITEM, ...NAV_ITEMS.slice(3)]
    : NAV_ITEMS
  const navItems = isSuperadmin ? [...baseItems, SUPERADMIN_ITEM] : baseItems

  // Pallino "live": conta gli atleti in sessione (connessi e aggiornati negli
  // ultimi 30s) e fa pulsare la voce Team Live. Poll leggero ogni 20s.
  useEffect(() => {
    if (!isPro) return
    let cancelled = false
    const supabase = createClient()
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return
      const since = new Date(Date.now() - 30_000).toISOString()
      const { count } = await supabase
        .from('sport_live_data')
        .select('id', { count: 'exact', head: true })
        .eq('professional_id', user.id)
        .eq('is_connected', true)
        .gte('updated_at', since)
      if (!cancelled) setLiveActive((count ?? 0) > 0)
    }
    check()
    const id = setInterval(check, 20_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [isPro])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/area-professionisti/login')
    router.refresh()
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      <button
        type="button"
        aria-label="Apri menu"
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl bg-white border border-surface-border shadow-card flex items-center justify-center"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-anthracite/40 backdrop-blur-sm z-30"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-screen w-[260px] bg-white border-r border-surface-border z-40 flex flex-col transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="p-6 border-b border-surface-border">
          <Link href="/area-professionisti" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-teal flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-anthracite leading-tight">Stress Index</div>
              <div className="text-[11px] text-anthracite-lighter">Area Professionisti</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href, (item as { exact?: boolean }).exact)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                      ${active
                        ? 'bg-teal-light text-teal-dark'
                        : 'text-anthracite hover:bg-surface'}`}
                  >
                    <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                    <span className="flex-1">{item.label}</span>
                    {item.live && liveActive && (
                      <span className="relative inline-flex h-2.5 w-2.5" aria-label="Sessioni attive">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                      </span>
                    )}
                    {item.badge && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-teal text-white leading-none">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-surface-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-teal-light text-teal-dark flex items-center justify-center text-sm font-semibold">
              {initials(professional)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-anthracite truncate">
                {professional?.nome || ''} {professional?.cognome || ''}
              </div>
              <div className="text-[11px] text-anthracite-lighter truncate">
                {professional?.professione || 'Professionista'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Esci"
              className="w-9 h-9 rounded-lg hover:bg-surface flex items-center justify-center text-anthracite-lighter hover:text-anthracite transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
