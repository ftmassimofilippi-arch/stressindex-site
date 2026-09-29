// Documento PDF singola misurazione — solo server (renderToBuffer).
// Stile coerente con il brand Stress Index: teal #4FA39A, anthracite #2F343A.
//
// I18n: il componente NON è nell'albero next-intl, quindi riceve dalla route
// `t` (namespace `pdf`), `tScores` (namespace `scores`) e la `locale` per
// date e numeri. Vedi src/lib/i18n-server.ts.
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Svg, Rect } from '@react-pdf/renderer'
import type { Tr } from '@/i18n/types'
import type { Locale } from '@/i18n/routing'
import { intlTag, measuredDayKey, measuredInstant, num, toNum } from './format'
import { normalizeTestType } from './measurement-type'
import { pdfText as tx } from './pdf-text'
import type { Client, MeasurementWithSession, ProfessionalProfile } from './types'

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

const SCORE_COLORS = {
  stress: COLORS.red,
  recovery: COLORS.emerald,
  balance: '#3B82F6',
  energy: COLORS.amber,
  adaptation: '#A855F7',
} as const

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
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: COLORS.tealDark, marginTop: 18, marginBottom: 8 },
  h3: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite, marginBottom: 6 },
  muted: { color: COLORS.anthraciteLighter, fontSize: 9 },
  small: { fontSize: 9 },
  card: {
    backgroundColor: COLORS.surface,
    border: `1pt solid ${COLORS.border}`,
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  infoCell: {
    width: '50%',
    paddingVertical: 4,
    paddingRight: 8,
    flexDirection: 'row',
  },
  infoLabel: { color: COLORS.anthraciteLighter, fontSize: 9, width: 96, flexShrink: 0 },
  infoValue: { color: COLORS.anthracite, fontSize: 10, fontFamily: 'Helvetica-Bold', flex: 1 },
  scoreRow: {
    marginBottom: 12,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  scoreLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite },
  scoreValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite },
  scoreUnit: { fontSize: 9, color: COLORS.anthraciteLighter },
  compositeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.tealLight,
    borderRadius: 6,
    padding: 14,
    marginTop: 8,
  },
  compositeText: { flex: 1, paddingRight: 12 },
  compositeLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.tealDark },
  compositeValue: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: COLORS.tealDark },
  // Parameters table
  groupTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.tealDark,
    backgroundColor: COLORS.tealLight,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 12,
    marginBottom: 2,
  },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottom: `0.5pt solid ${COLORS.border}`,
    paddingVertical: 5,
  },
  paramName: { flex: 2.4, fontSize: 9, color: COLORS.anthracite, paddingRight: 6 },
  paramValue: { flex: 1.2, fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite, textAlign: 'right' },
  paramUnit: { flex: 0.8, fontSize: 8, color: COLORS.anthraciteLighter, textAlign: 'left', paddingLeft: 4 },
  paramRange: { flex: 1.6, fontSize: 8, color: COLORS.anthraciteLighter, textAlign: 'right' },
  paramStatus: { width: 12, height: 12, borderRadius: 6, marginLeft: 6 },
  // Disclaimer page
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
// Formattazione valori — stesse regole dell'app, numeri nella lingua richiesta
// ---------------------------------------------------------------------------
function fmtScore(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return EMPTY
  return Math.round(v).toString()
}

// toNum: i valori dal database non sono garantiti number a runtime (colonne
// text/numeric e campi jsonb) e un .toFixed() diretto farebbe fallire l'intera
// generazione del PDF con un TypeError.
function fmtPower(value: unknown, locale: Locale): string {
  const v = toNum(value)
  if (v == null) return EMPTY
  if (v >= 10000) return `${num(v / 1000, 1, locale)}k`
  if (v >= 1000) return num(v, 0, locale)
  return num(v, 1, locale)
}

// Data e ora per esteso nella lingua richiesta, nel fuso italiano (le
// misurazioni vengono normalizzate da `measuredInstant`, vedi format.ts).
function fmtDateTimeLong(d: Date | null, locale: Locale): string {
  if (!d || Number.isNaN(d.getTime())) return EMPTY
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

function fmtRangeBound(v: number, locale: Locale): string {
  return new Intl.NumberFormat(intlTag(locale), { maximumFractionDigits: 2 }).format(v)
}

function scoreBarColor(value: number, inverted = false): string {
  const v = inverted ? 100 - value : value
  if (v >= 70) return COLORS.emerald
  if (v >= 50) return COLORS.teal
  if (v >= 30) return COLORS.amber
  return COLORS.red
}

// Semaforo basato su intervalli di riferimento (verde dentro, giallo al limite, rosso fuori).
// Se range non disponibile → grigio.
function statusColor(v: number | null | undefined, range?: [number, number] | null): string {
  if (v == null || !range) return COLORS.border
  const [lo, hi] = range
  if (v >= lo && v <= hi) return COLORS.emerald
  const span = hi - lo
  const tolerance = span * 0.2
  if (v >= lo - tolerance && v <= hi + tolerance) return COLORS.amber
  return COLORS.red
}

// Range di riferimento indicativi (adulto sano, 5-10 min, supino/seduto).
// Fonti: Task Force ESC/NASPE 1996 e range HRV di uso comune.
const NORMATIVE_RANGES: Record<string, [number, number]> = {
  rmssd: [20, 80],
  sdnn: [30, 100],
  mean_hr: [55, 85],
  pnn50: [3, 40],
  pnn20: [15, 70],
  cv: [3, 10],
  lf_hf_ratio: [0.5, 2.5],
  dfa_alpha1: [0.85, 1.25],
  dfa_alpha2: [0.6, 1.0],
  sd1: [15, 60],
  sd2: [40, 130],
  sd1_sd2_ratio: [0.2, 0.6],
  sample_entropy: [1.0, 2.5],
  approximate_entropy: [0.8, 2.2],
  triangular_index: [15, 50],
  tinn: [100, 350],
  stress_index_baevsky: [30, 150],
}

type FieldDef = {
  key: keyof MeasurementWithSession
  // Chiave in `pdf.measurement.params` (la sigla resta invariata nelle tre lingue).
  labelKey: string
  unit?: string
  format: 'num1' | 'num2' | 'int' | 'power' | 'pct'
  rangeKey?: string
}

// Chiave in `pdf.measurement.groups` + campi.
const GROUPS: Array<{ titleKey: string; fields: FieldDef[] }> = [
  {
    titleKey: 'timeDomain',
    fields: [
      { key: 'mean_rr', labelKey: 'meanRr', unit: 'ms', format: 'num1' },
      { key: 'sdnn', labelKey: 'sdnn', unit: 'ms', format: 'num1', rangeKey: 'sdnn' },
      { key: 'rmssd', labelKey: 'rmssd', unit: 'ms', format: 'num1', rangeKey: 'rmssd' },
      { key: 'mean_hr', labelKey: 'meanHr', unit: 'bpm', format: 'num1', rangeKey: 'mean_hr' },
      { key: 'pnn50', labelKey: 'pnn50', unit: '%', format: 'pct', rangeKey: 'pnn50' },
      { key: 'pnn20', labelKey: 'pnn20', unit: '%', format: 'pct', rangeKey: 'pnn20' },
      { key: 'cv', labelKey: 'cv', unit: '%', format: 'pct', rangeKey: 'cv' },
      { key: 'rmssd_sdnn_ratio', labelKey: 'rmssdSdnn', format: 'num2' },
    ],
  },
  {
    titleKey: 'frequencyDomain',
    fields: [
      { key: 'lf_power', labelKey: 'lfPower', unit: 'ms²', format: 'power' },
      { key: 'hf_power', labelKey: 'hfPower', unit: 'ms²', format: 'power' },
      { key: 'vlf_power', labelKey: 'vlfPower', unit: 'ms²', format: 'power' },
      { key: 'total_power', labelKey: 'totalPower', unit: 'ms²', format: 'power' },
      { key: 'lf_hf_ratio', labelKey: 'lfHf', format: 'num2', rangeKey: 'lf_hf_ratio' },
      { key: 'lf_nu', labelKey: 'lfNorm', unit: 'n.u.', format: 'num1' },
      { key: 'hf_nu', labelKey: 'hfNorm', unit: 'n.u.', format: 'num1' },
    ],
  },
  {
    titleKey: 'nonLinear',
    fields: [
      { key: 'dfa_alpha1', labelKey: 'dfaAlpha1', format: 'num2', rangeKey: 'dfa_alpha1' },
      { key: 'dfa_alpha2', labelKey: 'dfaAlpha2', format: 'num2', rangeKey: 'dfa_alpha2' },
      { key: 'sd1', labelKey: 'sd1', unit: 'ms', format: 'num1', rangeKey: 'sd1' },
      { key: 'sd2', labelKey: 'sd2', unit: 'ms', format: 'num1', rangeKey: 'sd2' },
      { key: 'sd1_sd2_ratio', labelKey: 'sd1Sd2', format: 'num2', rangeKey: 'sd1_sd2_ratio' },
      { key: 'sample_entropy', labelKey: 'sampleEntropy', format: 'num2', rangeKey: 'sample_entropy' },
    ],
  },
  {
    titleKey: 'geometric',
    fields: [
      { key: 'stress_index_baevsky', labelKey: 'baevsky', format: 'num1', rangeKey: 'stress_index_baevsky' },
      { key: 'triangular_index', labelKey: 'triangularIndex', format: 'num2', rangeKey: 'triangular_index' },
      { key: 'tinn', labelKey: 'tinn', unit: 'ms', format: 'num1', rangeKey: 'tinn' },
    ],
  },
]

function formatValue(v: number | null | undefined, fmt: FieldDef['format'], locale: Locale): string {
  switch (fmt) {
    case 'num1': return num(v, 1, locale)
    case 'num2': return num(v, 2, locale)
    case 'int': return v == null ? EMPTY : Math.round(v).toString()
    case 'power': return fmtPower(v, locale)
    case 'pct': return num(v, 1, locale)
  }
}

// ---------------------------------------------------------------------------
// Componenti riusabili
// ---------------------------------------------------------------------------
function ScoreBar({
  label,
  value,
  color,
  outOf100,
  inverted = false,
}: {
  label: string
  value: number | null
  color: string
  outOf100: string
  inverted?: boolean
}) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value))
  const barColor = value == null ? COLORS.border : scoreBarColor(v, inverted)
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
          <Text style={styles.scoreLabel}>{label}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={styles.scoreValue}>{fmtScore(value)}</Text>
          <Text style={styles.scoreUnit}>{` ${outOf100}`}</Text>
        </View>
      </View>
      <Svg width="100%" height={8} viewBox="0 0 100 8">
        <Rect x="0" y="0" width="100" height="8" rx="4" ry="4" fill={COLORS.border} />
        {value != null && (
          <Rect x="0" y="0" width={v} height="8" rx="4" ry="4" fill={barColor} />
        )}
      </Svg>
    </View>
  )
}

function ParamRow({
  field,
  value,
  t,
  locale,
}: {
  field: FieldDef
  value: number | null | undefined
  t: Tr
  locale: Locale
}) {
  const range = field.rangeKey ? NORMATIVE_RANGES[field.rangeKey] : null
  const status = statusColor(value ?? null, range ?? null)
  const rangeLabel = range ? `${fmtRangeBound(range[0], locale)}–${fmtRangeBound(range[1], locale)}` : ''
  return (
    <View style={styles.paramRow}>
      <Text style={styles.paramName}>{tx(t(`measurement.params.${field.labelKey}`))}</Text>
      <Text style={styles.paramValue}>{formatValue(value ?? null, field.format, locale)}</Text>
      <Text style={styles.paramUnit}>{field.unit ?? ''}</Text>
      <Text style={styles.paramRange}>{rangeLabel}</Text>
      <View style={[styles.paramStatus, { backgroundColor: status }]} />
    </View>
  )
}

function Header({
  professional,
  measuredAtLabel,
  t,
}: {
  professional: ProfessionalProfile | null
  measuredAtLabel: string
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
        <Text style={styles.proSub}>{t('measurement.headerMeasuredOn', { date: measuredAtLabel })}</Text>
      </View>
    </View>
  )
}

function Footer({ generatedAt, t }: { generatedAt: string; t: Tr }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerLeft}>{t('common.generatedFooter', { date: generatedAt })}</Text>
      <Text
        render={({ pageNumber, totalPages }) => t('common.pageOf', { page: pageNumber, total: totalPages })}
      />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------
export function MeasurementPdfDocument({
  measurement,
  client,
  professional,
  t,
  tScores,
  locale,
}: {
  measurement: MeasurementWithSession
  client: Client
  professional: ProfessionalProfile | null
  /** Traduttore del namespace `pdf` (getTranslator(locale, 'pdf')). */
  t: Tr
  /** Traduttore del namespace `scores` (nomi degli score). */
  tScores: Tr
  locale: Locale
}) {
  const clientName = [client.nome, client.cognome].filter(Boolean).join(' ').trim() || t('common.clientFallback')
  const proName = professional ? [professional.titolo, professional.nome, professional.cognome].filter(Boolean).join(' ').trim() : ''
  const durationMin = measurement.duration_seconds
    ? t('measurement.durationMin', { minutes: Math.round(measurement.duration_seconds / 60) })
    : EMPTY
  const testType = t(`measurement.testTypes.${normalizeTestType(measurement.test_type)}`)
  const measuredAtLabel = fmtDateTimeLong(measuredInstant(measurement), locale)
  const generatedAt = fmtDateTimeLong(new Date(), locale)
  const outOf100 = t('common.outOf100')

  return (
    <Document
      title={t('measurement.docTitle', { client: clientName, date: measuredDayKey(measurement) ?? EMPTY })}
      author={proName || t('common.brand')}
      subject={t('measurement.subject')}
      creator="Stress Index"
      producer="Stress Index"
    >
      {/* ====================================================================
          PAGINA 1 — RIEPILOGO
      ==================================================================== */}
      <Page size="A4" style={styles.page}>
        <Header professional={professional} measuredAtLabel={measuredAtLabel} t={t} />

        <Text style={styles.h1}>{t('measurement.title')}</Text>
        <Text style={styles.muted}>
          {t('measurement.summary', { date: measuredAtLabel, duration: durationMin, type: testType })}
        </Text>

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
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t('measurement.testDuration')}</Text>
            <Text style={styles.infoValue}>{durationMin}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t('measurement.testType')}</Text>
            <Text style={styles.infoValue}>{testType}</Text>
          </View>
        </View>

        <Text style={styles.h2}>{t('measurement.proprietaryScores')}</Text>
        <ScoreBar
          label={tScores('names.stressLong')}
          value={measurement.score_stress}
          color={SCORE_COLORS.stress}
          outOf100={outOf100}
          inverted
        />
        <ScoreBar label={tScores('names.recovery')} value={measurement.score_recupero} color={SCORE_COLORS.recovery} outOf100={outOf100} />
        <ScoreBar label={tScores('names.balance')} value={measurement.score_equilibrio} color={SCORE_COLORS.balance} outOf100={outOf100} />
        <ScoreBar label={tScores('names.energy')} value={measurement.score_energia} color={SCORE_COLORS.energy} outOf100={outOf100} />
        {/* Colonna DB: score_modulazione_infiammatoria. Etichetta mostrata:
            "Adattamento", identica all'app Flutter. */}
        <ScoreBar
          label={tScores('names.adaptation')}
          value={measurement.score_modulazione_infiammatoria}
          color={SCORE_COLORS.adaptation}
          outOf100={outOf100}
        />

        <View style={styles.compositeBox}>
          <View style={styles.compositeText}>
            <Text style={styles.compositeLabel}>{t('measurement.composite')}</Text>
            <Text style={styles.muted}>{t('measurement.compositeSub')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={styles.compositeValue}>{fmtScore(measurement.score_composito)}</Text>
            <Text style={[styles.muted, { marginLeft: 4 }]}>{outOf100}</Text>
          </View>
        </View>

        <Footer generatedAt={generatedAt} t={t} />
      </Page>

      {/* ====================================================================
          PAGINA 2 — PARAMETRI DETTAGLIATI
      ==================================================================== */}
      <Page size="A4" style={styles.page}>
        <Header professional={professional} measuredAtLabel={measuredAtLabel} t={t} />

        <Text style={styles.h1}>{t('measurement.paramsTitle')}</Text>
        <Text style={styles.muted}>
          {t('measurement.paramsIntro', { count: measurement.rr_count ?? EMPTY })}
        </Text>

        {GROUPS.map((group) => (
          <View key={group.titleKey} wrap={false}>
            <Text style={styles.groupTitle}>{t(`measurement.groups.${group.titleKey}`)}</Text>
            <View style={styles.paramRow}>
              <Text style={[styles.paramName, { fontFamily: 'Helvetica-Bold', color: COLORS.anthraciteLighter, fontSize: 8 }]}>
                {t('measurement.columns.parameter').toUpperCase()}
              </Text>
              <Text style={[styles.paramValue, { color: COLORS.anthraciteLighter, fontSize: 8 }]}>
                {t('measurement.columns.value').toUpperCase()}
              </Text>
              <Text style={[styles.paramUnit, { fontSize: 8 }]}>{t('measurement.columns.unit').toUpperCase()}</Text>
              <Text style={[styles.paramRange, { fontSize: 8 }]}>{t('measurement.columns.range').toUpperCase()}</Text>
              <View style={{ width: 18 }} />
            </View>
            {group.fields.map((field) => (
              <ParamRow
                key={String(field.key)}
                field={field}
                value={measurement[field.key] as number | null | undefined}
                t={t}
                locale={locale}
              />
            ))}
          </View>
        ))}

        <Footer generatedAt={generatedAt} t={t} />
      </Page>

      {/* ====================================================================
          PAGINA 3 — DISCLAIMER
      ==================================================================== */}
      <Page size="A4" style={styles.page}>
        <Header professional={professional} measuredAtLabel={measuredAtLabel} t={t} />

        <Text style={styles.h1}>{t('common.infoAndDisclaimer')}</Text>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>{t('common.disclaimerPart1')}</Text>
          <Text style={[styles.disclaimerText, { marginTop: 10 }]}>{t('common.disclaimerPart2')}</Text>
        </View>

        <Text style={styles.h2}>{t('measurement.notesTitle')}</Text>
        {measurement.indicazioni ? (
          <View style={styles.card}>
            <Text style={[styles.muted, { marginBottom: 4 }]}>{t('measurement.guidance')}</Text>
            <Text style={styles.small}>{tx(measurement.indicazioni)}</Text>
          </View>
        ) : null}
        {measurement.notes_professionista ? (
          <View style={styles.card}>
            <Text style={[styles.muted, { marginBottom: 4 }]}>{t('measurement.proNotes')}</Text>
            <Text style={styles.small}>{tx(measurement.notes_professionista)}</Text>
          </View>
        ) : null}
        {!measurement.indicazioni && !measurement.notes_professionista ? (
          <Text style={styles.muted}>{t('measurement.noNotes')}</Text>
        ) : null}

        <Text style={styles.h2}>{t('measurement.generationTitle')}</Text>
        <View style={styles.infoGrid}>
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
