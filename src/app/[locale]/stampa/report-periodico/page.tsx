import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { PrintShell, PrintSection, PrintKv, professionalLine } from '@/components/print/PrintShell'
import { AdvancedTrendChart } from '@/components/dashboard/AdvancedTrendChart'
import { MeasurementTypeBadge } from '@/components/dashboard/MeasurementTypeBadge'
import { resolvePrintAccess, assertOwnerOrSuperadmin } from '@/lib/print-access'
import { loadClient, loadPeriodicReportData, previousPeriod } from '@/lib/report-data'
import { SCORE_COLORS, SCORE_KEYS, SCORE_NAME_KEYS, commentFor, computeReportAggregates, meanOf } from '@/lib/report-aggregates'
import { age, formatDate, formatMeasuredAt, formatMeasuredDate, fullName, measuredDayKey, num, todayLong } from '@/lib/format'
import { formatDurationHuman } from '@/lib/measurement-type'
import { hasModule, getMyAccountAccess } from '@/lib/account-access'
import type { Client, MeasurementAnalytics, ProfessionalProfile } from '@/lib/types'
import { fixtureClient, fixtureProfessional, fixtureReportMeasurements, fixturesEnabled } from '@/lib/print-fixtures'

export const dynamic = 'force-dynamic'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

type SportRow = { id: string; start_time: string | null; sport: string | null; duration_s: number | null; trimp: number | null; hr_avg: number | null; dfa_alpha1_avg: number | null }

// Pagina di stampa del report periodico: trend dei 5 score (stesso chart
// della dashboard in modalità statica), medie e confronto col periodo
// precedente, giorni notevoli, elenco misurazioni, commento automatico, sport.
export default async function PrintPeriodicReportPage({
  searchParams,
}: {
  params: { locale: string }
  searchParams?: { clientId?: string; from?: string; to?: string; token?: string; fixture?: string; variant?: string }
}) {
  const clientVariant = searchParams?.variant === 'client'
  const from = searchParams?.from
  const to = searchParams?.to
  if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) notFound()
  const prev = previousPeriod(from, to)
  const useFixture = fixturesEnabled() && searchParams?.fixture === 'report'
  const clientId = searchParams?.clientId ?? (useFixture ? 'fixture-client' : undefined)
  if (!clientId) notFound()

  let client: Client
  let professional: ProfessionalProfile | null
  let measurements: MeasurementAnalytics[]
  let prevMeasurements: MeasurementAnalytics[]
  let sport: SportRow[] | null = null

  if (useFixture) {
    client = fixtureClient()
    professional = fixtureProfessional()
    measurements = fixtureReportMeasurements(from, to)
    prevMeasurements = fixtureReportMeasurements(prev.from, prev.to).map((m) => ({ ...m, score_stress: (m.score_stress ?? 50) + 6, score_recupero: (m.score_recupero ?? 60) - 5 }))
    sport = [
      { id: 'fx-s1', start_time: `${to}T17:00:00.000Z`, sport: 'Corsa', duration_s: 3200, trimp: 96, hr_avg: 148, dfa_alpha1_avg: 0.71 },
      { id: 'fx-s2', start_time: `${from}T17:30:00.000Z`, sport: 'Bici', duration_s: 5400, trimp: 132, hr_avg: 139, dfa_alpha1_avg: 0.82 },
    ]
  } else {
    const access = await resolvePrintAccess(searchParams?.token, { kind: 'report', id: `${clientId}:${from}:${to}` })
    if (!access.ok) notFound()
    const { supabase, userId, viaToken } = access

    const loadedClient = await loadClient(supabase, clientId)
    if (!loadedClient) notFound()
    client = loadedClient
    if (viaToken && !(await assertOwnerOrSuperadmin(supabase, userId, client.professionista_id))) notFound()

    const [data, prevData] = await Promise.all([
      loadPeriodicReportData(supabase, client, from, to),
      loadPeriodicReportData(supabase, client, prev.from, prev.to),
    ])
    professional = data.professional
    measurements = data.measurements
    prevMeasurements = prevData.measurements

    // Sport: solo con il modulo attivo (Piano Pro) e con la sessione (RLS).
    if (!viaToken) {
    const modules = await getMyAccountAccess()
    if (hasModule(modules, 'sport')) {
      const { data: rows } = await supabase
        .from('sport_sessions')
        .select('id, start_time, sport, duration_s, trimp, hr_avg, dfa_alpha1_avg')
        .eq('athlete_id', client.id)
        .gte('start_time', `${from}T00:00:00.000Z`)
        .lte('start_time', `${to}T23:59:59.999Z`)
        .order('start_time', { ascending: false })
      sport = (rows as SportRow[] | null) ?? []
    }
    }
  }

  const locale = await getLocale()
  const t = await getTranslations('print')
  const tScores = await getTranslations('scores.names')
  const tPdf = await getTranslations('pdf')
  const tPdfCommon = await getTranslations('pdf.common')

  const aggregates = computeReportAggregates(measurements)
  const periodLabel = t('report.periodRange', { from: formatDate(from, undefined, locale), to: formatDate(to, undefined, locale) })
  const clientAge = age(client.data_nascita)
  const pro = professionalLine(professional)

  const trendData = measurements
    .slice()
    .sort((a, b) => (a.measured_at < b.measured_at ? -1 : 1))
    .map((m) => {
      // Solo i 5 score: TREND_METRICS vive in un modulo client e non si può
      // iterare da un server component.
      const point = { date: measuredDayKey(m) ?? '' } as { date: string } & Record<string, number | string | null>
      for (const k of SCORE_KEYS) point[k] = m[k] ?? null
      return point
    })

  const comments = SCORE_KEYS.map((k) => ({ key: k, c: commentFor(k, aggregates.stats[k].deltaPct, tPdf, tScores, locale) })).filter((x) => x.c)
  const toneClass = { positive: 'border-emerald-200 bg-emerald-50 text-emerald-800', warning: 'border-amber-200 bg-amber-50 text-amber-800', neutral: 'border-surface-border bg-surface text-anthracite-light' }

  const fmtDeltaScore = (cur: number | null, old: number | null) => {
    if (cur == null || old == null) return null
    const d = cur - old
    return `${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${num(Math.abs(d), 1, locale)}`
  }

  return (
    <PrintShell clientLine={fullName(client)} dateLine={periodLabel} professional={professional}>
      <section className="print-card p-5">
        <h1 className="font-serif text-[24px] leading-tight text-anthracite">{clientVariant ? t('client.reportTitle') : t('report.title')}</h1>
        <p className="text-[11px] text-anthracite-lighter mt-1">{clientVariant ? t('client.reportSubtitle') : t('report.subtitle')}</p>
        <div className="grid grid-cols-4 gap-x-4 gap-y-3 mt-4">
          <PrintKv label={t('cover.client')} value={fullName(client) || tPdfCommon('clientFallback')} />
          <PrintKv label={t('cover.age')} value={clientAge != null ? t('cover.years', { count: clientAge }) : '—'} />
          <PrintKv label={t('cover.period')} value={periodLabel} />
          <PrintKv label={t('cover.measurements')} value={t('report.measurementsCount', { count: measurements.length })} />
          {pro.length > 0 && (
            <div className="col-span-4">
              <PrintKv label={t('cover.professional')} value={pro.slice(0, 3).join(' · ')} />
            </div>
          )}
        </div>
      </section>

      {measurements.length === 0 ? (
        <PrintSection title={t('report.trendTitle')}>
          <div className="print-card p-6 text-center text-[11px] text-anthracite-lighter">{t('report.noMeasurements')}</div>
        </PrintSection>
      ) : (
        <>
          {/* Trend dei 5 score: lo stesso AdvancedTrendChart della dashboard, statico */}
          <PrintSection title={t('report.trendTitle')} subtitle={t('report.trendSubtitle')}>
            <div className="print-card p-4 print-avoid">
              <AdvancedTrendChart data={trendData} print width={640} height={260} range={{ from, to }} metrics={[...SCORE_KEYS]} showBrush={false} />
            </div>
          </PrintSection>

          {/* Medie e confronto con il periodo precedente */}
          <PrintSection
            title={t('report.averagesTitle')}
            subtitle={t('report.averagesSubtitle', { from: formatDate(prev.from, undefined, locale), to: formatDate(prev.to, undefined, locale) })}
          >
            <div className="grid grid-cols-5 gap-2">
              {SCORE_KEYS.map((k) => {
                const cur = aggregates.stats[k]
                const prevMean = meanOf(prevMeasurements, k)
                const d = fmtDeltaScore(cur.mean, prevMean)
                return (
                  <div key={k} className="print-card p-3 print-avoid" style={{ borderTop: `3px solid ${SCORE_COLORS[k]}` }}>
                    <div className="text-[9px] uppercase tracking-wide text-anthracite-lighter truncate">{tScores(SCORE_NAME_KEYS[k])}</div>
                    <div className="font-serif text-[26px] leading-none text-anthracite mt-1">{cur.mean == null ? '—' : num(cur.mean, 0, locale)}</div>
                    <div className="text-[9px] text-anthracite-lighter mt-1">
                      {clientVariant
                        ? t('report.mean')
                        : `${t('report.mean')} · min ${cur.min == null ? '—' : num(cur.min, 0, locale)} · max ${cur.max == null ? '—' : num(cur.max, 0, locale)}`}
                    </div>
                    <div className="text-[10px] font-medium mt-1" style={{ color: d ? SCORE_COLORS[k] : '#8A94A0' }}>
                      {d ?? t('report.previousNone')}
                    </div>
                  </div>
                )
              })}
            </div>
          </PrintSection>

          {/* Giorni notevoli */}
          <PrintSection title={t('report.comparisonTitle')} avoid>
            <div className="grid grid-cols-2 gap-3">
              {[
                { day: aggregates.bestDay, label: t('report.bestDay'), hint: t('report.bestDayHint'), color: '#2ECC71' },
                { day: aggregates.worstDay, label: t('report.worstDay'), hint: t('report.worstDayHint'), color: '#E74C3C' },
              ].map((x) => (
                <div key={x.label} className="print-card p-4 print-avoid flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: x.color }} />
                  <div className="min-w-0">
                    <div className="text-[9px] uppercase tracking-wide text-anthracite-lighter">{x.label} · {x.hint}</div>
                    <div className="text-[12px] font-medium text-anthracite">{x.day ? formatMeasuredAt(x.day.measurement, locale) : '—'}</div>
                    <div className="text-[10px] text-anthracite-lighter">{t('report.stressValue', { value: x.day ? num(x.day.score, 0, locale) : '—' })}</div>
                  </div>
                </div>
              ))}
            </div>
          </PrintSection>

          {/* Commento automatico */}
          {comments.length > 0 && (
            <PrintSection title={t('report.commentTitle')} subtitle={t('report.commentSubtitle')} avoid>
              <div className="space-y-1.5">
                {comments.map(({ key, c }) => (
                  <div key={key} className={`rounded-lg border px-3 py-2 text-[10.5px] print-avoid ${toneClass[c!.tone]}`}>
                    {c!.text}
                  </div>
                ))}
              </div>
            </PrintSection>
          )}

          {/* Elenco misurazioni (solo versione professionista) */}
          {!clientVariant && (
          <PrintSection title={t('report.listTitle')}>
            <div className="print-card overflow-hidden">
              <table className="w-full text-[9.5px]">
                <thead className="bg-surface text-anthracite-lighter">
                  <tr>
                    {[t('report.colDate'), t('report.colType'), t('report.colDuration'), t('report.colStress'), t('report.colRecovery'), t('report.colBalance'), t('report.colEnergy'), t('report.colAdaptation'), t('report.colRmssd'), t('report.colHr')].map((h, i) => (
                      <th key={h} className={`px-2 py-1.5 text-[8.5px] uppercase tracking-wide font-medium ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((m: MeasurementAnalytics) => (
                    <tr key={m.id} className="border-t border-surface-border">
                      <td className="px-2 py-1.5 whitespace-nowrap text-anthracite">{formatMeasuredAt(m, locale)}</td>
                      <td className="px-2 py-1.5"><MeasurementTypeBadge testType={m.test_type} size="sm" /></td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{formatDurationHuman(m.duration_seconds)}</td>
                      {SCORE_KEYS.map((k) => (
                        <td key={k} className="px-2 py-1.5 text-right tabular-nums font-medium" style={{ color: m[k] == null ? '#8A94A0' : SCORE_COLORS[k] }}>
                          {m[k] == null ? '—' : num(m[k], 0, locale)}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right tabular-nums">{num(m.rmssd, 1, locale)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{num(m.mean_hr, 0, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PrintSection>
          )}
        </>
      )}

      {/* Sport (Piano Pro, solo versione professionista) */}
      {sport && !clientVariant && (
        <PrintSection title={t('report.sportTitle')} subtitle={t('report.sportSubtitle')} avoid>
          {sport.length === 0 ? (
            <div className="print-card p-4 text-[10.5px] text-anthracite-lighter">{t('report.noSport')}</div>
          ) : (
            <div className="print-card overflow-hidden">
              <div className="px-3 py-2 text-[10px] text-anthracite-light border-b border-surface-border">
                {t('report.sportCount', { count: sport.length, trimp: num(sport.reduce((a, s) => a + (s.trimp ?? 0), 0), 0, locale) })}
              </div>
              <table className="w-full text-[9.5px]">
                <thead className="bg-surface text-anthracite-lighter">
                  <tr>
                    {[t('report.colDate'), t('report.colSport'), t('report.colDuration'), t('report.colTrimp'), t('report.colHr'), t('report.colDfa')].map((h, i) => (
                      <th key={h} className={`px-2 py-1.5 text-[8.5px] uppercase tracking-wide font-medium ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sport.map((s) => (
                    <tr key={s.id} className="border-t border-surface-border">
                      <td className="px-2 py-1.5 whitespace-nowrap">{formatMeasuredDate({ start_time: s.start_time }, undefined, locale)}</td>
                      <td className="px-2 py-1.5">{s.sport ?? '—'}</td>
                      <td className="px-2 py-1.5">{formatDurationHuman(s.duration_s)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{s.trimp == null ? '—' : num(s.trimp, 0, locale)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{s.hr_avg == null ? '—' : num(s.hr_avg, 0, locale)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{num(s.dfa_alpha1_avg, 2, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PrintSection>
      )}

      <PrintSection title={t('disclaimer.title')} avoid>
        <div className="print-card p-4 text-[10px] leading-relaxed text-anthracite-light space-y-2">
          <p>{tPdfCommon('disclaimerPart1')}</p>
          <p>{tPdfCommon('disclaimerPart2')}</p>
          <p className="text-anthracite-lighter">{t('disclaimer.generated', { site: 'stressindex.io', date: todayLong(locale) })}</p>
        </div>
      </PrintSection>
    </PrintShell>
  )
}
