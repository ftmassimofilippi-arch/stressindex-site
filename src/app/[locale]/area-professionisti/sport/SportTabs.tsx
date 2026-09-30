'use client'

import { useMemo, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { LinkCell } from '@/components/dashboard/LinkCell'
import { useLocale, useTranslations } from 'next-intl'
import { Activity, ArrowRight, ChevronLeft, ChevronRight, Dumbbell, TrendingDown, TrendingUp, Minus, Users } from 'lucide-react'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { WeeklySessionsBar } from './SportCharts'
import { formatIstante, formatMeasuredAt, formatMeasuredDate, num } from '@/lib/format'
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
  const t = useTranslations('sport')
  const [tab, setTab] = useState<Tab>('dashboard')

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'dashboard', label: t('tabs.dashboard') },
    { id: 'sessioni', label: t('tabs.sessions') },
    { id: 'atleti', label: t('tabs.athletes') },
  ]

  return (
    <div>
      <div className="border-b border-surface-border mb-6 overflow-x-auto">
        <nav className="flex gap-1 -mb-px min-w-max">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === tb.id
                  ? 'border-teal text-teal-dark'
                  : 'border-transparent text-anthracite-lighter hover:text-anthracite'
              }`}
            >
              {tb.label}
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
  const t = useTranslations('sport')
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label={t('dashboard.totalSessions')} value={stats.total_sessions} />
        <MetricCard label={t('dashboard.thisWeek')} value={stats.sessions_this_week} hint={t('dashboard.last7d')} />
        <MetricCard label={t('dashboard.avgTrimp')} value={stats.avg_trimp_week == null ? '—' : Math.round(stats.avg_trimp_week)} hint={t('dashboard.weekly')} />
        <MetricCard label={t('dashboard.activeAthletes')} value={stats.active_athletes} hint={t('dashboard.last30d')} />
      </div>

      <section className="card p-5">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Activity size={16} className="text-teal" />
          <h3 className="font-serif text-base text-anthracite">{t('dashboard.sessionsPerWeek')}</h3>
          <span className="text-xs text-anthracite-lighter">{t('dashboard.last12Weeks')}</span>
        </div>
        <WeeklySessionsBar data={stats.weekly} />
      </section>

      <section className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border flex items-center gap-2">
          <Dumbbell size={18} className="text-teal" />
          <h2 className="font-serif text-lg text-anthracite">{t('dashboard.recentSessions')}</h2>
        </div>
        {stats.recent.length === 0 ? (
          <EmptyState icon={Dumbbell} title={t('dashboard.emptyTitle')} description={t('dashboard.emptyText')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-anthracite-lighter">
                <tr>
                  <Th>{t('columns.athlete')}</Th>
                  <Th>{t('columns.date')}</Th>
                  <Th>{t('columns.sport')}</Th>
                  <Th>{t('columns.duration')}</Th>
                  <Th>{t('columns.trimp')}</Th>
                  <Th>{t('columns.hrAvg')}</Th>
                  <Th>{t('columns.dfa')}</Th>
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

const PERIODS: Array<{ value: string; labelKey: 'periodAll' | 'period7' | 'period30' | 'period90'; days: number | null }> = [
  { value: 'all', labelKey: 'periodAll', days: null },
  { value: '7', labelKey: 'period7', days: 7 },
  { value: '30', labelKey: 'period30', days: 30 },
  { value: '90', labelKey: 'period90', days: 90 },
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
  const t = useTranslations('sport')
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
        <Filter label={t('sessions.filterAthlete')}>
          <select className="select-field" value={athlete} onChange={(e) => reset(setAthlete)(e.target.value)}>
            <option value="">{t('sessions.all')}</option>
            {athleteOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Filter>
        <Filter label={t('sessions.filterPeriod')}>
          <select className="select-field" value={period} onChange={(e) => reset(setPeriod)(e.target.value)}>
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{t(`sessions.${p.labelKey}`)}</option>
            ))}
          </select>
        </Filter>
        <Filter label={t('sessions.filterSport')}>
          <select className="select-field" value={sport} onChange={(e) => reset(setSport)(e.target.value)}>
            <option value="">{t('sessions.all')}</option>
            {sports.map((sp) => (
              <option key={sp} value={sp}>{sp}</option>
            ))}
          </select>
        </Filter>
        <div className="ml-auto text-sm text-anthracite-lighter">{t('sessions.count', { count: filtered.length })}</div>
      </div>

      <section className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Dumbbell} title={t('sessions.emptyTitle')} description={t('sessions.emptyText')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-anthracite-lighter">
                <tr>
                  <Th>{t('columns.dateTime')}</Th>
                  <Th>{t('columns.athlete')}</Th>
                  <Th>{t('columns.sport')}</Th>
                  <Th>{t('columns.duration')}</Th>
                  <Th>{t('columns.hrAvg')}</Th>
                  <Th>{t('columns.hrMax')}</Th>
                  <Th>{t('columns.trimp')}</Th>
                  <Th>{t('columns.dfa')}</Th>
                  <Th>{t('columns.rpe')}</Th>
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
          <div className="flex items-center justify-between gap-3 flex-wrap px-6 py-3 border-t border-surface-border text-sm">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex items-center gap-1 text-anthracite disabled:text-anthracite-lighter/50 disabled:cursor-not-allowed hover:text-teal-dark"
            >
              <ChevronLeft size={16} /> {t('pagination.prev')}
            </button>
            <span className="text-anthracite-lighter">{t('pagination.page', { page: safePage + 1, total: pageCount })}</span>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="inline-flex items-center gap-1 text-anthracite disabled:text-anthracite-lighter/50 disabled:cursor-not-allowed hover:text-teal-dark"
            >
              {t('pagination.next')} <ChevronRight size={16} />
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

// ── TAB ATLETI ───────────────────────────────────────────────────────────────

function AtletiTab({ athletes, baseQuery }: { athletes: SportAthleteCard[]; baseQuery: string }) {
  const t = useTranslations('sport')
  const locale = useLocale()
  if (athletes.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={Users} title={t('athletes.emptyTitle')} description={t('athletes.emptyText')} />
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
                {[a.sport, competitiveLevelLabel(a.competitive_level, t)].filter(Boolean).join(' · ') || t('athletes.noSport')}
              </div>
            </div>
            <TrendBadge trend={a.ln_rmssd_trend} />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <Stat label={t('athletes.sessions30d')} value={a.sessions_30d} />
            <Stat label={t('athletes.trimp7d')} value={a.trimp_7d == null ? '—' : Math.round(a.trimp_7d)} />
            <Stat label={t('athletes.lastTrimp')} value={a.last_session_trimp == null ? '—' : Math.round(a.last_session_trimp)} />
          </div>

          <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between gap-2 text-xs">
            <span className="text-anthracite-lighter min-w-0 truncate">
              {a.last_session_at ? t('athletes.lastSession', { date: formatIstante(a.last_session_at, undefined, locale) }) : t('athletes.noSession')}
            </span>
            <ArrowRight size={14} className="text-teal-dark shrink-0" />
          </div>
        </Link>
      ))}
    </div>
  )
}

function TrendBadge({ trend }: { trend: TrendDirection }) {
  const t = useTranslations('sport')
  const map = {
    up: { Icon: TrendingUp, cls: 'bg-emerald-50 text-emerald-700' },
    down: { Icon: TrendingDown, cls: 'bg-red-50 text-red-600' },
    stable: { Icon: Minus, cls: 'bg-surface text-anthracite-lighter' },
  } as const
  const { Icon, cls } = map[trend]
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full whitespace-nowrap shrink-0 ${cls}`} title={t(`athletes.trend.${trend}Title`)}>
      <Icon size={12} /> {t(`athletes.trend.${trend}`)}
    </span>
  )
}

// ── Riusabili ────────────────────────────────────────────────────────────────

function SessionRow({ s, baseQuery, variant = 'recent' }: { s: SportSessionWithAthlete; baseQuery: string; variant?: 'recent' | 'full' }) {
  const t = useTranslations('sport')
  const locale = useLocale()
  const href = `/area-professionisti/sport/sessione/${s.id}${baseQuery}`
  return (
    <tr className="border-t border-surface-border hover:bg-surface transition-colors">
      {variant === 'recent' ? (
        <>
          <Td href={href} primary className="font-medium text-anthracite">{s.athlete_name}</Td>
          <Td href={href} className="text-anthracite-lighter">{formatMeasuredDate(s, undefined, locale)}</Td>
          <Td href={href}>{s.sport ?? '—'}</Td>
          <Td href={href}>{formatDuration(s.duration_s)}</Td>
          <Td href={href}>{s.trimp == null ? '—' : Math.round(s.trimp)}</Td>
          <Td href={href}>{s.hr_avg == null ? '—' : `${s.hr_avg} bpm`}</Td>
          <Td href={href}>{num(s.dfa_alpha1_avg, 2, locale)}</Td>
        </>
      ) : (
        <>
          <Td href={href} primary className="text-anthracite-lighter whitespace-nowrap">{formatMeasuredAt(s, locale)}</Td>
          <Td href={href} className="font-medium text-anthracite">{s.athlete_name}</Td>
          <Td href={href}>{s.sport ?? '—'}{s.test_type === 'threshold_test' && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap">{t('sessions.thresholdBadge')}</span>}</Td>
          <Td href={href}>{formatDuration(s.duration_s)}</Td>
          <Td href={href}>{s.hr_avg == null ? '—' : `${s.hr_avg}`}</Td>
          <Td href={href}>{s.hr_max == null ? '—' : `${s.hr_max}`}</Td>
          <Td href={href}>{s.trimp == null ? '—' : Math.round(s.trimp)}</Td>
          <Td href={href}>{num(s.dfa_alpha1_avg, 2, locale)}</Td>
          <Td href={href}>{s.questionnaire?.rpe == null ? '—' : `${s.questionnaire.rpe}/10`}</Td>
        </>
      )}
      <LinkCell href={`/area-professionisti/sport/sessione/${s.id}${baseQuery}`} className="text-right whitespace-nowrap">
        <span className="text-teal-dark text-sm">{t('sessions.open')} →</span>
      </LinkCell>
    </tr>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium first:pl-6">{children}</th>
}

function Td({ children, className = '', href, primary }: { children: React.ReactNode; className?: string; href?: string; primary?: boolean }) {
  if (href) {
    return <LinkCell href={href} primary={primary} className={`[&:first-child>a]:pl-6 ${className}`}>{children}</LinkCell>
  }
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
    <div className="rounded-lg bg-surface px-2 py-2 min-w-0">
      <div className="text-base font-serif text-anthracite">{value}</div>
      <div className="text-[10px] text-anthracite-lighter mt-0.5 leading-tight">{label}</div>
    </div>
  )
}
