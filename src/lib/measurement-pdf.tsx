// Documento PDF singola misurazione — solo server (renderToBuffer).
// Stile coerente con il brand Stress Index: teal #4FA39A, anthracite #2F343A.
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Svg, Rect } from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
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
  inflammation: '#A855F7',
} as const

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
    flexDirection: 'row',
  },
  infoLabel: { color: COLORS.anthraciteLighter, fontSize: 9, width: 90 },
  infoValue: { color: COLORS.anthracite, fontSize: 10, fontFamily: 'Helvetica-Bold' },
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
  paramName: { flex: 2.2, fontSize: 9, color: COLORS.anthracite },
  paramValue: { flex: 1.4, fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.anthracite, textAlign: 'right' },
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
})

// ---------------------------------------------------------------------------
// Formattazione valori — stesse regole dell'app
// ---------------------------------------------------------------------------
function fmtScore(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return '—'
  return Math.round(v).toString()
}

function fmtNum(v?: number | null, digits = 1): string {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toFixed(digits)
}

function fmtPower(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return '—'
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`
  if (v >= 1000) return Math.round(v).toString()
  return v.toFixed(1)
}

function fmtPercent(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toFixed(1)
}

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  try {
    return format(parseISO(d), "dd MMMM yyyy 'alle' HH:mm", { locale: it })
  } catch {
    return d
  }
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
  } catch {
    return '—'
  }
}

function fmtSex(s?: string | null): string {
  if (s === 'M') return 'Uomo'
  if (s === 'F') return 'Donna'
  if (s === 'X') return 'Altro'
  return '—'
}

function scoreBarColor(value: number, inverted = false): string {
  const v = inverted ? 100 - value : value
  if (v >= 70) return COLORS.emerald
  if (v >= 50) return COLORS.teal
  if (v >= 30) return COLORS.amber
  return COLORS.red
}

// Semaforo basato su intervalli normativi (verde dentro, giallo borderline, rosso fuori).
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

// Range normativi indicativi (adulto sano, 5-10 min, supino/seduto).
// Fonti: Task Force ESC/NASPE 1996, range comuni HRV clinici.
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
  label: string
  unit?: string
  format: 'num1' | 'num2' | 'int' | 'power' | 'pct'
  rangeKey?: string
}

const GROUPS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: 'Time Domain',
    fields: [
      { key: 'mean_rr', label: 'Mean RR', unit: 'ms', format: 'num1' },
      { key: 'sdnn', label: 'SDNN', unit: 'ms', format: 'num1', rangeKey: 'sdnn' },
      { key: 'rmssd', label: 'RMSSD', unit: 'ms', format: 'num1', rangeKey: 'rmssd' },
      { key: 'mean_hr', label: 'BPM medio', unit: 'bpm', format: 'num1', rangeKey: 'mean_hr' },
      { key: 'pnn50', label: 'pNN50', unit: '%', format: 'pct', rangeKey: 'pnn50' },
      { key: 'pnn20', label: 'pNN20', unit: '%', format: 'pct', rangeKey: 'pnn20' },
      { key: 'cv', label: 'HRV-CV', unit: '%', format: 'pct', rangeKey: 'cv' },
      { key: 'rmssd_sdnn_ratio', label: 'RMSSD/SDNN', format: 'num2' },
    ],
  },
  {
    title: 'Frequency Domain (Welch)',
    fields: [
      { key: 'lf_power', label: 'LF Power', unit: 'ms²', format: 'power' },
      { key: 'hf_power', label: 'HF Power', unit: 'ms²', format: 'power' },
      { key: 'vlf_power', label: 'VLF Power', unit: 'ms²', format: 'power' },
      { key: 'total_power', label: 'Total Power', unit: 'ms²', format: 'power' },
      { key: 'lf_hf_ratio', label: 'LF/HF', format: 'num2', rangeKey: 'lf_hf_ratio' },
      { key: 'lf_nu', label: 'LF norm', unit: 'n.u.', format: 'num1' },
      { key: 'hf_nu', label: 'HF norm', unit: 'n.u.', format: 'num1' },
    ],
  },
  {
    title: 'Non-linear',
    fields: [
      { key: 'dfa_alpha1', label: 'DFA α1', format: 'num2', rangeKey: 'dfa_alpha1' },
      { key: 'dfa_alpha2', label: 'DFA α2', format: 'num2', rangeKey: 'dfa_alpha2' },
      { key: 'sd1', label: 'SD1', unit: 'ms', format: 'num1', rangeKey: 'sd1' },
      { key: 'sd2', label: 'SD2', unit: 'ms', format: 'num1', rangeKey: 'sd2' },
      { key: 'sd1_sd2_ratio', label: 'SD1/SD2', format: 'num2', rangeKey: 'sd1_sd2_ratio' },
      { key: 'sample_entropy', label: 'Sample Entropy', format: 'num2', rangeKey: 'sample_entropy' },
    ],
  },
  {
    title: 'Geometric & Baevsky',
    fields: [
      { key: 'stress_index_baevsky', label: 'Stress Index Baevsky', format: 'num1', rangeKey: 'stress_index_baevsky' },
      { key: 'triangular_index', label: 'Triangular Index', format: 'num2', rangeKey: 'triangular_index' },
      { key: 'tinn', label: 'TINN', unit: 'ms', format: 'num1', rangeKey: 'tinn' },
    ],
  },
]

function formatValue(v: number | null | undefined, fmt: FieldDef['format']): string {
  switch (fmt) {
    case 'num1': return fmtNum(v, 1)
    case 'num2': return fmtNum(v, 2)
    case 'int': return v == null ? '—' : Math.round(v).toString()
    case 'power': return fmtPower(v)
    case 'pct': return fmtPercent(v)
  }
}

// ---------------------------------------------------------------------------
// Componenti riusabili
// ---------------------------------------------------------------------------
function ScoreBar({
  label,
  value,
  color,
  inverted = false,
}: {
  label: string
  value: number | null
  color: string
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
          <Text style={styles.scoreUnit}> / 100</Text>
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

function ParamRow({ field, value }: { field: FieldDef; value: number | null | undefined }) {
  const range = field.rangeKey ? NORMATIVE_RANGES[field.rangeKey] : null
  const status = statusColor(value ?? null, range ?? null)
  const rangeLabel = range ? `${range[0]}–${range[1]}` : ''
  return (
    <View style={styles.paramRow}>
      <Text style={styles.paramName}>{field.label}</Text>
      <Text style={styles.paramValue}>{formatValue(value ?? null, field.format)}</Text>
      <Text style={styles.paramUnit}>{field.unit ?? ''}</Text>
      <Text style={styles.paramRange}>{rangeLabel}</Text>
      <View style={[styles.paramStatus, { backgroundColor: status }]} />
    </View>
  )
}

function Header({ professional, measuredAt }: { professional: ProfessionalProfile | null; measuredAt: string }) {
  const proName = professional ? [professional.titolo, professional.nome, professional.cognome].filter(Boolean).join(' ').trim() : ''
  const studio = professional?.nome_studio ?? ''
  return (
    <View style={styles.header} fixed>
      <Text style={styles.logo}>Stress Index</Text>
      <View style={styles.headerRight}>
        {proName ? <Text style={styles.proName}>{proName || 'Professionista'}</Text> : null}
        {studio ? <Text style={styles.proSub}>{studio}</Text> : null}
        <Text style={styles.proSub}>Misurazione del {fmtDate(measuredAt)}</Text>
      </View>
    </View>
  )
}

function Footer({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Generato il {generatedAt} · Stress Index</Text>
      <Text
        render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`}
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
}: {
  measurement: MeasurementWithSession
  client: Client
  professional: ProfessionalProfile | null
}) {
  const clientName = [client.nome, client.cognome].filter(Boolean).join(' ').trim() || 'Cliente'
  const proName = professional ? [professional.titolo, professional.nome, professional.cognome].filter(Boolean).join(' ').trim() : ''
  const durationMin = measurement.duration_seconds ? `${Math.round(measurement.duration_seconds / 60)} min` : '—'
  const testType = measurement.test_type ?? 'Standard'
  const generatedAt = format(new Date(), "dd MMMM yyyy 'alle' HH:mm", { locale: it })

  return (
    <Document
      title={`Stress Index - ${clientName} - ${format(parseISO(measurement.measured_at), 'yyyy-MM-dd')}`}
      author={proName || 'Stress Index'}
      subject="Report misurazione HRV"
      creator="Stress Index"
      producer="Stress Index"
    >
      {/* ====================================================================
          PAGINA 1 — RIEPILOGO
      ==================================================================== */}
      <Page size="A4" style={styles.page}>
        <Header professional={professional} measuredAt={measurement.measured_at} />

        <Text style={styles.h1}>Report misurazione</Text>
        <Text style={styles.muted}>
          {fmtDate(measurement.measured_at)} · {durationMin} · Test {testType}
        </Text>

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
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Durata test</Text>
            <Text style={styles.infoValue}>{durationMin}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Tipo test</Text>
            <Text style={styles.infoValue}>{testType}</Text>
          </View>
        </View>

        <Text style={styles.h2}>Score proprietari</Text>
        <ScoreBar
          label="Indice di Stress"
          value={measurement.score_stress}
          color={SCORE_COLORS.stress}
          inverted
        />
        <ScoreBar label="Recupero" value={measurement.score_recupero} color={SCORE_COLORS.recovery} />
        <ScoreBar label="Equilibrio" value={measurement.score_equilibrio} color={SCORE_COLORS.balance} />
        <ScoreBar label="Energia" value={measurement.score_energia} color={SCORE_COLORS.energy} />
        <ScoreBar
          label="Modulazione Infiammatoria"
          value={measurement.score_modulazione_infiammatoria}
          color={SCORE_COLORS.inflammation}
        />

        <View style={styles.compositeBox}>
          <View>
            <Text style={styles.compositeLabel}>Stress Index Composito</Text>
            <Text style={styles.muted}>Sintesi dei 4 score proprietari</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={styles.compositeValue}>{fmtScore(measurement.score_composito)}</Text>
            <Text style={[styles.muted, { marginLeft: 4 }]}>/ 100</Text>
          </View>
        </View>

        <Footer generatedAt={generatedAt} />
      </Page>

      {/* ====================================================================
          PAGINA 2 — PARAMETRI DETTAGLIATI
      ==================================================================== */}
      <Page size="A4" style={styles.page}>
        <Header professional={professional} measuredAt={measurement.measured_at} />

        <Text style={styles.h1}>Parametri HRV dettagliati</Text>
        <Text style={styles.muted}>
          Valori calcolati su {measurement.rr_count ?? '—'} intervalli RR. La colonna a destra mostra il range normativo
          indicativo per adulto sano; il semaforo segnala se il valore è dentro range (verde), borderline (giallo) o fuori (rosso).
        </Text>

        {GROUPS.map((group) => (
          <View key={group.title} wrap={false}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.paramRow}>
              <Text style={[styles.paramName, { fontFamily: 'Helvetica-Bold', color: COLORS.anthraciteLighter, fontSize: 8 }]}>
                PARAMETRO
              </Text>
              <Text style={[styles.paramValue, { color: COLORS.anthraciteLighter, fontSize: 8 }]}>VALORE</Text>
              <Text style={[styles.paramUnit, { fontSize: 8 }]}>UNITÀ</Text>
              <Text style={[styles.paramRange, { fontSize: 8 }]}>RANGE</Text>
              <View style={{ width: 18 }} />
            </View>
            {group.fields.map((field) => (
              <ParamRow
                key={String(field.key)}
                field={field}
                value={measurement[field.key] as number | null | undefined}
              />
            ))}
          </View>
        ))}

        <Footer generatedAt={generatedAt} />
      </Page>

      {/* ====================================================================
          PAGINA 3 — DISCLAIMER
      ==================================================================== */}
      <Page size="A4" style={styles.page}>
        <Header professional={professional} measuredAt={measurement.measured_at} />

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

        <Text style={styles.h2}>Note sulla misurazione</Text>
        {measurement.indicazioni ? (
          <View style={styles.card}>
            <Text style={[styles.muted, { marginBottom: 4 }]}>Indicazioni</Text>
            <Text style={styles.small}>{measurement.indicazioni}</Text>
          </View>
        ) : null}
        {measurement.notes_professionista ? (
          <View style={styles.card}>
            <Text style={[styles.muted, { marginBottom: 4 }]}>Note professionista</Text>
            <Text style={styles.small}>{measurement.notes_professionista}</Text>
          </View>
        ) : null}
        {!measurement.indicazioni && !measurement.notes_professionista ? (
          <Text style={styles.muted}>Nessuna nota associata a questa misurazione.</Text>
        ) : null}

        <Text style={styles.h2}>Generazione report</Text>
        <View style={styles.infoGrid}>
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
