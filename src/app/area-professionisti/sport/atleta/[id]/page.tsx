import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Info } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { getProfessionalProfile } from '@/lib/dashboard-data'
import {
  getSportAthleteProfile,
  getTrainingLoad,
  listSportSessions,
  resolveSportContext,
} from '@/lib/sport-data'
import { formatMeasuredDate, num } from '@/lib/format'
import { competitiveLevelLabel, formatDuration } from '@/lib/sport-format'
import { LnRmssdChart, PmcChart } from '../../SportCharts'

export const metadata = { title: 'Atleta sport' }
export const dynamic = 'force-dynamic'

export default async function SportAthletePage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: { professionista?: string }
}) {
  const { professionalId, viewing, access } = await resolveSportContext(searchParams?.professionista)
  if (!access.isPro) redirect('/area-professionisti/sport')

  const [professional, athlete] = await Promise.all([
    getProfessionalProfile(),
    getSportAthleteProfile(params.id),
  ])
  if (!athlete) notFound()

  const [sessions, load] = await Promise.all([
    listSportSessions(professionalId, { athleteId: params.id, period: 90 }),
    getTrainingLoad(params.id, 120),
  ])

  const baseQuery = viewing ? `?professionista=${viewing.user_id}` : ''
  const fullName = `${athlete.nome ?? ''} ${athlete.cognome ?? ''}`.trim() || 'Atleta'

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
        <ArrowLeft size={15} /> Modulo Sport
      </Link>

      <header className="mb-6">
        <h1 className="font-serif text-2xl sm:text-3xl text-anthracite">{fullName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-anthracite-lighter">
          {athlete.sport && <span>{athlete.sport}</span>}
          {competitiveLevelLabel(athlete.competitive_level) && <span>· {competitiveLevelLabel(athlete.competitive_level)}</span>}
          {athlete.hr_max != null && <span>· HR max {athlete.hr_max} bpm</span>}
          {athlete.ftp_estimated != null && <span>· FTP {athlete.ftp_estimated} W</span>}
        </div>
      </header>

      {/* SEZIONE 1 — Trend ln(RMSSD) 60 giorni */}
      <section className="card p-5 mb-6">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <h2 className="font-serif text-lg text-anthracite">Trend ln(RMSSD) · 60 giorni</h2>
          <div className="flex items-center gap-3 text-[11px] text-anthracite-lighter">
            <Legend color="#2E746C" label="Baseline 7gg" dashed />
            <Legend color="#10B981" label="Sopra banda" />
            <Legend color="#F59E0B" label="In banda" />
            <Legend color="#EF4444" label="Sotto banda" />
          </div>
        </div>
        <LnRmssdChart points={lnPoints} />
        <p className="mt-3 text-xs text-anthracite-lighter">
          La banda SWC (Smallest Worthwhile Change) rappresenta la variabilità normale. Punti sopra indicano buon recupero,
          sotto indicano affaticamento o stress.
        </p>
      </section>

      {/* SEZIONE 2 — Carico di allenamento */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <MetricCard
          label="TRIMP settimanale"
          value={Math.round(trimp7)}
          trend={weeklyDelta}
          hint="vs settimana prec."
        />
        <MetricCard label="TRIMP mensile" value={Math.round(trimp30)} hint="ultimi 30gg" />
        <MetricCard label="Sessioni" value={sessions7} hint="ultimi 7gg" />
      </div>

      {/* SEZIONE 3 — Performance Management Chart */}
      <section className="card p-5 mb-6">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <h2 className="font-serif text-lg text-anthracite">Performance Management Chart</h2>
          {hasPmc && (
            <div className="flex items-center gap-3 text-[11px] text-anthracite-lighter">
              <Legend color="#3B82F6" label="CTL · Fitness" />
              <Legend color="#EF4444" label="ATL · Fatica" />
              <Legend color="#10B981" label="TSB · Forma" />
            </div>
          )}
        </div>
        {hasPmc ? (
          <>
            <PmcChart data={pmcData} />
            <p className="mt-3 text-xs text-anthracite-lighter">
              Zona ottimale gara: TSB tra +5 e +25 (area verde). CTL = fitness (media 42gg), ATL = fatica (media 7gg),
              TSB = forma (CTL − ATL).
            </p>
          </>
        ) : (
          <div className="callout-blue">
            <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-sm text-anthracite">
              Servono almeno 4 settimane di dati per il Performance Management Chart.
              {distinctDays > 0 ? ` Attualmente disponibili ${distinctDays} giorni.` : ''}
            </p>
          </div>
        )}
      </section>

      {/* SEZIONE 4 — Storico sessioni */}
      <section className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border">
          <h2 className="font-serif text-lg text-anthracite">Storico sessioni</h2>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="Nessuna sessione" description="Questo atleta non ha ancora sessioni sport." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-anthracite-lighter">
                <tr>
                  <th className="text-left px-6 py-2.5 text-[11px] uppercase tracking-wide font-medium">Data</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">Durata</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">TRIMP</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">HR medio</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">DFA α1</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">RPE</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="border-t border-surface-border hover:bg-surface transition-colors">
                    <td className="px-6 py-3 text-anthracite font-medium">{formatMeasuredDate(s.start_time)}</td>
                    <td className="px-3 py-3">{formatDuration(s.duration_s)}</td>
                    <td className="px-3 py-3">{s.trimp == null ? '—' : Math.round(s.trimp)}</td>
                    <td className="px-3 py-3">{s.hr_avg == null ? '—' : `${s.hr_avg} bpm`}</td>
                    <td className="px-3 py-3">{num(s.dfa_alpha1_avg, 2)}</td>
                    <td className="px-3 py-3">{s.questionnaire?.rpe == null ? '—' : `${s.questionnaire.rpe}/10`}</td>
                    <td className="px-3 py-3 text-right">
                      <Link href={`/area-professionisti/sport/sessione/${s.id}${baseQuery}`} className="text-teal-dark text-sm hover:underline">
                        Apri →
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
