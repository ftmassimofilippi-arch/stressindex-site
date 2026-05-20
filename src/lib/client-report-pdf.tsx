// Documento PDF report periodico cliente — solo server (renderToBuffer).
// Stile coerente con measurement-pdf.tsx: teal #4FA39A, anthracite #2F343A.
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Svg, Rect, Polyline, Circle, Line } from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
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

const SCORE_LABELS: Record<ScoreKey, string> = {
  score_stress: 'Indice di Stress',
  score_recupero: 'Recupero',
  score_equilibrio: 'Equilibrio',
  score_energia: 'Energia',
  score_modulazione_infiammatoria: 'Modulazione Infiammatoria',
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
  headerRight: { alignItems: 'flex-end' },
  proName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite },
  proSub: { fontSize: 9, color: COLORS.anthraciteLighter, marginTop: 2 },

  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite, marginBottom: 4 },
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: COLORS.tealDark, marginTop: 18, marginBottom: 8 },
  h3: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite, marginBottom: 6 },
  muted: { color: COLORS.anthraciteLighter, fontSize: 9 },
  small: { fontSize: 9 },

  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  infoCell: { width: '50%', paddingVertical: 4, flexDirection: 'row' },
  infoLabel: { color: COLORS.anthraciteLighter, fontSize: 9, width: 90 },
  infoValue: { color: COLORS.anthracite, fontSize: 10, fontFamily: 'Helvetica-Bold' },

  // Score cards (page 1)
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  scoreCard: {
    width: '50%',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  scoreCardInner: {
    backgroundColor: COLORS.surface,
    borderLeft: `3pt solid ${COLORS.teal}`,
    borderRadius: 4,
    padding: 10,
  },
  scoreCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  scoreCardTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite },
  scoreCardTrend: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  scoreCardMain: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  scoreCardMean: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite },
  scoreCardMeanUnit: { fontSize: 9, color: COLORS.anthraciteLighter, marginLeft: 4 },
  scoreCardStats: { flexDirection: 'row', gap: 12 },
  scoreCardStat: { flexDirection: 'column' },
  scoreCardStatLabel: { fontSize: 7, color: COLORS.anthraciteLighter, textTransform: 'uppercase' },
  scoreCardStatValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite },

  // Best / worst day
  daysRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  dayCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    padding: 12,
    border: `1pt solid ${COLORS.border}`,
  },
  dayLabel: { fontSize: 9, color: COLORS.anthraciteLighter, marginBottom: 2 },
  dayDate: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite },
  dayValue: { fontSize: 9, color: COLORS.anthraciteLight, marginTop: 4 },

  // Trend section (page 2)
  trendBlock: { marginBottom: 16 },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  trendTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite },
  trendValues: { fontSize: 9, color: COLORS.anthraciteLighter },
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
})

// ---------------------------------------------------------------------------
// Formattazione
// ---------------------------------------------------------------------------
function fmtScore(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return '—'
  return Math.round(v).toString()
}

function fmtDateShort(d?: string | null): string {
  if (!d) return '—'
  try { return format(parseISO(d), 'd MMM yyyy', { locale: it }) } catch { return d }
}

function fmtAge(birth?: string | null): string {
  if (!birth) return '—'
  try {
    const d = parseISO(birth)
    const today = new Date()
    let years = today.getFullYear() - d.getFullYear()
    const m = today.getMonth() - d.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) years--
    return `${years} anni`
  } catch { return '—' }
}

function fmtSex(s?: string | null): string {
  if (s === 'M') return 'Uomo'
  if (s === 'F') return 'Donna'
  if (s === 'X') return 'Altro'
  return '—'
}

function fmtDelta(pct: number | null): string {
  if (pct == null || Number.isNaN(pct)) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
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
  bestDay: { date: string; score: number } | null // stress più basso = meglio
  worstDay: { date: string; score: number } | null // stress più alto = peggio
}

export function computeReportAggregates(measurements: MeasurementAnalytics[]): ReportAggregates {
  const stats = SCORE_KEYS.reduce((acc, k) => {
    acc[k] = computeScoreStats(measurements, k)
    return acc
  }, {} as Record<ScoreKey, ScoreStats>)

  let best: { date: string; score: number } | null = null
  let worst: { date: string; score: number } | null = null
  for (const m of measurements) {
    const s = m.score_stress
    if (s == null) continue
    if (best == null || s < best.score) best = { date: m.measured_at, score: s }
    if (worst == null || s > worst.score) worst = { date: m.measured_at, score: s }
  }
  return { count: measurements.length, stats, bestDay: best, worstDay: worst }
}

// Commento automatico: stress in calo è positivo; recupero/energia in aumento è positivo.
function commentFor(key: ScoreKey, deltaPct: number | null): { text: string; tone: 'positive' | 'warning' | 'neutral' } | null {
  if (deltaPct == null || Number.isNaN(deltaPct)) return null
  const label = SCORE_LABELS[key].toLowerCase()
  const isInverted = key === 'score_stress' // stress inverso

  if (Math.abs(deltaPct) <= 10) {
    return { text: `Situazione stabile nel periodo analizzato (variazione ${fmtDelta(deltaPct)}).`, tone: 'neutral' }
  }
  if (isInverted) {
    if (deltaPct < -10) {
      return { text: `Trend positivo: lo stress si è ridotto del ${Math.abs(deltaPct).toFixed(1)}% nel periodo.`, tone: 'positive' }
    }
    return { text: `Attenzione: lo stress è aumentato del ${deltaPct.toFixed(1)}% nel periodo.`, tone: 'warning' }
  }
  // recupero / energia / equilibrio / modulazione: aumento = positivo
  if (deltaPct > 10) {
    return { text: `Trend positivo: ${label} è aumentato del ${deltaPct.toFixed(1)}% nel periodo.`, tone: 'positive' }
  }
  return { text: `Attenzione: ${label} è diminuito del ${Math.abs(deltaPct).toFixed(1)}% nel periodo.`, tone: 'warning' }
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
}: {
  professional: ProfessionalProfile | null
  periodLabel: string
}) {
  const proName = professional ? [professional.titolo, professional.nome, professional.cognome].filter(Boolean).join(' ').trim() : ''
  const studio = professional?.nome_studio ?? ''
  return (
    <View style={styles.header} fixed>
      <Text style={styles.logo}>Stress Index</Text>
      <View style={styles.headerRight}>
        {proName ? <Text style={styles.proName}>{proName}</Text> : null}
        {studio ? <Text style={styles.proSub}>{studio}</Text> : null}
        <Text style={styles.proSub}>Report {periodLabel}</Text>
      </View>
    </View>
  )
}

function Footer({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Generato il {generatedAt} · Stress Index</Text>
      <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`} />
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
}: {
  client: Client
  professional: ProfessionalProfile | null
  measurements: MeasurementAnalytics[]
  dateFrom: string // ISO date YYYY-MM-DD
  dateTo: string // ISO date YYYY-MM-DD
}) {
  const aggregates = computeReportAggregates(measurements)
  const periodLabel = `${fmtDateShort(dateFrom)} → ${fmtDateShort(dateTo)}`
  const generatedAt = format(new Date(), "dd MMMM yyyy 'alle' HH:mm", { locale: it })
  const proName = professional ? [professional.titolo, professional.nome, professional.cognome].filter(Boolean).join(' ').trim() : ''

  const trendKeys: ScoreKey[] = ['score_stress', 'score_recupero', 'score_energia']

  return (
    <Document
      title={`Stress Index Report - ${client.cognome ?? ''} ${client.nome ?? ''} - ${dateFrom} ${dateTo}`}
      author={proName || 'Stress Index'}
      subject={`Report periodico HRV ${periodLabel}`}
      creator="Stress Index"
      producer="Stress Index"
    >
      {/* ====================================================================
          PAGINA 1 — RIEPILOGO PERIODO
      ==================================================================== */}
      <Page size="A4" style={styles.page}>
        <Header professional={professional} periodLabel={periodLabel} />

        <Text style={styles.h1}>Report periodico HRV</Text>
        <Text style={styles.muted}>{periodLabel}</Text>

        <Text style={styles.h2}>Dati cliente</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Nome</Text>
            <Text style={styles.infoValue}>{client.nome ?? '—'}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Cognome</Text>
            <Text style={styles.infoValue}>{client.cognome ?? '—'}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Età</Text>
            <Text style={styles.infoValue}>{fmtAge(client.data_nascita)}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Sesso</Text>
            <Text style={styles.infoValue}>{fmtSex(client.sesso)}</Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: COLORS.tealLight,
            borderRadius: 6,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.tealDark }}>
            {aggregates.count} {aggregates.count === 1 ? 'misurazione' : 'misurazioni'} nel periodo {periodLabel}
          </Text>
        </View>

        {aggregates.count === 0 ? (
          <Text style={styles.muted}>
            Nessuna misurazione registrata nell&apos;intervallo selezionato. Modifica il periodo per generare il report.
          </Text>
        ) : (
          <>
            <Text style={styles.h2}>Score nel periodo</Text>
            <View style={styles.scoreGrid}>
              {SCORE_KEYS.map((key) => {
                const s = aggregates.stats[key]
                const color = SCORE_COLORS[key]
                const inverted = key === 'score_stress'
                const trendUp = s.deltaPct != null && s.deltaPct > 0
                const trendOk = s.deltaPct != null
                  ? (inverted ? s.deltaPct < 0 : s.deltaPct > 0)
                  : null
                const trendColor = trendOk == null
                  ? COLORS.anthraciteLighter
                  : trendOk
                    ? COLORS.emerald
                    : COLORS.red
                const arrow = s.deltaPct == null ? '·' : trendUp ? '↑' : '↓'
                return (
                  <View key={key} style={styles.scoreCard}>
                    <View style={[styles.scoreCardInner, { borderLeftColor: color }]}>
                      <View style={styles.scoreCardHeader}>
                        <Text style={styles.scoreCardTitle}>{SCORE_LABELS[key]}</Text>
                        <Text style={[styles.scoreCardTrend, { color: trendColor }]}>
                          {arrow} {fmtDelta(s.deltaPct)}
                        </Text>
                      </View>
                      <View style={styles.scoreCardMain}>
                        <Text style={styles.scoreCardMean}>{fmtScore(s.mean)}</Text>
                        <Text style={styles.scoreCardMeanUnit}>media · {s.count} mis.</Text>
                      </View>
                      <View style={styles.scoreCardStats}>
                        <View style={styles.scoreCardStat}>
                          <Text style={styles.scoreCardStatLabel}>Min</Text>
                          <Text style={styles.scoreCardStatValue}>{fmtScore(s.min)}</Text>
                        </View>
                        <View style={styles.scoreCardStat}>
                          <Text style={styles.scoreCardStatLabel}>Max</Text>
                          <Text style={styles.scoreCardStatValue}>{fmtScore(s.max)}</Text>
                        </View>
                        <View style={styles.scoreCardStat}>
                          <Text style={styles.scoreCardStatLabel}>Prima</Text>
                          <Text style={styles.scoreCardStatValue}>{fmtScore(s.first)}</Text>
                        </View>
                        <View style={styles.scoreCardStat}>
                          <Text style={styles.scoreCardStatLabel}>Ultima</Text>
                          <Text style={styles.scoreCardStatValue}>{fmtScore(s.last)}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>

            <Text style={styles.h2}>Giorni notevoli</Text>
            <View style={styles.daysRow}>
              <View style={[styles.dayCard, { borderLeft: `3pt solid ${COLORS.emerald}` }]}>
                <Text style={styles.dayLabel}>Giorno migliore (stress minimo)</Text>
                <Text style={styles.dayDate}>
                  {aggregates.bestDay ? fmtDateShort(aggregates.bestDay.date) : '—'}
                </Text>
                <Text style={styles.dayValue}>
                  Stress: {aggregates.bestDay ? fmtScore(aggregates.bestDay.score) : '—'} / 100
                </Text>
              </View>
              <View style={[styles.dayCard, { borderLeft: `3pt solid ${COLORS.red}` }]}>
                <Text style={styles.dayLabel}>Giorno peggiore (stress massimo)</Text>
                <Text style={styles.dayDate}>
                  {aggregates.worstDay ? fmtDateShort(aggregates.worstDay.date) : '—'}
                </Text>
                <Text style={styles.dayValue}>
                  Stress: {aggregates.worstDay ? fmtScore(aggregates.worstDay.score) : '—'} / 100
                </Text>
              </View>
            </View>
          </>
        )}

        <Footer generatedAt={generatedAt} />
      </Page>

      {/* ====================================================================
          PAGINA 2 — TREND
      ==================================================================== */}
      <Page size="A4" style={styles.page}>
        <Header professional={professional} periodLabel={periodLabel} />

        <Text style={styles.h1}>Andamento nel periodo</Text>
        <Text style={styles.muted}>
          Sparkline e commento automatico per ciascuno score. Linea tratteggiata = baseline 50 / 100.
        </Text>

        {aggregates.count === 0 ? (
          <Text style={[styles.muted, { marginTop: 20 }]}>
            Nessun dato disponibile per generare il trend.
          </Text>
        ) : (
          SCORE_KEYS.map((key) => {
            const s = aggregates.stats[key]
            const color = SCORE_COLORS[key]
            const commentary = trendKeys.includes(key) ? commentFor(key, s.deltaPct) : null
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
                  <Text style={styles.trendTitle}>{SCORE_LABELS[key]}</Text>
                  <Text style={styles.trendValues}>
                    Media {fmtScore(s.mean)} · Min {fmtScore(s.min)} · Max {fmtScore(s.max)} · Δ {fmtDelta(s.deltaPct)}
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

        <Footer generatedAt={generatedAt} />
      </Page>

      {/* ====================================================================
          PAGINA 3 — DISCLAIMER
      ==================================================================== */}
      <Page size="A4" style={styles.page}>
        <Header professional={professional} periodLabel={periodLabel} />

        <Text style={styles.h1}>Informazioni e disclaimer</Text>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            I dati forniti da Stress Index hanno finalità informativa e non costituiscono diagnosi medica.
            L&apos;analisi della variabilità della frequenza cardiaca (HRV) è uno strumento di valutazione funzionale
            del sistema nervoso autonomo e non sostituisce in alcun modo l&apos;esame clinico, la diagnosi o la
            terapia di un medico.
          </Text>
          <Text style={[styles.disclaimerText, { marginTop: 10 }]}>
            Per qualsiasi decisione clinica, terapeutica o relativa al proprio stato di salute, consultare
            il proprio medico curante o uno specialista qualificato.
          </Text>
        </View>

        <Text style={styles.h2}>Dettagli report</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Periodo</Text>
            <Text style={styles.infoValue}>{periodLabel}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Misurazioni</Text>
            <Text style={styles.infoValue}>{aggregates.count}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Generato il</Text>
            <Text style={styles.infoValue}>{generatedAt}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Professionista</Text>
            <Text style={styles.infoValue}>{proName || '—'}</Text>
          </View>
          {professional?.nome_studio ? (
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Studio</Text>
              <Text style={styles.infoValue}>{professional.nome_studio}</Text>
            </View>
          ) : null}
          {professional?.sito_web ? (
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Sito web</Text>
              <Text style={styles.infoValue}>{professional.sito_web}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ marginTop: 30, alignItems: 'center' }}>
          <Text style={[styles.muted, { fontSize: 9 }]}>
            Generato da Stress Index — stressindex.io
          </Text>
        </View>

        <Footer generatedAt={generatedAt} />
      </Page>
    </Document>
  )
}
