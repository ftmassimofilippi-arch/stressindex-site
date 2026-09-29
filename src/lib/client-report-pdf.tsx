// Documento PDF report periodico cliente — solo server (renderToBuffer).
// Stile coerente con measurement-pdf.tsx: teal #4FA39A, anthracite #2F343A.
//
// I18n: il componente NON è nell'albero next-intl, quindi riceve dalla route
// `t` (namespace `pdf`), `tScores` (namespace `scores`) e la `locale` per
// date e numeri. I commenti automatici sono messaggi ICU in `pdf.report.comments`.
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Svg, Rect, Polyline, Circle, Line } from '@react-pdf/renderer'
import type { Tr } from '@/i18n/types'
import type { Locale } from '@/i18n/routing'
import { intlTag, measuredInstant, num } from './format'
import type { Client, MeasurementAnalytics, ProfessionalProfile } from './types'

const COLORS = {
  teal: '#4FA39A',
  tealDark: '#2E746C',
  tealLight: '#E8F4F3',
  anthracite: '#2F343A',
  anthraciteLight: '#4A5058',
  anthraciteLighter: '#6B7280',
  surface: '#F6F7F8',
  border: '#E2E6EA',
  red: '#EF4444',
  amber: '#F59E0B',
  emerald: '#10B981',
} as const

const SCORE_COLORS: Record<ScoreKey, string> = {
  score_stress: '#EF4444',
  score_recupero: '#10B981',
  score_equilibrio: '#3B82F6',
  score_energia: '#F59E0B',
  score_modulazione_infiammatoria: '#A855F7',
}

// Chiave in `scores.names` per ogni colonna. La colonna DB
// score_modulazione_infiammatoria nel report si chiama "Adattamento".
const SCORE_NAME_KEYS: Record<ScoreKey, string> = {
  score_stress: 'names.stressLong',
  score_recupero: 'names.recovery',
  score_equilibrio: 'names.balance',
  score_energia: 'names.energy',
  score_modulazione_infiammatoria: 'names.adaptation',
}

export type ScoreKey =
  | 'score_stress'
  | 'score_recupero'
  | 'score_equilibrio'
  | 'score_energia'
  | 'score_modulazione_infiammatoria'

const SCORE_KEYS: ScoreKey[] = [
  'score_stress',
  'score_recupero',
  'score_equilibrio',
  'score_energia',
  'score_modulazione_infiammatoria',
]

// Segnaposto per valore assente: lo stesso di format.ts (`num`).
const EMPTY = '—'
const PDF_TZ = 'Europe/Rome'

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 44,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: COLORS.anthracite,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1pt solid ${COLORS.border}`,
    paddingBottom: 14,
    marginBottom: 22,
  },
  logo: {
    width: 110,
    height: 30,
    backgroundColor: COLORS.teal,
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingTop: 9,
    borderRadius: 4,
  },
  // Il tedesco è più lungo: la colonna destra può andare a capo, non uscire.
  headerRight: { alignItems: 'flex-end', maxWidth: '65%', flexShrink: 1 },
  proName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite, textAlign: 'right' },
  proSub: { fontSize: 9, color: COLORS.anthraciteLighter, marginTop: 2, textAlign: 'right' },

  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite, marginBottom: 4 },
  // Spaziature compatte: la prima pagina deve contenere 5 card score e i due
  // giorni notevoli anche con i testi tedeschi, più lunghi.
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: COLORS.tealDark, marginTop: 14, marginBottom: 8 },
  h3: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite, marginBottom: 6 },
  muted: { color: COLORS.anthraciteLighter, fontSize: 9 },
  small: { fontSize: 9 },

  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  infoCell: { width: '50%', paddingVertical: 4, paddingRight: 8, flexDirection: 'row' },
  infoLabel: { color: COLORS.anthraciteLighter, fontSize: 9, width: 96, flexShrink: 0 },
  infoValue: { color: COLORS.anthracite, fontSize: 10, fontFamily: 'Helvetica-Bold', flex: 1 },

  // Score cards (page 1)
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  scoreCard: {
    width: '50%',
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  scoreCardInner: {
    backgroundColor: COLORS.surface,
    borderLeft: `3pt solid ${COLORS.teal}`,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  scoreCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  scoreCardTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite, flexShrink: 1, paddingRight: 6 },
  scoreCardTrend: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  // Valore grande centrato + caption "media · N mis." accanto, baseline-aligned.
  // lineHeight 1 evita che la line-box del numero grande invada la riga stat.
  scoreCardMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 8,
  },
  scoreCardMean: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite, lineHeight: 1 },
  scoreCardMeanUnit: { fontSize: 9, color: COLORS.anthraciteLighter, marginLeft: 6 },
  // MIN/MAX/PRIMA/ULTIMA su riga separata, 4 colonne equidistanti (25% ciascuna),
  // separate dal valore grande da un bordo superiore.
  scoreCardStats: {
    flexDirection: 'row',
    borderTop: `0.5pt solid ${COLORS.border}`,
    paddingTop: 6,
  },
  scoreCardStat: { width: '25%', alignItems: 'center' },
  scoreCardStatLabel: { fontSize: 7, color: COLORS.anthraciteLighter, textTransform: 'uppercase', marginBottom: 2, textAlign: 'center' },
  scoreCardStatValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite, textAlign: 'center' },

  // Best / worst day
  daysRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  dayCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    border: `1pt solid ${COLORS.border}`,
  },
  dayLabel: { fontSize: 9, color: COLORS.anthraciteLighter, marginBottom: 2 },
  dayDate: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite },
  dayValue: { fontSize: 9, color: COLORS.anthraciteLight, marginTop: 4 },

  // Trend section (page 2)
  trendBlock: { marginTop: 10, marginBottom: 8 },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  trendTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite, paddingRight: 8 },
  trendValues: { fontSize: 9, color: COLORS.anthraciteLighter, flexShrink: 1, textAlign: 'right' },
  trendComment: {
    fontSize: 9,
    marginTop: 6,
    padding: 8,
    borderRadius: 4,
    color: COLORS.anthracite,
  },

  // Disclaimer
  disclaimerBox: {
    backgroundColor: COLORS.surface,
    border: `1pt solid ${COLORS.border}`,
    borderRadius: 8,
    padding: 18,
    marginTop: 20,
    marginBottom: 24,
  },
  disclaimerText: {
    fontSize: 10,
    color: COLORS.anthraciteLight,
    lineHeight: 1.6,
  },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: COLORS.anthraciteLighter,
    borderTop: `0.5pt solid ${COLORS.border}`,
    paddingTop: 8,
  },
  footerLeft: { flexShrink: 1, paddingRight: 12 },
})

// ---------------------------------------------------------------------------
// Formattazione (date e numeri nella lingua richiesta)
// ---------------------------------------------------------------------------
function fmtScore(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return EMPTY
  return Math.round(v).toString()
}

// Data breve di un istante già normalizzato (vedi `measuredInstant` in format.ts),
// nel fuso italiano.
function fmtInstantShort(d: Date | null, locale: Locale): string {
  if (!d || Number.isNaN(d.getTime())) return EMPTY
  return new Intl.DateTimeFormat(intlTag(locale), { day: 'numeric', month: 'short', year: 'numeric', timeZone: PDF_TZ }).format(d)
}

// Le date di periodo (YYYY-MM-DD) sono giorni di calendario senza orario: si
// formattano in UTC per non farle slittare di un giorno sul server.
function fmtIsoDay(day: string, locale: Locale): string {
  const d = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return day
  return new Intl.DateTimeFormat(intlTag(locale), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d)
}

function fmtDateTimeLong(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlTag(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PDF_TZ,
  }).format(d)
}

function ageYears(birth?: string | null): number | null {
  if (!birth) return null
  const d = new Date(birth)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  let years = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) years--
  return years
}

function fmtAge(birth: string | null | undefined, t: Tr): string {
  const years = ageYears(birth)
  return years == null ? EMPTY : t('common.years', { count: years })
}

function fmtSex(s: string | null | undefined, t: Tr): string {
  if (s === 'M') return t('common.sexMale')
  if (s === 'F') return t('common.sexFemale')
  if (s === 'X') return t('common.sexOther')
  return EMPTY
}

// Variazione percentuale con segno, nel formato della lingua ("+12,5%").
function fmtDelta(pct: number | null, locale: Locale): string {
  if (pct == null || Number.isNaN(pct)) return EMPTY
  const sign = pct > 0 ? '+' : ''
  return `${sign}${num(pct, 1, locale)}%`
}

// ---------------------------------------------------------------------------
// Aggregati
// ---------------------------------------------------------------------------
export type ScoreStats = {
  count: number
  mean: number | null
  min: number | null
  max: number | null
  first: number | null
  last: number | null
  deltaPct: number | null // ((last - first) / first) * 100
  series: Array<{ date: string; value: number | null }>
}

function computeScoreStats(measurements: MeasurementAnalytics[], key: ScoreKey): ScoreStats {
  // measurements arrivano ordinate desc per measured_at → invertiamo per ordine cronologico
  const series = [...measurements].reverse().map((m) => ({
    date: m.measured_at,
    value: (m[key] as number | null | undefined) ?? null,
  }))
  const values = series.map((s) => s.value).filter((v): v is number => v != null && Number.isFinite(v))
  if (values.length === 0) {
    return { count: 0, mean: null, min: null, max: null, first: null, last: null, deltaPct: null, series }
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
  const firstIdx = series.findIndex((s) => s.value != null)
  const lastIdx = series.length - 1 - [...series].reverse().findIndex((s) => s.value != null)
  const first = firstIdx >= 0 ? series[firstIdx]!.value! : null
  const last = lastIdx >= 0 ? series[lastIdx]!.value! : null
  const deltaPct = first != null && first !== 0 && last != null ? ((last - first) / first) * 100 : null
  return { count: values.length, mean, min, max, first, last, deltaPct, series }
}

export type ReportAggregates = {
  count: number
  stats: Record<ScoreKey, ScoreStats>
  // `date` è il measured_at grezzo, `instant` l'istante normalizzato per la stampa.
  bestDay: { date: string; instant: Date | null; score: number } | null // stress più basso = meglio
  worstDay: { date: string; instant: Date | null; score: number } | null // stress più alto = peggio
}

export function computeReportAggregates(measurements: MeasurementAnalytics[]): ReportAggregates {
  const stats = SCORE_KEYS.reduce((acc, k) => {
    acc[k] = computeScoreStats(measurements, k)
    return acc
  }, {} as Record<ScoreKey, ScoreStats>)

  let best: ReportAggregates['bestDay'] = null
  let worst: ReportAggregates['worstDay'] = null
  for (const m of measurements) {
    const s = m.score_stress
    if (s == null) continue
    if (best == null || s < best.score) best = { date: m.measured_at, instant: measuredInstant(m), score: s }
    if (worst == null || s > worst.score) worst = { date: m.measured_at, instant: measuredInstant(m), score: s }
  }
  return { count: measurements.length, stats, bestDay: best, worstDay: worst }
}

// Commento automatico: stress in calo è positivo; recupero/energia in aumento è positivo.
// Le frasi sono messaggi ICU in `pdf.report.comments`, nella lingua della richiesta.
function commentFor(
  key: ScoreKey,
  deltaPct: number | null,
  t: Tr,
  tScores: Tr,
  locale: Locale,
): { text: string; tone: 'positive' | 'warning' | 'neutral' } | null {
  if (deltaPct == null || Number.isNaN(deltaPct)) return null
  const isInverted = key === 'score_stress' // stress inverso

  if (Math.abs(deltaPct) <= 10) {
    return { text: t('report.comments.stable', { delta: fmtDelta(deltaPct, locale) }), tone: 'neutral' }
  }
  const pct = num(Math.abs(deltaPct), 1, locale)
  if (isInverted) {
    if (deltaPct < -10) return { text: t('report.comments.stressDown', { pct }), tone: 'positive' }
    return { text: t('report.comments.stressUp', { pct }), tone: 'warning' }
  }
  // recupero / energia / equilibrio / adattamento: aumento = positivo.
  // In tedesco i sostantivi restano maiuscoli anche a metà frase.
  const name = tScores(SCORE_NAME_KEYS[key])
  const score = locale === 'de' ? name : name.toLowerCase()
  if (deltaPct > 10) return { text: t('report.comments.scoreUp', { score, pct }), tone: 'positive' }
  return { text: t('report.comments.scoreDown', { score, pct }), tone: 'warning' }
}

// ---------------------------------------------------------------------------
// Sparkline SVG
// ---------------------------------------------------------------------------
function Sparkline({
  series,
  color,
  width = 240,
  height = 40,
}: {
  series: Array<{ date: string; value: number | null }>
  color: string
  width?: number
  height?: number
}) {
  const points = series.map((p, i) => ({ x: i, value: p.value })).filter((p): p is { x: number; value: number } => p.value != null)
  if (points.length === 0) {
    return (
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} fill={COLORS.surface} />
        <Line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={COLORS.border} strokeWidth={1} strokeDasharray="2,2" />
      </Svg>
    )
  }
  const xs = points.map((p) => p.x)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const spanX = maxX - minX || 1
  // Per score 0–100 fissiamo dominio per confronti visivi coerenti
  const minY = 0
  const maxY = 100
  const padX = 4
  const padY = 4
  const w = width - padX * 2
  const h = height - padY * 2
  const polyPoints = points
    .map((p) => {
      const x = padX + ((p.x - minX) / spanX) * w
      const y = padY + h - ((p.value - minY) / (maxY - minY)) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const last = points[points.length - 1]!
  const lastX = padX + ((last.x - minX) / spanX) * w
  const lastY = padY + h - ((last.value - minY) / (maxY - minY)) * h

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill="#FFFFFF" />
      {/* baseline 50 */}
      <Line
        x1={padX}
        y1={padY + h - (50 / 100) * h}
        x2={padX + w}
        y2={padY + h - (50 / 100) * h}
        stroke={COLORS.border}
        strokeWidth={0.5}
        strokeDasharray="2,2"
      />
      <Polyline points={polyPoints} stroke={color} strokeWidth={1.5} fill="none" />
      <Circle cx={lastX} cy={lastY} r={2} fill={color} />
    </Svg>
  )
}

// ---------------------------------------------------------------------------
// Header / Footer
// ---------------------------------------------------------------------------
function Header({
  professional,
  periodLabel,
  t,
}: {
  professional: ProfessionalProfile | null
  periodLabel: string
  t: Tr
}) {
  const proName = professional ? [professional.titolo, professional.nome, professional.cognome].filter(Boolean).join(' ').trim() : ''
  const studio = professional?.nome_studio ?? ''
  return (
    <View style={styles.header} fixed>
      <Text style={styles.logo}>{t('common.brand')}</Text>
      <View style={styles.headerRight}>
        {proName ? <Text style={styles.proName}>{proName}</Text> : null}
        {studio ? <Text style={styles.proSub}>{studio}</Text> : null}
        <Text style={styles.proSub}>{t('report.headerPeriod', { period: periodLabel })}</Text>
      </View>
    </View>
  )
}

function Footer({ generatedAt, t }: { generatedAt: string; t: Tr }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerLeft}>{t('common.generatedFooter', { date: generatedAt })}</Text>
      <Text render={({ pageNumber, totalPages }) => t('common.pageOf', { page: pageNumber, total: totalPages })} />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------
export function ClientReportPdfDocument({
  client,
  professional,
  measurements,
  dateFrom,
  dateTo,
  t,
  tScores,
  locale,
}: {
  client: Client
  professional: ProfessionalProfile | null
  measurements: MeasurementAnalytics[]
  dateFrom: string // ISO date YYYY-MM-DD
  dateTo: string // ISO date YYYY-MM-DD
  /** Traduttore del namespace `pdf` (getTranslator(locale, 'pdf')). */
  t: Tr
  /** Traduttore del namespace `scores` (nomi degli score). */
  tScores: Tr
  locale: Locale
}) {
  const aggregates = computeReportAggregates(measurements)
  const periodLabel = t('report.periodRange', { from: fmtIsoDay(dateFrom, locale), to: fmtIsoDay(dateTo, locale) })
  const generatedAt = fmtDateTimeLong(new Date(), locale)
  const proName = professional ? [professional.titolo, professional.nome, professional.cognome].filter(Boolean).join(' ').trim() : ''
  const clientName = [client.cognome, client.nome].filter(Boolean).join(' ').trim() || t('common.clientFallback')

  const trendKeys: ScoreKey[] = ['score_stress', 'score_recupero', 'score_energia']

  return (
    <Document
      title={t('report.docTitle', { client: clientName, from: dateFrom, to: dateTo })}
      author={proName || t('common.brand')}
      subject={t('report.subject', { period: periodLabel })}
      creator="Stress Index"
      producer="Stress Index"
    >
      {/* ====================================================================
          PAGINA 1 — RIEPILOGO PERIODO
      ==================================================================== */}
      <Page size="A4" style={styles.page}>
        <Header professional={professional} periodLabel={periodLabel} t={t} />

        <Text style={styles.h1}>{t('report.title')}</Text>
        <Text style={styles.muted}>{periodLabel}</Text>

        <Text style={styles.h2}>{t('common.clientData')}</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t('common.firstName')}</Text>
            <Text style={styles.infoValue}>{client.nome ?? EMPTY}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t('common.lastName')}</Text>
            <Text style={styles.infoValue}>{client.cognome ?? EMPTY}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t('common.age')}</Text>
            <Text style={styles.infoValue}>{fmtAge(client.data_nascita, t)}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t('common.sex')}</Text>
            <Text style={styles.infoValue}>{fmtSex(client.sesso, t)}</Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: COLORS.tealLight,
            borderRadius: 6,
            paddingVertical: 9,
            paddingHorizontal: 12,
            marginBottom: 6,
          }}
        >
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.tealDark }}>
            {t('report.measurementsInPeriod', { count: aggregates.count, period: periodLabel })}
          </Text>
        </View>

        {aggregates.count === 0 ? (
          <Text style={styles.muted}>{t('report.noMeasurements')}</Text>
        ) : (
          <>
            <Text style={styles.h2}>{t('report.scoresInPeriod')}</Text>
            <View style={styles.scoreGrid}>
              {SCORE_KEYS.map((key) => {
                const s = aggregates.stats[key]
                const color = SCORE_COLORS[key]
                const inverted = key === 'score_stress'
                const trendOk = s.deltaPct != null
                  ? (inverted ? s.deltaPct < 0 : s.deltaPct > 0)
                  : null
                const trendColor = trendOk == null
                  ? COLORS.anthraciteLighter
                  : trendOk
                    ? COLORS.emerald
                    : COLORS.red
                return (
                  <View key={key} style={styles.scoreCard}>
                    <View style={[styles.scoreCardInner, { borderLeftColor: color }]}>
                      <View style={styles.scoreCardHeader}>
                        <Text style={styles.scoreCardTitle}>{tScores(SCORE_NAME_KEYS[key])}</Text>
                        {/* Il segno della variazione indica la direzione; il colore dice se è favorevole. */}
                        <Text style={[styles.scoreCardTrend, { color: trendColor }]}>{fmtDelta(s.deltaPct, locale)}</Text>
                      </View>
                      <View style={styles.scoreCardMain}>
                        <Text style={styles.scoreCardMean}>{fmtScore(s.mean)}</Text>
                        <Text style={styles.scoreCardMeanUnit}>{t('report.meanOf', { count: s.count })}</Text>
                      </View>
                      <View style={styles.scoreCardStats}>
                        <View style={styles.scoreCardStat}>
                          <Text style={styles.scoreCardStatLabel}>{t('report.min')}</Text>
                          <Text style={styles.scoreCardStatValue}>{fmtScore(s.min)}</Text>
                        </View>
                        <View style={styles.scoreCardStat}>
                          <Text style={styles.scoreCardStatLabel}>{t('report.max')}</Text>
                          <Text style={styles.scoreCardStatValue}>{fmtScore(s.max)}</Text>
                        </View>
                        <View style={styles.scoreCardStat}>
                          <Text style={styles.scoreCardStatLabel}>{t('report.first')}</Text>
                          <Text style={styles.scoreCardStatValue}>{fmtScore(s.first)}</Text>
                        </View>
                        <View style={styles.scoreCardStat}>
                          <Text style={styles.scoreCardStatLabel}>{t('report.last')}</Text>
                          <Text style={styles.scoreCardStatValue}>{fmtScore(s.last)}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>

            {/* wrap={false}: le due card non vanno spezzate tra due pagine (il
                testo si sovrapponeva al piè di pagina). */}
            <View wrap={false}>
            <Text style={styles.h2}>{t('report.notableDays')}</Text>
            <View style={styles.daysRow}>
              <View style={[styles.dayCard, { borderLeft: `3pt solid ${COLORS.emerald}` }]}>
                <Text style={styles.dayLabel}>{t('report.bestDay')}</Text>
                <Text style={styles.dayDate}>
                  {aggregates.bestDay ? fmtInstantShort(aggregates.bestDay.instant, locale) : EMPTY}
                </Text>
                <Text style={styles.dayValue}>
                  {t('report.stressValue', { value: aggregates.bestDay ? fmtScore(aggregates.bestDay.score) : EMPTY })}
                </Text>
              </View>
              <View style={[styles.dayCard, { borderLeft: `3pt solid ${COLORS.red}` }]}>
                <Text style={styles.dayLabel}>{t('report.worstDay')}</Text>
                <Text style={styles.dayDate}>
                  {aggregates.worstDay ? fmtInstantShort(aggregates.worstDay.instant, locale) : EMPTY}
                </Text>
                <Text style={styles.dayValue}>
                  {t('report.stressValue', { value: aggregates.worstDay ? fmtScore(aggregates.worstDay.score) : EMPTY })}
                </Text>
              </View>
            </View>
            </View>
          </>
        )}

        <Footer generatedAt={generatedAt} t={t} />
      </Page>

      {/* ====================================================================
          PAGINA 2 — TREND
      ==================================================================== */}
      <Page size="A4" style={styles.page}>
        <Header professional={professional} periodLabel={periodLabel} t={t} />

        <Text style={styles.h1}>{t('report.trendTitle')}</Text>
        <Text style={styles.muted}>{t('report.trendIntro')}</Text>

        {aggregates.count === 0 ? (
          <Text style={[styles.muted, { marginTop: 20 }]}>{t('report.noTrendData')}</Text>
        ) : (
          SCORE_KEYS.map((key) => {
            const s = aggregates.stats[key]
            const color = SCORE_COLORS[key]
            const commentary = trendKeys.includes(key) ? commentFor(key, s.deltaPct, t, tScores, locale) : null
            const commentaryBg = commentary
              ? commentary.tone === 'positive'
                ? '#ECFDF5'
                : commentary.tone === 'warning'
                  ? '#FEF2F2'
                  : COLORS.surface
              : COLORS.surface
            const commentaryColor = commentary
              ? commentary.tone === 'positive'
                ? COLORS.emerald
                : commentary.tone === 'warning'
                  ? COLORS.red
                  : COLORS.anthraciteLight
              : COLORS.anthraciteLight
            return (
              <View key={key} style={styles.trendBlock} wrap={false}>
                <View style={styles.trendHeader}>
                  <Text style={styles.trendTitle}>{tScores(SCORE_NAME_KEYS[key])}</Text>
                  <Text style={styles.trendValues}>
                    {t('report.trendStats', {
                      mean: fmtScore(s.mean),
                      min: fmtScore(s.min),
                      max: fmtScore(s.max),
                      delta: fmtDelta(s.deltaPct, locale),
                    })}
                  </Text>
                </View>
                <Sparkline series={s.series} color={color} width={510} height={40} />
                {commentary ? (
                  <Text
                    style={[
                      styles.trendComment,
                      { backgroundColor: commentaryBg, color: commentaryColor },
                    ]}
                  >
                    {commentary.text}
                  </Text>
                ) : null}
              </View>
            )
          })
        )}

        <Footer generatedAt={generatedAt} t={t} />
      </Page>

      {/* ====================================================================
          PAGINA 3 — DISCLAIMER
      ==================================================================== */}
      <Page size="A4" style={styles.page}>
        <Header professional={professional} periodLabel={periodLabel} t={t} />

        <Text style={styles.h1}>{t('common.infoAndDisclaimer')}</Text>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>{t('common.disclaimerPart1')}</Text>
          <Text style={[styles.disclaimerText, { marginTop: 10 }]}>{t('common.disclaimerPart2')}</Text>
        </View>

        <Text style={styles.h2}>{t('report.detailsTitle')}</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t('report.period')}</Text>
            <Text style={styles.infoValue}>{periodLabel}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t('report.measurements')}</Text>
            <Text style={styles.infoValue}>{aggregates.count}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t('common.generatedOn')}</Text>
            <Text style={styles.infoValue}>{generatedAt}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t('common.professional')}</Text>
            <Text style={styles.infoValue}>{proName || EMPTY}</Text>
          </View>
          {professional?.nome_studio ? (
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>{t('common.studio')}</Text>
              <Text style={styles.infoValue}>{professional.nome_studio}</Text>
            </View>
          ) : null}
          {professional?.sito_web ? (
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>{t('common.website')}</Text>
              <Text style={styles.infoValue}>{professional.sito_web}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ marginTop: 30, alignItems: 'center' }}>
          <Text style={[styles.muted, { fontSize: 9 }]}>{t('common.generatedBy')}</Text>
        </View>

        <Footer generatedAt={generatedAt} t={t} />
      </Page>
    </Document>
  )
}
