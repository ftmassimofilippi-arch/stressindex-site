import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Download, Tag as TagIcon } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getProfessionalProfile } from '@/lib/dashboard-data'
import { getDfaWindows, getSportSession, getSportAccess } from '@/lib/sport-data'
import { formatMeasuredAt, num } from '@/lib/format'
import { energyEmoji, ENERGY_LABEL, formatClock, formatDuration, rpeColor, sorenessZoneLabel } from '@/lib/sport-format'
import { DfaAlpha1Chart, DfaZoneBar, HrChart, RmssdChart } from '../../SportCharts'

export const metadata = { title: 'Sessione sport' }
export const dynamic = 'force-dynamic'

export default async function SportSessionPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: { professionista?: string }
}) {
  const access = await getSportAccess()
  if (!access.isPro) redirect('/area-professionisti/sport')

  const [professional, session] = await Promise.all([
    getProfessionalProfile(),
    getSportSession(params.id),
  ])
  if (!session) notFound()

  const windows = await getDfaWindows(session.id)
  const baseQuery = searchParams?.professionista ? `?professionista=${searchParams.professionista}` : ''
  const q = session.questionnaire

  const kpis: Array<{ label: string; value: string }> = [
    { label: 'HR medio', value: session.hr_avg == null ? '—' : `${session.hr_avg} bpm` },
    { label: 'HR max', value: session.hr_max == null ? '—' : `${session.hr_max} bpm` },
    { label: 'RMSSD medio', value: session.rmssd_avg == null ? '—' : `${num(session.rmssd_avg, 1)} ms` },
    { label: 'DFA α1 medio', value: num(session.dfa_alpha1_avg, 2) },
    { label: 'TRIMP', value: session.trimp == null ? '—' : `${Math.round(session.trimp)}` },
    { label: 'RPE', value: q?.rpe == null ? '—' : `${q.rpe}/10` },
  ]

  return (
    <DashboardLayout professional={professional} alertCount={0}>
      <Link
        href={`/area-professionisti/sport${baseQuery}`}
        className="inline-flex items-center gap-1.5 text-sm text-anthracite-lighter hover:text-anthracite mb-5"
      >
        <ArrowLeft size={15} /> Modulo Sport
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-anthracite">{session.athlete_name}</h1>
          <p className="mt-1.5 text-sm text-anthracite-lighter">
            {formatMeasuredAt(session.start_time)} · {formatDuration(session.duration_s)}
            {session.sport ? ` · ${session.sport}` : ''}
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Esportazione PDF in arrivo"
          className="btn-secondary text-sm inline-flex items-center gap-2 px-4 py-2"
        >
          <Download size={16} /> Scarica PDF
        </button>
      </header>

      {/* SEZIONE 1 — KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <div className="text-[11px] font-medium text-anthracite-lighter uppercase tracking-wide">{k.label}</div>
            <div className="mt-1.5 text-xl font-serif text-anthracite">{k.value}</div>
          </div>
        ))}
      </div>

      {/* SEZIONE 2 — Zone DFA Alpha1 */}
      <section className="card p-5 mb-6">
        <h2 className="font-serif text-lg text-anthracite mb-4">Zone DFA Alpha1</h2>
        <DfaZoneBar windows={windows} />
        <div className="mt-6">
          <DfaAlpha1Chart windows={windows} tags={session.tags} />
        </div>
      </section>

      {/* SEZIONE 3 — HR e RMSSD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section className="card p-5">
          <h2 className="font-serif text-lg text-anthracite mb-4">Frequenza cardiaca</h2>
          <HrChart windows={windows} />
        </section>
        <section className="card p-5">
          <h2 className="font-serif text-lg text-anthracite mb-4">RMSSD rolling</h2>
          <RmssdChart windows={windows} />
        </section>
      </div>

      {/* SEZIONE 4 — Questionario */}
      {q && (q.rpe != null || q.energy != null || q.mood != null || q.soreness || q.notes) && (
        <section className="card p-5 mb-6">
          <h2 className="font-serif text-lg text-anthracite mb-4">Questionario soggettivo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {q.rpe != null && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-anthracite-lighter">RPE (Borg CR10)</span>
                    <span className="font-medium text-anthracite">{q.rpe}/10</span>
                  </div>
                  <div className="h-2.5 bg-surface-border/60 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${q.rpe * 10}%`, backgroundColor: rpeColor(q.rpe) }} />
                  </div>
                </div>
              )}
              {q.energy != null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-anthracite-lighter">Energia</span>
                  <span className="font-medium text-anthracite">
                    {energyEmoji(q.energy)} {ENERGY_LABEL[Math.round(q.energy)] ?? `${q.energy}/5`}
                  </span>
                </div>
              )}
              {q.mood != null && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-anthracite-lighter">Umore</span>
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
                  <div className="text-sm text-anthracite-lighter mb-2">Mappa del dolore</div>
                  <ul className="space-y-1.5">
                    {Object.entries(q.soreness)
                      .sort((a, b) => b[1] - a[1])
                      .map(([zone, intensity]) => (
                        <li key={zone} className="flex items-center justify-between text-sm">
                          <span className="text-anthracite">{sorenessZoneLabel(zone)}</span>
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
                  <div className="text-sm text-anthracite-lighter mb-1.5">Note</div>
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
            <h2 className="font-serif text-lg text-anthracite">Tag sessione</h2>
          </div>
          <ul className="flex flex-wrap gap-2">
            {session.tags.map((t, i) => (
              <li key={`${t.label}-${i}`} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-teal-light text-teal-dark">
                <span className="font-medium">{t.label}</span>
                {t.t_ms != null && <span className="text-xs text-teal-dark/70">{formatClock(t.t_ms)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </DashboardLayout>
  )
}
