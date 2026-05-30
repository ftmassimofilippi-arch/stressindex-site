'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowRight, ChevronLeft, ChevronRight, Dumbbell, TrendingDown, TrendingUp, Minus, Users } from 'lucide-react'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { WeeklySessionsBar } from './SportCharts'
import { formatMeasuredAt, formatMeasuredDate, num } from '@/lib/format'
import { competitiveLevelLabel, formatDuration } from '@/lib/sport-format'
import type {
  SportAthleteCard,
  SportDashboardStats,
  SportSessionWithAthlete,
  TrendDirection,
} from '@/lib/sport-data'

type Tab = 'dashboard' | 'sessioni' | 'atleti'

type Props = {
  stats: SportDashboardStats
  sessions: SportSessionWithAthlete[]
  athletes: SportAthleteCard[]
  sports: string[]
  athleteOptions: Array<{ id: string; name: string }>
  baseQuery: string
}

export function SportTabs({ stats, sessions, athletes, sports, athleteOptions, baseQuery }: Props) {
  const [tab, setTab] = useState<Tab>('dashboard')

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'sessioni', label: 'Sessioni' },
    { id: 'atleti', label: 'Atleti' },
  ]

  return (
    <div>
      <div className="border-b border-surface-border mb-6">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-teal text-teal-dark'
                  : 'border-transparent text-anthracite-lighter hover:text-anthracite'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'dashboard' && <DashboardTab stats={stats} baseQuery={baseQuery} />}
      {tab === 'sessioni' && (
        <SessioniTab sessions={sessions} sports={sports} athleteOptions={athleteOptions} baseQuery={baseQuery} />
      )}
      {tab === 'atleti' && <AtletiTab athletes={athletes} baseQuery={baseQuery} />}
    </div>
  )
}

// ── TAB DASHBOARD ────────────────────────────────────────────────────────────

function DashboardTab({ stats, baseQuery }: { stats: SportDashboardStats; baseQuery: string }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Sessioni totali" value={stats.total_sessions} />
        <MetricCard label="Questa settimana" value={stats.sessions_this_week} hint="ultimi 7gg" />
        <MetricCard label="TRIMP medio" value={stats.avg_trimp_week == null ? '—' : Math.round(stats.avg_trimp_week)} hint="settimanale" />
        <MetricCard label="Atleti attivi" value={stats.active_athletes} hint="ultimi 30gg" />
      </div>

      <section className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-teal" />
          <h3 className="font-serif text-base text-anthracite">Sessioni per settimana</h3>
          <span className="text-xs text-anthracite-lighter">ultime 12 settimane</span>
        </div>
        <WeeklySessionsBar data={stats.weekly} />
      </section>

      <section className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border flex items-center gap-2">
          <Dumbbell size={18} className="text-teal" />
          <h2 className="font-serif text-lg text-anthracite">Ultime sessioni</h2>
        </div>
        {stats.recent.length === 0 ? (
          <EmptyState icon={Dumbbell} title="Nessuna sessione sport" description="Le sessioni vengono sincronizzate dall'app mobile." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-anthracite-lighter">
                <tr>
                  <Th>Atleta</Th>
                  <Th>Data</Th>
                  <Th>Sport</Th>
                  <Th>Durata</Th>
                  <Th>TRIMP</Th>
                  <Th>HR medio</Th>
                  <Th>DFA α1</Th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((s) => (
                  <SessionRow key={s.id} s={s} baseQuery={baseQuery} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// ── TAB SESSIONI ─────────────────────────────────────────────────────────────

const PERIODS: Array<{ value: string; label: string; days: number | null }> = [
  { value: 'all', label: 'Tutto', days: null },
  { value: '7', label: 'Ultimi 7gg', days: 7 },
  { value: '30', label: 'Ultimi 30gg', days: 30 },
  { value: '90', label: 'Ultimi 90gg', days: 90 },
]
const PAGE_SIZE = 20

function SessioniTab({
  sessions,
  sports,
  athleteOptions,
  baseQuery,
}: {
  sessions: SportSessionWithAthlete[]
  sports: string[]
  athleteOptions: Array<{ id: string; name: string }>
  baseQuery: string
}) {
  const [athlete, setAthlete] = useState('')
  const [period, setPeriod] = useState('all')
  const [sport, setSport] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const days = PERIODS.find((p) => p.value === period)?.days ?? null
    const cutoff = days != null ? Date.now() - days * 86_400_000 : null
    return sessions.filter((s) => {
      if (athlete && s.athlete_id !== athlete) return false
      if (sport && s.sport !== sport) return false
      if (cutoff != null && new Date(s.start_time).getTime() < cutoff) return false
      return true
    })
  }, [sessions, athlete, period, sport])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const reset = (setter: (v: string) => void) => (v: string) => {
    setter(v)
    setPage(0)
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <Filter label="Atleta">
          <select className="select-field" value={athlete} onChange={(e) => reset(setAthlete)(e.target.value)}>
            <option value="">Tutti</option>
            {athleteOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Filter>
        <Filter label="Periodo">
          <select className="select-field" value={period} onChange={(e) => reset(setPeriod)(e.target.value)}>
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </Filter>
        <Filter label="Sport">
          <select className="select-field" value={sport} onChange={(e) => reset(setSport)(e.target.value)}>
            <option value="">Tutti</option>
            {sports.map((sp) => (
              <option key={sp} value={sp}>{sp}</option>
            ))}
          </select>
        </Filter>
        <div className="ml-auto text-sm text-anthracite-lighter">{filtered.length} sessioni</div>
      </div>

      <section className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Dumbbell} title="Nessuna sessione" description="Nessuna sessione corrisponde ai filtri selezionati." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-anthracite-lighter">
                <tr>
                  <Th>Data/ora</Th>
                  <Th>Atleta</Th>
                  <Th>Sport</Th>
                  <Th>Durata</Th>
                  <Th>HR medio</Th>
                  <Th>HR max</Th>
                  <Th>TRIMP</Th>
                  <Th>DFA α1</Th>
                  <Th>RPE</Th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s) => (
                  <SessionRow key={s.id} s={s} baseQuery={baseQuery} variant="full" />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-surface-border text-sm">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex items-center gap-1 text-anthracite disabled:text-anthracite-lighter/50 disabled:cursor-not-allowed hover:text-teal-dark"
            >
              <ChevronLeft size={16} /> Precedente
            </button>
            <span className="text-anthracite-lighter">Pagina {safePage + 1} di {pageCount}</span>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="inline-flex items-center gap-1 text-anthracite disabled:text-anthracite-lighter/50 disabled:cursor-not-allowed hover:text-teal-dark"
            >
              Successiva <ChevronRight size={16} />
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

// ── TAB ATLETI ───────────────────────────────────────────────────────────────

function AtletiTab({ athletes, baseQuery }: { athletes: SportAthleteCard[]; baseQuery: string }) {
  if (athletes.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={Users} title="Nessun atleta con sessioni sport" description="Gli atleti compaiono qui dopo la prima sessione sport sincronizzata." />
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {athletes.map((a) => (
        <Link
          key={a.id}
          href={`/area-professionisti/sport/atleta/${a.id}${baseQuery}`}
          className="card p-5 hover:shadow-card-hover transition-shadow block"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-anthracite truncate">{a.full_name}</div>
              <div className="text-xs text-anthracite-lighter mt-0.5 truncate">
                {[a.sport, competitiveLevelLabel(a.competitive_level)].filter(Boolean).join(' · ') || 'Sport non specificato'}
              </div>
            </div>
            <TrendBadge trend={a.ln_rmssd_trend} />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <Stat label="Sessioni 30gg" value={a.sessions_30d} />
            <Stat label="TRIMP 7gg" value={a.trimp_7d == null ? '—' : Math.round(a.trimp_7d)} />
            <Stat label="Ultimo TRIMP" value={a.last_session_trimp == null ? '—' : Math.round(a.last_session_trimp)} />
          </div>

          <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between text-xs">
            <span className="text-anthracite-lighter">
              {a.last_session_at ? `Ultima sessione ${formatMeasuredDate(a.last_session_at)}` : 'Nessuna sessione'}
            </span>
            <ArrowRight size={14} className="text-teal-dark" />
          </div>
        </Link>
      ))}
    </div>
  )
}

function TrendBadge({ trend }: { trend: TrendDirection }) {
  const map = {
    up: { Icon: TrendingUp, cls: 'bg-emerald-50 text-emerald-700', label: 'ln(RMSSD) ↑' },
    down: { Icon: TrendingDown, cls: 'bg-red-50 text-red-600', label: 'ln(RMSSD) ↓' },
    stable: { Icon: Minus, cls: 'bg-surface text-anthracite-lighter', label: 'ln(RMSSD) stabile' },
  } as const
  const { Icon, cls, label } = map[trend]
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full whitespace-nowrap ${cls}`} title={label}>
      <Icon size={12} /> {trend === 'stable' ? 'stabile' : trend === 'up' ? 'in salita' : 'in calo'}
    </span>
  )
}

// ── Riusabili ────────────────────────────────────────────────────────────────

function SessionRow({ s, baseQuery, variant = 'recent' }: { s: SportSessionWithAthlete; baseQuery: string; variant?: 'recent' | 'full' }) {
  return (
    <tr className="border-t border-surface-border hover:bg-surface transition-colors">
      {variant === 'recent' ? (
        <>
          <Td className="font-medium text-anthracite">{s.athlete_name}</Td>
          <Td className="text-anthracite-lighter">{formatMeasuredDate(s.start_time)}</Td>
          <Td>{s.sport ?? '—'}</Td>
          <Td>{formatDuration(s.duration_s)}</Td>
          <Td>{s.trimp == null ? '—' : Math.round(s.trimp)}</Td>
          <Td>{s.hr_avg == null ? '—' : `${s.hr_avg} bpm`}</Td>
          <Td>{num(s.dfa_alpha1_avg, 2)}</Td>
        </>
      ) : (
        <>
          <Td className="text-anthracite-lighter whitespace-nowrap">{formatMeasuredAt(s.start_time)}</Td>
          <Td className="font-medium text-anthracite">{s.athlete_name}</Td>
          <Td>{s.sport ?? '—'}</Td>
          <Td>{formatDuration(s.duration_s)}</Td>
          <Td>{s.hr_avg == null ? '—' : `${s.hr_avg}`}</Td>
          <Td>{s.hr_max == null ? '—' : `${s.hr_max}`}</Td>
          <Td>{s.trimp == null ? '—' : Math.round(s.trimp)}</Td>
          <Td>{num(s.dfa_alpha1_avg, 2)}</Td>
          <Td>{s.questionnaire?.rpe == null ? '—' : `${s.questionnaire.rpe}/10`}</Td>
        </>
      )}
      <td className="px-3 py-3 text-right whitespace-nowrap">
        <Link href={`/area-professionisti/sport/sessione/${s.id}${baseQuery}`} className="text-teal-dark text-sm hover:underline">
          Apri →
        </Link>
      </td>
    </tr>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium first:pl-6">{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 first:pl-6 ${className}`}>{children}</td>
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide font-medium text-anthracite-lighter">{label}</span>
      {children}
    </label>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-surface px-2 py-2">
      <div className="text-base font-serif text-anthracite">{value}</div>
      <div className="text-[10px] text-anthracite-lighter mt-0.5 leading-tight">{label}</div>
    </div>
  )
}
