import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { PrintShell, PrintSection, PrintKv, professionalLine } from '@/components/print/PrintShell'
import { AdvancedTrendChart } from '@/components/dashboard/AdvancedTrendChart'
import { MeasurementTypeBadge } from '@/components/dashboard/MeasurementTypeBadge'
import { resolvePrintAccess, assertOwnerOrSuperadmin } from '@/lib/print-access'
import { loadClient, loadPeriodicReportData, loadReferenceHistory } from '@/lib/report-data'
import { SCORE_COLORS, SCORE_KEYS, SCORE_NAME_KEYS, commentFor, type ScoreKey } from '@/lib/report-aggregates'
import { age, formatDate, formatMeasuredAt, formatMeasuredDate, formatMeasuredTime, fullName, intervalloGiorniIta, measuredDayKey, measuredInstant, num, todayLong } from '@/lib/format'
import { formatDurationHuman, normalizeTestType } from '@/lib/measurement-type'
import { hasModule, getMyAccountAccess } from '@/lib/account-access'
import { changeSummary, courseBaseline, dailyReferenceValues, isReferenceMeasurement, toDisplay, type ChangeSummary } from '@/lib/reference-trend.ts'
import { pairBeforeAfter, pairMorningCoherence, type CoherencePairableRow } from '@/lib/before-after'
import { loadChartPrefs } from '@/lib/chart-prefs-server'
import { EMPTY_CHART_PREFS, exclusionReasonCounts, type ChartPrefs } from '@/lib/chart-view.ts'
import { METRIC_KEYS } from '@/lib/trend-metrics.ts'
import type { Client, MeasurementAnalytics, ProfessionalProfile } from '@/lib/types'
import { fixtureClient, fixtureProfessional, fixtureReportMeasurements, fixturesEnabled } from '@/lib/print-fixtures'

export const dynamic = 'force-dynamic'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

type SportRow = { id: string; start_time: string | null; start_time_utc: string | null; sport: string | null; duration_s: number | null; trimp: number | null; hr_avg: number | null; dfa_alpha1_avg: number | null }

// Indici della tabella "Inizio e adesso": i 5 score più RMSSD.
const INDEXES: Array<{ key: ScoreKey | 'rmssd'; score: boolean }> = [
  ...SCORE_KEYS.map((k) => ({ key: k, score: true as const })),
  { key: 'rmssd', score: false },
]
const INDEX_COLORS: Record<string, string> = { ...SCORE_COLORS, rmssd: '#0284C7' }

// Pagina di stampa del report periodico (17/10/2026): gli stessi blocchi
// della scheda. Frase di sintesi e pannelli (Stress, Recupero; RMSSD per il
// professionista) con la partenza calcolata su tutta la storia, tabella
// "Inizio e adesso", regolarità, commento automatico; per il professionista
// anche coefficiente di variazione, effetto delle sedute, elenco e sport.
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
  const useFixture = fixturesEnabled() && searchParams?.fixture === 'report'
  const clientId = searchParams?.clientId ?? (useFixture ? 'fixture-client' : undefined)
  if (!clientId) notFound()

  let client: Client
  let professional: ProfessionalProfile | null
  let measurements: MeasurementAnalytics[]
  let history: MeasurementAnalytics[]
  let prefs: ChartPrefs = EMPTY_CHART_PREFS
  let sport: SportRow[] | null = null

  if (useFixture) {
    client = fixtureClient()
    professional = fixtureProfessional()
    measurements = fixtureReportMeasurements(from, to)
    // Storia più lunga del periodo, così la partenza cade prima del periodo come nei casi veri.
    const d = new Date(`${from}T00:00:00.000Z`)
    d.setUTCDate(d.getUTCDate() - 45)
    history = fixtureReportMeasurements(d.toISOString().slice(0, 10), to)
    sport = [
      { id: 'fx-s1', start_time: `${to}T17:00:00.000Z`, start_time_utc: `${to}T15:00:00.000Z`, sport: 'Corsa', duration_s: 3200, trimp: 96, hr_avg: 148, dfa_alpha1_avg: 0.71 },
      { id: 'fx-s2', start_time: `${from}T17:30:00.000Z`, start_time_utc: `${from}T15:30:00.000Z`, sport: 'Bici', duration_s: 5400, trimp: 132, hr_avg: 139, dfa_alpha1_avg: 0.82 },
    ]
  } else {
    const access = await resolvePrintAccess(searchParams?.token, { kind: 'report', id: `${clientId}:${from}:${to}` })
    if (!access.ok) notFound()
    const { supabase, userId, viaToken } = access

    const loadedClient = await loadClient(supabase, clientId)
    if (!loadedClient) notFound()
    client = loadedClient
    // Anche con la sessione: la RLS da sola concede a un superadmin ogni scheda.
    if (!(await assertOwnerOrSuperadmin(supabase, userId, client.professionista_id))) notFound()

    const [data, hist, loadedPrefs] = await Promise.all([
      loadPeriodicReportData(supabase, client, from, to),
      loadReferenceHistory(supabase, client, to),
      loadChartPrefs(client.id, METRIC_KEYS, supabase),
    ])
    professional = data.professional
    measurements = data.measurements
    history = hist
    prefs = loadedPrefs

    // Sport: solo con il modulo attivo (Piano Pro) e con la sessione (RLS).
    if (!viaToken) {
      const modules = await getMyAccountAccess()
      if (hasModule(modules, 'sport')) {
        const { fromIso, toIso } = intervalloGiorniIta(from, to)
        const { data: rows } = await supabase
          .from('sport_sessions')
          .select('id, start_time, start_time_utc, sport, duration_s, trimp, hr_avg, dfa_alpha1_avg')
          .eq('athlete_id', client.id)
          .gte('start_time_utc', fromIso)
          .lte('start_time_utc', toIso)
          .order('start_time_utc', { ascending: false, nullsFirst: false })
        sport = (rows as SportRow[] | null) ?? []
      }
    }
  }

  const locale = await getLocale()
  const t = await getTranslations('print')
  const tScores = await getTranslations('scores.names')
  const tPdf = await getTranslations('pdf')
  const tPdfCommon = await getTranslations('pdf.common')
  const tPanel = await getTranslations('charts.panel')
  const tPrepare = await getTranslations('clients.prepare')
  const tCharts = await getTranslations('charts')

  const periodLabel = t('report.periodRange', { from: formatDate(from, undefined, locale), to: formatDate(to, undefined, locale) })
  const clientAge = age(client.data_nascita)
  const pro = professionalLine(professional)
  const courseStart = client.data_inizio_percorso ?? null
  const excluded = new Set(prefs.exclusions.map((e) => e.session_id))

  // Conti per indice: gli stessi della scheda (reference-trend.ts), sulla storia intera.
  const rows = INDEXES.map((ix) => {
    const daily = dailyReferenceValues(history, ix.key, { excluded })
    const summary = changeSummary(ix.key, daily, courseBaseline(daily, courseStart), { asOf: to, period: { from, to } })
    const inPeriod = daily.filter((d) => d.day >= from && d.day <= to).map((d) => toDisplay(ix.key, d.value))
    const mean = inPeriod.length ? inPeriod.reduce((a, b) => a + b, 0) / inPeriod.length : null
    const sd = inPeriod.length >= 2 && mean ? Math.sqrt(inPeriod.reduce((a, b) => a + (b - mean) ** 2, 0) / (inPeriod.length - 1)) : null
    return { ...ix, summary, cv: sd != null && mean ? (sd / mean) * 100 : null }
  })
  const anyReference = rows.some((r) => r.summary.start != null)
  const regularity = rows[0].summary.regularity
  const comments = SCORE_KEYS
    .map((k) => ({ key: k, c: commentFor(k, rows.find((r) => r.key === k)?.summary.pct ?? null, tPdf, tScores, locale) }))
    .filter((x) => x.c)
  const toneClass = { positive: 'border-emerald-200 bg-emerald-50 text-emerald-800', warning: 'border-amber-200 bg-amber-50 text-amber-800', neutral: 'border-surface-border bg-surface text-anthracite-light' }
  const excludedInPeriod = prefs.exclusions.filter((e) => measurements.some((m) => m.session_id === e.session_id))
  const excludedNote = excludedInPeriod.length > 0
    ? t('report.excludedNote', { count: excludedInPeriod.length, reasons: exclusionReasonCounts(excludedInPeriod).map((r) => `${tPrepare(`reasons.${r.motivo}`)}${r.n > 1 ? ` ×${r.n}` : ''}`).join(', ') })
    : null

  // Effetto delle sedute (solo professionista): coppie pre/post e mattino + coerenza nel periodo.
  const pairRows: Array<CoherencePairableRow & { m: MeasurementAnalytics }> = measurements.flatMap((m) => {
    const inst = measuredInstant(m)
    const day = measuredDayKey(m)
    if (!inst || !day) return []
    return [{ id: m.session_id, clientId: m.client_id ?? client.id, instantMs: inst.getTime(), dayKey: day, tags: m.tags, reference: isReferenceMeasurement(m, excluded), coherence: normalizeTestType(m.test_type) === 'coherence' || m.coherence_data != null, m }]
  })
  const sessions = [
    ...pairBeforeAfter(pairRows).map((p) => ({ key: `${p.pre.id}-${p.post.id}`, pre: p.pre.m, post: p.post.m, kind: p.kind as string })),
    ...pairMorningCoherence(pairRows).map((p) => ({ key: `${p.morning.id}-${p.coherence.id}`, pre: p.morning.m, post: p.coherence.m, kind: 'coherence' })),
  ].sort((a, b) => (measuredInstant(b.post)?.getTime() ?? 0) - (measuredInstant(a.post)?.getTime() ?? 0))
  const tKind = await getTranslations('common.beforeAfterKind')
  const fmtDelta = (a: number | null, b: number | null, digits = 0) => (a == null || b == null ? '—' : `${b - a > 0 ? '+' : ''}${num(b - a, digits, locale)}`)
  const fmtIdx = (v: number | null, score: boolean) => (v == null ? '—' : score ? num(v, 0, locale) : `${num(v, 1, locale)} ms`)

  const panelMetrics = clientVariant ? ['score_stress', 'score_recupero'] : ['score_stress', 'score_recupero', 'rmssd']

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
        <PrintSection title={t('report.panelsTitle')}>
          <div className="print-card p-6 text-center text-[11px] text-anthracite-lighter">{t('report.noMeasurements')}</div>
        </PrintSection>
      ) : (
        <>
          {/* Pannelli con frase di sintesi e i quattro numeri: la partenza viene dalla storia intera. */}
          <PrintSection title={t('report.panelsTitle')} subtitle={t('report.panelsSubtitle')}>
            <div>
              {!anyReference && <p className="text-[11px] text-amber-700 mb-2">{t('report.noReference')}</p>}
              <AdvancedTrendChart
                measurements={history}
                print
                width={600}
                height={170}
                range={{ from, to }}
                metrics={panelMetrics}
                courseStart={courseStart}
                excluded={Array.from(excluded)}
                annotations={prefs.annotations}
                clientMode={clientVariant}
              />
              <div className="print-card p-3 mt-3 space-y-1 text-[10.5px] text-anthracite-light">
                {regularity && <p>{t('report.regularityLine', { days: regularity.days, total: regularity.total })}</p>}
                {excludedNote && <p>{excludedNote}</p>}
              </div>
            </div>
          </PrintSection>

          {/* Inizio e adesso (solo professionista: per il cliente bastano frase e pannelli) */}
          {!clientVariant && anyReference && (
            <PrintSection title={t('report.startNowTitle')} subtitle={t('report.startNowSubtitle')} avoid>
              <div className="print-card overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead className="bg-surface text-anthracite-lighter">
                    <tr>
                      {[t('report.colIndex'), t('report.colStart'), t('report.colNow'), t('report.colChange'), t('report.colVerdict'), t('report.colCv')].map((h, i) => (
                        <th key={h} className={`px-2 py-1.5 text-[8.5px] uppercase tracking-wide font-medium ${i === 0 || i === 4 ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <StartNowRow key={r.key} name={r.score ? tScores(SCORE_NAME_KEYS[r.key as ScoreKey]) : tCharts('panel.names.rmssd')} color={INDEX_COLORS[r.key]} score={r.score} s={r.summary} cv={r.cv} locale={locale} tPanel={tPanel} t={t} fmtIdx={fmtIdx} />
                    ))}
                  </tbody>
                </table>
                <p className="px-2 py-1.5 text-[9px] text-anthracite-lighter">{t('report.cvHint')}</p>
              </div>
            </PrintSection>
          )}

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

          {/* Effetto delle sedute (solo professionista) */}
          {!clientVariant && (
            <PrintSection title={t('report.sessionsTitle')} subtitle={t('report.sessionsSubtitle')} avoid>
              {sessions.length === 0 ? (
                <div className="print-card p-4 text-[10.5px] text-anthracite-lighter">{t('report.noSessions')}</div>
              ) : (
                <div className="print-card overflow-hidden">
                  <table className="w-full text-[9.5px]">
                    <thead className="bg-surface text-anthracite-lighter">
                      <tr>
                        {[t('report.colDate'), t('report.colPair'), t('report.colStress'), t('report.colRecovery'), t('report.colBalance'), t('report.colEnergy'), t('report.colAdaptation'), t('report.colRmssd'), t('report.colHr')].map((h, i) => (
                          <th key={h} className={`px-2 py-1.5 text-[8.5px] uppercase tracking-wide font-medium ${i >= 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((p) => (
                        <tr key={p.key} className="border-t border-surface-border">
                          <td className="px-2 py-1.5 whitespace-nowrap text-anthracite">{formatMeasuredDate(p.post, undefined, locale)} · {formatMeasuredTime(p.pre, locale)} → {formatMeasuredTime(p.post, locale)}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{p.kind === 'coherence' ? t('report.kindCoherence') : tKind(p.kind as 'treatment' | 'workout')}</td>
                          {SCORE_KEYS.map((k) => <td key={k} className="px-2 py-1.5 text-right tabular-nums">{fmtDelta(p.pre[k], p.post[k])}</td>)}
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmtDelta(p.pre.rmssd, p.post.rmssd, 1)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmtDelta(p.pre.mean_hr, p.post.mean_hr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
                      <tr key={m.id} className={`border-t border-surface-border ${excluded.has(m.session_id) ? 'line-through text-anthracite-lighter' : ''}`}>
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
                      <td className="px-2 py-1.5 whitespace-nowrap">{formatMeasuredDate({ start_time: s.start_time, start_time_utc: s.start_time_utc }, undefined, locale)}</td>
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

type Tr = Awaited<ReturnType<typeof getTranslations>>

function StartNowRow({ name, color, score, s, cv, locale, tPanel, t, fmtIdx }: {
  name: string
  color: string
  score: boolean
  s: ChangeSummary
  cv: number | null
  locale: string
  tPanel: Tr
  t: Tr
  fmtIdx: (v: number | null, score: boolean) => string
}) {
  const pctAbs = s.pct == null ? null : num(Math.abs(s.pct), 0, locale)
  const change = s.pct == null || pctAbs == null ? tPanel('numbers.unknown')
    : s.verdict === 'stable' ? tPanel('numbers.stable')
    : s.verdict === 'improved' ? tPanel('numbers.improved', { pct: pctAbs })
    : s.verdict === 'declined' ? tPanel('numbers.declined', { pct: pctAbs })
    : `${s.pct > 0 ? '+' : ''}${num(s.pct, 0, locale)}%`
  const arrow = s.pct == null ? '' : Math.abs(s.pct) < 0.5 ? '→' : s.pct > 0 ? '↑' : '↓'
  const tone = s.verdict === 'improved' ? '#047857' : s.verdict === 'declined' ? '#BE123C' : '#2B2F33'
  const verdict = s.start == null || s.now == null ? tPanel('numbers.unknown')
    : s.provisional ? tPanel('summary.provisional', { n: s.startProvisional || s.band == null ? s.startN : s.nowN })
    : s.verdict === 'stable' ? tPanel('summary.stable', { band: tPanel('bandOf.course') })
    : s.verdict === 'improved' ? tPanel('summary.realGood', { band: tPanel('bandOf.course') })
    : tPanel('summary.realBad', { band: tPanel('bandOf.course') })
  void t
  return (
    <tr className="border-t border-surface-border print-avoid">
      <td className="px-2 py-1.5">
        <span className="inline-flex items-center gap-1.5 font-medium text-anthracite">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />{name}
        </span>
        <div className="text-[8.5px] text-anthracite-lighter ml-3.5">{s.higherIsBetter ? '↑' : '↓'} {tPanel(s.higherIsBetter ? 'betterHigher' : 'betterLower')}</div>
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtIdx(s.start, score)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtIdx(s.now, score)}</td>
      <td className="px-2 py-1.5 text-right whitespace-nowrap font-medium" style={{ color: tone }}>{arrow} {change}</td>
      <td className="px-2 py-1.5 text-[9px]" style={{ color: s.provisional ? '#B45309' : tone }}>{verdict}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{cv == null ? '—' : `${num(cv, 0, locale)}%`}</td>
    </tr>
  )
}
