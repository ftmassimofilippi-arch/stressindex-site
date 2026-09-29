import { Link } from '@/i18n/navigation'
import { notFound } from 'next/navigation'
import { redirect } from '@/i18n/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, Download, Tag as TagIcon } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getProfessionalProfile } from '@/lib/dashboard-data'
import { getDfaWindows, getSportSession, getSportAccess, getThresholdTest } from '@/lib/sport-data'
import { THRESHOLD_TEST_TYPE } from '@/lib/threshold-types'
import { ThresholdTestView } from './ThresholdTestView'
import { formatMeasuredAt, num } from '@/lib/format'
import { energyEmoji, energyLabel, formatClock, formatDuration, rpeColor, sorenessZoneLabel } from '@/lib/sport-format'
import { DfaAlpha1Chart, DfaZoneBar, HrChart, RmssdChart } from '../../SportCharts'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('sportModule.sessionTitle'), robots: { index: false, follow: false } }
}

export default async function SportSessionPage({
  params,
  searchParams,
}: {
  params: { id: string; locale: string }
  searchParams?: { professionista?: string }
}) {
  const access = await getSportAccess()
  if (!access.isPro) redirect({ href: '/area-professionisti/sport', locale: params.locale })

  const t = await getTranslations('sport')
  const locale = await getLocale()

  const [professional, session] = await Promise.all([
    getProfessionalProfile(),
    getSportSession(params.id),
  ])
  if (!session) notFound()

  const [windows, threshold] = await Promise.all([
    getDfaWindows(session.id),
    session.test_type === THRESHOLD_TEST_TYPE ? getThresholdTest(session.id) : Promise.resolve(null),
  ])
  const baseQuery = searchParams?.professionista ? `?professionista=${searchParams.professionista}` : ''
  const q = session.questionnaire

  const kpis: Array<{ label: string; value: string }> = [
    { label: t('session.kpiHrAvg'), value: session.hr_avg == null ? '—' : `${session.hr_avg} bpm` },
    { label: t('session.kpiHrMax'), value: session.hr_max == null ? '—' : `${session.hr_max} bpm` },
    { label: t('session.kpiRmssd'), value: session.rmssd_avg == null ? '—' : `${num(session.rmssd_avg, 1, locale)} ms` },
    { label: t('session.kpiDfa'), value: num(session.dfa_alpha1_avg, 2, locale) },
    { label: t('session.kpiTrimp'), value: session.trimp == null ? '—' : `${Math.round(session.trimp)}` },
    { label: t('session.kpiRpe'), value: q?.rpe == null ? '—' : `${q.rpe}/10` },
  ]

  return (
    <DashboardLayout professional={professional} alertCount={0}>
      <Link
        href={`/area-professionisti/sport${baseQuery}`}
        className="inline-flex items-center gap-1.5 text-sm text-anthracite-lighter hover:text-anthracite mb-5"
      >
        <ArrowLeft size={15} /> {t('backToModule')}
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl sm:text-3xl text-anthracite">{session.athlete_name}</h1>
          <p className="mt-1.5 text-sm text-anthracite-lighter">
            {formatMeasuredAt(session, locale)} · {formatDuration(session.duration_s)}
            {session.sport ? ` · ${session.sport}` : ''}
            {session.test_type === THRESHOLD_TEST_TYPE ? ` · ${t('session.thresholdKind')}` : ''}
          </p>
        </div>
        <button
          type="button"
          disabled
          title={t('session.pdfSoon')}
          className="btn-secondary text-sm inline-flex items-center gap-2 px-4 py-2"
        >
          <Download size={16} /> {t('session.downloadPdf')}
        </button>
      </header>

      {/* SEZIONE 1 — KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4 min-w-0">
            <div className="text-[11px] font-medium text-anthracite-lighter uppercase tracking-wide">{k.label}</div>
            <div className="mt-1.5 text-xl font-serif text-anthracite">{k.value}</div>
          </div>
        ))}
      </div>

      {/* SEZIONE 1b — Test incrementale con stima delle soglie */}
      {session.test_type === THRESHOLD_TEST_TYPE && (
        <div className="mb-6">
          {threshold ? (
            <ThresholdTestView record={threshold} windows={windows} />
          ) : (
            <div className="card p-6 text-sm text-anthracite-lighter">{t('session.thresholdMissing')}</div>
          )}
        </div>
      )}

      {/* SEZIONE 2 — Zone DFA Alpha1 */}
      <section className="card p-5 mb-6">
        <h2 className="font-serif text-lg text-anthracite mb-4">{t('session.dfaZonesTitle')}</h2>
        <DfaZoneBar windows={windows} />
        <div className="mt-6">
          <DfaAlpha1Chart windows={windows} tags={session.tags} />
        </div>
      </section>

      {/* SEZIONE 3 — HR e RMSSD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section className="card p-5">
          <h2 className="font-serif text-lg text-anthracite mb-4">{t('session.hrTitle')}</h2>
          <HrChart windows={windows} />
        </section>
        <section className="card p-5">
          <h2 className="font-serif text-lg text-anthracite mb-4">{t('session.rmssdTitle')}</h2>
          <RmssdChart windows={windows} />
        </section>
      </div>

      {/* SEZIONE 4 — Questionario */}
      {q && (q.rpe != null || q.energy != null || q.mood != null || q.soreness || q.notes) && (
        <section className="card p-5 mb-6">
          <h2 className="font-serif text-lg text-anthracite mb-4">{t('session.questionnaireTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {q.rpe != null && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-anthracite-lighter">{t('session.rpe')}</span>
                    <span className="font-medium text-anthracite">{q.rpe}/10</span>
                  </div>
                  <div className="h-2.5 bg-surface-border/60 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${q.rpe * 10}%`, backgroundColor: rpeColor(q.rpe) }} />
                  </div>
                </div>
              )}
              {q.energy != null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-anthracite-lighter">{t('session.energy')}</span>
                  <span className="font-medium text-anthracite">
                    {energyEmoji(q.energy)} {energyLabel(q.energy, t) ?? `${q.energy}/5`}
                  </span>
                </div>
              )}
              {q.mood != null && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-anthracite-lighter">{t('session.mood')}</span>
                    <span className="font-medium text-anthracite">{Math.round(q.mood)}/100</span>
                  </div>
                  <div className="h-2.5 bg-surface-border/60 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${q.mood}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {q.soreness && Object.keys(q.soreness).length > 0 && (
                <div>
                  <div className="text-sm text-anthracite-lighter mb-2">{t('session.painMap')}</div>
                  <ul className="space-y-1.5">
                    {Object.entries(q.soreness)
                      .sort((a, b) => b[1] - a[1])
                      .map(([zone, intensity]) => (
                        <li key={zone} className="flex items-center justify-between text-sm">
                          <span className="text-anthracite">{sorenessZoneLabel(zone, t)}</span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="flex gap-0.5">
                              {[1, 2, 3].map((i) => (
                                <span
                                  key={i}
                                  className="w-1.5 h-3.5 rounded-sm"
                                  style={{ backgroundColor: i <= intensity ? '#EF4444' : '#E2E6EA' }}
                                />
                              ))}
                            </span>
                            <span className="text-xs text-anthracite-lighter">{intensity}/3</span>
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {q.notes && (
                <div>
                  <div className="text-sm text-anthracite-lighter mb-1.5">{t('session.notes')}</div>
                  <p className="text-sm text-anthracite whitespace-pre-wrap">{q.notes}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* SEZIONE 5 — Tag */}
      {session.tags.length > 0 && (
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TagIcon size={16} className="text-teal" />
            <h2 className="font-serif text-lg text-anthracite">{t('session.tagsTitle')}</h2>
          </div>
          <ul className="flex flex-wrap gap-2">
            {session.tags.map((tag, i) => (
              <li key={`${tag.label}-${i}`} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-teal-light text-teal-dark">
                <span className="font-medium">{tag.label}</span>
                {tag.t_ms != null && <span className="text-xs text-teal-dark/70">{formatClock(tag.t_ms)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </DashboardLayout>
  )
}
