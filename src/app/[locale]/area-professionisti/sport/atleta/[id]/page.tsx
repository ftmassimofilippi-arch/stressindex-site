import { Link } from '@/i18n/navigation'
import { notFound } from 'next/navigation'
import { redirect } from '@/i18n/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, Info } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { getProfessionalProfile } from '@/lib/dashboard-data'
import {
  getAthleteThresholds,
  getSportAthleteProfile,
  getTrainingLoad,
  listSportSessions,
  listThresholdTests,
  resolveSportContext,
} from '@/lib/sport-data'
import { ThresholdAthleteSection } from './ThresholdAthleteSection'
import { formatMeasuredDate, num } from '@/lib/format'
import { competitiveLevelLabel, formatDuration } from '@/lib/sport-format'
import { LnRmssdChart, PmcChart } from '../../SportCharts'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('sportModule.athleteTitle'), robots: { index: false, follow: false } }
}

export default async function SportAthletePage({
  params,
  searchParams,
}: {
  params: { id: string; locale: string }
  searchParams?: { professionista?: string }
}) {
  const { professionalId, viewing, access } = await resolveSportContext(searchParams?.professionista)
  if (!access.isPro) redirect({ href: '/area-professionisti/sport', locale: params.locale })

  const t = await getTranslations('sport')
  const locale = await getLocale()

  const [professional, athlete] = await Promise.all([
    getProfessionalProfile(),
    getSportAthleteProfile(params.id),
  ])
  if (!athlete) notFound()

  const [sessions, load, thresholds, thresholdTests] = await Promise.all([
    listSportSessions(professionalId, { athleteId: params.id, period: 90 }),
    getTrainingLoad(params.id, 120),
    getAthleteThresholds(params.id),
    listThresholdTests(params.id),
  ])

  const baseQuery = viewing ? `?professionista=${viewing.user_id}` : ''
  const fullName = `${athlete.nome ?? ''} ${athlete.cognome ?? ''}`.trim() || t('athlete')
  const level = competitiveLevelLabel(athlete.competitive_level, t)

  // ── ln(RMSSD) ultimi 60 giorni ──────────────────────────────────────────────
  const now = Date.now()
  const DAY = 86_400_000
  const lnPoints = sessions
    .filter((s) => s.rmssd_avg != null && s.rmssd_avg > 0 && now - new Date(s.start_time).getTime() <= 60 * DAY)
    .map((s) => ({ date: s.start_time, ln: Math.log(s.rmssd_avg as number) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ── Carico di allenamento (dalle sessioni) ──────────────────────────────────
  const sumTrimp = (fromDays: number, toDays: number) =>
    sessions
      .filter((s) => {
        const age = now - new Date(s.start_time).getTime()
        return age > fromDays * DAY && age <= toDays * DAY
      })
      .reduce((acc, s) => acc + (s.trimp ?? 0), 0)
  const trimp7 = sumTrimp(0, 7)
  const trimpPrev7 = sumTrimp(7, 14)
  const trimp30 = sumTrimp(0, 30)
  const sessions7 = sessions.filter((s) => now - new Date(s.start_time).getTime() <= 7 * DAY).length
  const weeklyDelta = trimpPrev7 > 0 ? ((trimp7 - trimpPrev7) / trimpPrev7) * 100 : null

  // ── PMC (training_load_daily) ───────────────────────────────────────────────
  const pmcData = load.map((d) => ({ date: d.date, ctl: d.ctl, atl: d.atl, tsb: d.tsb }))
  const distinctDays = new Set(load.map((d) => d.date)).size
  const hasPmc = distinctDays >= 28

  const recent = sessions.slice(0, 20)

  return (
    <DashboardLayout professional={professional} alertCount={0}>
      <Link
        href={`/area-professionisti/sport${baseQuery}`}
        className="inline-flex items-center gap-1.5 text-sm text-anthracite-lighter hover:text-anthracite mb-5"
      >
        <ArrowLeft size={15} /> {t('backToModule')}
      </Link>

      <header className="mb-6">
        <h1 className="font-serif text-2xl sm:text-3xl text-anthracite">{fullName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-anthracite-lighter">
          {athlete.sport && <span>{athlete.sport}</span>}
          {level && <span>· {level}</span>}
          {athlete.hr_max != null && <span>· {t('athletePage.hrMax', { value: athlete.hr_max })}</span>}
          {athlete.ftp_estimated != null && <span>· {t('athletePage.ftp', { value: athlete.ftp_estimated })}</span>}
        </div>
      </header>

      {/* SEZIONE 1 — Trend ln(RMSSD) 60 giorni */}
      <section className="card p-5 mb-6">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <h2 className="font-serif text-lg text-anthracite">{t('athletePage.lnTrendTitle')}</h2>
          <div className="flex items-center gap-3 flex-wrap text-[11px] text-anthracite-lighter">
            <Legend color="#2E746C" label={t('athletePage.legendBaseline')} dashed />
            <Legend color="#10B981" label={t('athletePage.legendAbove')} />
            <Legend color="#F59E0B" label={t('athletePage.legendIn')} />
            <Legend color="#EF4444" label={t('athletePage.legendBelow')} />
          </div>
        </div>
        <LnRmssdChart points={lnPoints} />
        <p className="mt-3 text-xs text-anthracite-lighter">{t('athletePage.swcNote')}</p>
      </section>

      {/* SEZIONE 2 — Carico di allenamento */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <MetricCard
          label={t('athletePage.trimpWeekly')}
          value={Math.round(trimp7)}
          trend={weeklyDelta}
          hint={t('athletePage.vsPrevWeek')}
        />
        <MetricCard label={t('athletePage.trimpMonthly')} value={Math.round(trimp30)} hint={t('athletePage.last30d')} />
        <MetricCard label={t('athletePage.sessions')} value={sessions7} hint={t('athletePage.last7d')} />
      </div>

      {/* SEZIONE 3 — Performance Management Chart */}
      <section className="card p-5 mb-6">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <h2 className="font-serif text-lg text-anthracite">{t('athletePage.pmcTitle')}</h2>
          {hasPmc && (
            <div className="flex items-center gap-3 flex-wrap text-[11px] text-anthracite-lighter">
              <Legend color="#3B82F6" label={t('athletePage.legendCtl')} />
              <Legend color="#EF4444" label={t('athletePage.legendAtl')} />
              <Legend color="#10B981" label={t('athletePage.legendTsb')} />
            </div>
          )}
        </div>
        {hasPmc ? (
          <>
            <PmcChart data={pmcData} />
            <p className="mt-3 text-xs text-anthracite-lighter">{t('athletePage.pmcNote')}</p>
          </>
        ) : (
          <div className="callout-blue">
            <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-sm text-anthracite">
              {t('athletePage.pmcNeed')}
              {distinctDays > 0 ? ` ${t('athletePage.pmcAvailable', { count: distinctDays })}` : ''}
            </p>
          </div>
        )}
      </section>

      {/* SEZIONE 3b — Test soglie */}
      <ThresholdAthleteSection thresholds={thresholds} tests={thresholdTests} baseQuery={baseQuery} />

      {/* SEZIONE 4 — Storico sessioni */}
      <section className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border">
          <h2 className="font-serif text-lg text-anthracite">{t('athletePage.historyTitle')}</h2>
        </div>
        {recent.length === 0 ? (
          <EmptyState title={t('athletePage.emptyTitle')} description={t('athletePage.emptyText')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-anthracite-lighter">
                <tr>
                  <th className="text-left px-6 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('columns.date')}</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('columns.duration')}</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('columns.trimp')}</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('columns.hrAvg')}</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('columns.dfa')}</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('columns.rpe')}</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="border-t border-surface-border hover:bg-surface transition-colors">
                    <td className="px-6 py-3 text-anthracite font-medium">{formatMeasuredDate(s, undefined, locale)}</td>
                    <td className="px-3 py-3">{formatDuration(s.duration_s)}</td>
                    <td className="px-3 py-3">{s.trimp == null ? '—' : Math.round(s.trimp)}</td>
                    <td className="px-3 py-3">{s.hr_avg == null ? '—' : `${s.hr_avg} bpm`}</td>
                    <td className="px-3 py-3">{num(s.dfa_alpha1_avg, 2, locale)}</td>
                    <td className="px-3 py-3">{s.questionnaire?.rpe == null ? '—' : `${s.questionnaire.rpe}/10`}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <Link href={`/area-professionisti/sport/sessione/${s.id}${baseQuery}`} className="text-teal-dark text-sm hover:underline">
                        {t('sessions.open')} →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardLayout>
  )
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {dashed ? (
        <span className="w-4 border-t-2 border-dashed" style={{ borderColor: color }} />
      ) : (
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      {label}
    </span>
  )
}
