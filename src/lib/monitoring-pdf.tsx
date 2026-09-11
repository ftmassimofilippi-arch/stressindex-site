// Report Monitoraggio 24h — solo server (renderToBuffer).
// Stessa struttura di pagine e stesse stringhe di monitoring_pdf_service.dart
// (PdfStrings.monitoring + MonitoringIndexTexts): Riepilogo, Cosa dice la
// registrazione, Notte, Andamento + eventi, Mappa delle ore, Ritmo e
// complessità (pro), Parametri (pro), Come si calcola (pro). Le pagine
// escluse dal profilo non esistono. Il report cliente usa solo nomi semplici
// ed etichette: niente sigle, referenze, Ritmo, Parametri, Come si calcola.
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Svg, Rect, Line, Path, Circle, Text as SvgText } from '@react-pdf/renderer'
import type { Monitoring24hSession, MonitoringEvent, MonitoringNight, MonitoringWindow, ReserveCurve, HourPattern, SeriesHrv } from './monitoring-types'
import {
  LEVEL_LABEL, MON, STATE_COLOR, balanceColor, balanceLabel, clockStrength, dayNumeric, dayPart, duration, effectiveProfile, fragmentationLabel,
  hourFraction, hm, level, pagesFor, profileFlags, qualityColor, qualityLabel, rmssdFromLn, sourceLabel, wallDate, type IndexLevel,
} from './monitoring-format'
import { indexText, monT, scoreT, type IndexId, type Lang } from './monitoring-strings'
import { intensityColor } from '@/components/monitoring/MonitoringHourMap'
import { pdfText as tx } from './pdf-text'
import type { ProfessionalProfile } from './types'

const C = {
  accent: MON.accent,
  accentDark: MON.accentDark,
  accentLight: MON.accentLight,
  anthracite: '#2F343A',
  textMid: '#66707A',
  border: '#E2E6EA',
  bgGray: '#F6F7F8',
  invalid: STATE_COLOR.invalid,
  recovery: STATE_COLOR.recovery,
  stress: STATE_COLOR.stress,
  activity: STATE_COLOR.activity,
  neutral: STATE_COLOR.neutral,
  warning: MON.warning,
  info: MON.info,
  white: '#FFFFFF',
} as const

const PAGE_W = 595.28
const MARGIN_H = 51
const CONTENT_W = PAGE_W - MARGIN_H * 2

const st = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 46, paddingHorizontal: MARGIN_H, fontSize: 9, fontFamily: 'Helvetica', color: C.anthracite, lineHeight: 1.35 },
  header: { backgroundColor: C.accentDark, borderRadius: 8, padding: 14, flexDirection: 'row' },
  headerTitle: { fontSize: 9, color: C.white },
  headerName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.white },
  headerLine: { fontSize: 9, color: C.white, marginTop: 4 },
  chip: { fontSize: 7, color: C.white, borderWidth: 0.6, borderColor: C.white, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginRight: 5, marginTop: 5 },
  miniHeader: { backgroundColor: C.accentDark, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  miniTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.white, flex: 1 },
  miniSub: { fontSize: 8, color: C.white },
  section: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.accentDark, marginTop: 8, marginBottom: 5 },
  banner: { borderWidth: 0.8, borderRadius: 6, padding: 8, marginBottom: 8 },
  bannerText: { fontSize: 7.5, lineHeight: 1.5 },
  box: { backgroundColor: C.bgGray, borderWidth: 0.5, borderColor: C.border, borderRadius: 6, padding: 8 },
  phrase: { backgroundColor: C.accentLight, borderRadius: 6, padding: 10, fontSize: 9.5, lineHeight: 1.5 },
  row: { flexDirection: 'row' },
  col: { flex: 1 },
  kpiLabel: { fontSize: 7, color: C.textMid },
  kpiValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  cardName: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  cardValue: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  cardUnit: { fontSize: 7, color: C.textMid, marginLeft: 4 },
  cardLevel: { fontSize: 6.5, color: C.white, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1.5, marginLeft: 4 },
  cardDetail: { fontSize: 6.8, color: C.textMid, marginTop: 2, lineHeight: 1.3 },
  cardPhrase: { fontSize: 7.5, marginTop: 3, lineHeight: 1.4 },
  unavailable: { backgroundColor: C.invalid, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 7.5, color: C.textMid },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.accentDark, padding: 3, backgroundColor: C.accentLight },
  td: { fontSize: 7.5, padding: 3 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  legendSwatch: { width: 8, height: 8, marginRight: 3, borderWidth: 0.3, borderColor: C.border },
  legendText: { fontSize: 7, color: C.textMid },
  footer: { position: 'absolute', bottom: 22, left: MARGIN_H, right: MARGIN_H, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: C.textMid, borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6 },
  small: { fontSize: 7, color: C.textMid, lineHeight: 1.5 },
  howBlock: { backgroundColor: C.bgGray, borderWidth: 0.4, borderColor: C.border, borderRadius: 5, padding: 7, marginBottom: 5 },
})

// ── Helpers ─────────────────────────────────────────────────────────────────

type Ctx = {
  s: Monitoring24hSession
  tz: number
  lang: Lang
  client: boolean
  professional: ProfessionalProfile | null
  t: (k: string) => string
}

function lvlColor(l: IndexLevel): string {
  return l === 'good' ? C.recovery : l === 'average' ? C.warning : C.stress
}

function lvlText(l: IndexLevel, t: (k: string) => string): string {
  return t(`level_${l}`) ?? LEVEL_LABEL[l]
}

function Footer({ ctx, client }: { ctx: Ctx; client: boolean }) {
  return (
    <View style={st.footer} fixed>
      <Text>{tx(ctx.t('title'))} · {tx(ctx.s.client_name ?? '')} · {dayNumeric(ctx.s.start_time, ctx.tz)}</Text>
      <Text render={({ pageNumber, totalPages }) => `${client ? 'Stress Index · ' : ''}${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function ProfSection({ p }: { p: ProfessionalProfile | null }) {
  if (!p) return null
  const rows = [
    [p.titolo, p.nome, p.cognome].filter(Boolean).join(' '),
    [p.professione, p.specializzazione].filter(Boolean).join(' · '),
    p.nome_studio,
    p.indirizzo,
    [p.telefono, p.sito_web].filter(Boolean).join(' · '),
  ].filter((r) => r && r.trim())
  if (rows.length === 0) return null
  return (
    <View style={[st.box, { marginBottom: 8 }]}>
      {rows.map((r, i) => <Text key={i} style={{ fontSize: i === 0 ? 9 : 7.5, fontFamily: i === 0 ? 'Helvetica-Bold' : 'Helvetica', color: i === 0 ? C.anthracite : C.textMid }}>{tx(r as string)}</Text>)}
    </View>
  )
}

function Header({ ctx }: { ctx: Ctx }) {
  const { s, tz, t } = ctx
  const { profile } = effectiveProfile(s)
  return (
    <View style={st.header}>
      <View style={{ width: 56, marginRight: 12 }}>
        <View style={{ width: 38, height: 38, backgroundColor: C.white, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.accentDark }}>SI</Text>
        </View>
        <Text style={{ fontSize: 7.5, color: C.white, marginTop: 4 }}>{tx(t('module'))}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.headerTitle}>{tx(t('title'))}</Text>
        <Text style={st.headerName}>{tx(s.client_name ?? '')}</Text>
        <Text style={st.headerLine}>
          {tx(t('period'))}: {dayNumeric(s.start_time, tz)} {hm(s.start_time, tz)} – {dayNumeric(s.end_time, tz)} {hm(s.end_time, tz)}  ·  {tx(t('duration'))}: {duration(s.duration_minutes)}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Text style={st.chip}>{tx(t('profile'))}: {tx(t(`profile_${profile}`))}</Text>
          <Text style={st.chip}>{tx(t('device'))}: {tx(s.device_name ?? sourceLabel(s.source))}</Text>
          <Text style={st.chip}>{tx(t('signal'))}: {tx(t(`signal_${s.signal_quality ?? 'fair'}`))}</Text>
          <Text style={st.chip}>{tx(t('valid_data'))}: {s.valid_coverage_percentage == null ? '—' : Math.round(s.valid_coverage_percentage)} %</Text>
          <Text style={st.chip}>{tx(t('artifacts_pct'))}: {s.artifact_percentage?.toFixed(1) ?? '—'} %</Text>
          <Text style={st.chip}>{s.rr_count ?? 0} {tx(t('beats'))}</Text>
        </View>
      </View>
    </View>
  )
}

function MiniHeader({ ctx, title }: { ctx: Ctx; title: string }) {
  const { profile } = effectiveProfile(ctx.s)
  return (
    <View style={st.miniHeader} fixed>
      <Text style={st.miniTitle}>{tx(title)}</Text>
      <Text style={st.miniSub}>{tx(ctx.s.client_name ?? '')} · {dayNumeric(ctx.s.start_time, ctx.tz)} · {tx(ctx.t(`profile_${profile}`))}</Text>
    </View>
  )
}

function Legend({ t }: { t: (k: string) => string }) {
  const items: Array<[string, string]> = [[C.recovery, t('legend_recovery')], [C.stress, t('legend_stress')], [C.activity, t('legend_activity')], [C.neutral, t('legend_neutral')], [C.invalid, t('legend_invalid')]]
  return (
    <View style={{ flexDirection: 'row', marginTop: 3 }}>
      {items.map(([c, l]) => (
        <View key={l} style={st.legendItem}><View style={[st.legendSwatch, { backgroundColor: c }]} /><Text style={st.legendText}>{tx(l)}</Text></View>
      ))}
    </View>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[st.box, { flex: 1, marginRight: 6 }]}>
      <Text style={st.kpiLabel}>{tx(label)}</Text>
      <Text style={[st.kpiValue, { color }]}>{tx(value)}</Text>
    </View>
  )
}

type CardProps = { name: string; value: string; unit?: string | null; levelLabel?: string | null; levelColor?: string; phrase: string; detail?: string | null; children?: React.ReactNode }
function IndexCard({ name, value, unit, levelLabel, levelColor = C.accentDark, phrase, detail, children }: CardProps) {
  return (
    <View style={st.box}>
      <Text style={st.cardName}>{tx(name)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 2 }}>
        <Text style={[st.cardValue, { color: levelColor }]}>{tx(value)}</Text>
        {unit ? <Text style={st.cardUnit}>{tx(unit)}</Text> : null}
        {levelLabel ? <Text style={[st.cardLevel, { backgroundColor: levelColor }]}>{tx(levelLabel)}</Text> : null}
      </View>
      {detail ? <Text style={st.cardDetail}>{tx(detail)}</Text> : null}
      <Text style={st.cardPhrase}>{tx(phrase)}</Text>
      {children}
    </View>
  )
}

function Unavailable({ name, reason }: { name: string; reason: string }) {
  return (
    <View style={st.unavailable}>
      <Text><Text style={{ fontFamily: 'Helvetica-Bold' }}>{tx(name)}: </Text>{tx(reason)}</Text>
    </View>
  )
}

function TwoCol({ a, b }: { a: React.ReactNode; b: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 6 }}>
      <View style={{ flex: 1, marginRight: 4 }}>{a}</View>
      <View style={{ flex: 1, marginLeft: 4 }}>{b}</View>
    </View>
  )
}

// ── SVG: timeline + riserva, gauge, notte, andamento, mappa ore, cosinor ─────

function TimelineSvg({ s, reserve, night, events }: { s: Monitoring24hSession; reserve: ReserveCurve | null | undefined; night: MonitoringNight | null; events: MonitoringEvent[] }) {
  const W = CONTENT_W
  const startMs = new Date(s.start_time).getTime()
  const totalMs = Math.max(1, new Date(s.end_time).getTime() - startMs)
  const x = (iso: string) => Math.min(W, Math.max(0, ((new Date(iso).getTime() - startMs) / totalMs) * W))
  const resH = reserve && reserve.pts.length > 1 ? 40 : 0
  const barY = 14 + resH + 2
  const barH = 34
  const H = barY + barH + 16
  const runs: Array<{ x0: number; x1: number; state: MonitoringWindow['state'] }> = []
  for (const w of s.windows) {
    const x0 = x(w.s), x1 = Math.max(x0 + 0.6, x(new Date(new Date(w.s).getTime() + 60_000).toISOString()))
    const last = runs[runs.length - 1]
    if (last && last.state === w.state && Math.abs(last.x1 - x0) < 0.5) last.x1 = x1
    else runs.push({ x0, x1, state: w.state })
  }
  // asse orario
  const ticks: Array<{ x: number; label: string }> = []
  const hours = totalMs / 3_600_000
  const step = hours > 18 ? 4 : hours > 8 ? 2 : 1
  const sw = wallDate(s.start_time, s.tz_offset_minutes)
  if (sw) {
    let tt = Date.UTC(sw.getUTCFullYear(), sw.getUTCMonth(), sw.getUTCDate(), sw.getUTCHours()) + 3_600_000
    while (new Date(tt).getUTCHours() % step !== 0) tt += 3_600_000
    const endWall = new Date(s.end_time).getTime() + s.tz_offset_minutes * 60_000
    while (tt <= endWall) {
      ticks.push({ x: ((tt - s.tz_offset_minutes * 60_000 - startMs) / totalMs) * W, label: String(new Date(tt).getUTCHours()).padStart(2, '0') })
      tt += step * 3_600_000
    }
  }
  let reservePath: { line: string; up: string; down: string; zero: number } | null = null
  if (reserve && reserve.pts.length > 1) {
    const pts = reserve.pts.filter((p): p is [string, number] => p[1] != null)
    let vMin = Math.min(0, reserve.min ?? 0), vMax = Math.max(0, reserve.max ?? 0)
    if (vMax - vMin < 1e-6) { vMax += 1; vMin -= 1 }
    const pad = (vMax - vMin) * 0.1; vMin -= pad; vMax += pad
    const y = (v: number) => 14 + resH - ((v - vMin) / (vMax - vMin)) * resH
    const zero = y(0)
    reservePath = {
      zero,
      line: pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' '),
      up: `M${x(pts[0][0]).toFixed(1)} ${zero} ` + pts.map((p) => `L${x(p[0]).toFixed(1)} ${Math.min(y(p[1]), zero).toFixed(1)}`).join(' ') + ` L${x(pts[pts.length - 1][0]).toFixed(1)} ${zero} Z`,
      down: `M${x(pts[0][0]).toFixed(1)} ${zero} ` + pts.map((p) => `L${x(p[0]).toFixed(1)} ${Math.max(y(p[1]), zero).toFixed(1)}`).join(' ') + ` L${x(pts[pts.length - 1][0]).toFixed(1)} ${zero} Z`,
    }
  }
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {events.map((e, i) => {
        const t = new Date(e.timestamp).getTime()
        if (t < startMs || t > startMs + totalMs) return null
        return <Circle key={i} cx={x(e.timestamp)} cy={6} r={4} fill={C.accent} />
      })}
      {reservePath && (
        <>
          <Line x1={0} x2={W} y1={reservePath.zero} y2={reservePath.zero} stroke={C.border} strokeWidth={0.8} />
          <Path d={reservePath.up} fill={C.recovery} fillOpacity={0.22} />
          <Path d={reservePath.down} fill={C.stress} fillOpacity={0.22} />
          <Path d={reservePath.line} fill="none" stroke={C.accentDark} strokeWidth={1.2} />
        </>
      )}
      <Rect x={0} y={barY} width={W} height={barH} fill={C.invalid} />
      {runs.map((r, i) => r.state === 'invalid' ? null : <Rect key={i} x={r.x0} y={barY} width={Math.max(0.6, r.x1 - r.x0)} height={barH} fill={STATE_COLOR[r.state]} />)}
      {night && (
        <>
          <Line x1={x(night.night_start)} x2={x(night.night_end)} y1={barY + 1} y2={barY + 1} stroke={C.accentDark} strokeWidth={2.5} />
          <Line x1={x(night.night_start)} x2={x(night.night_end)} y1={barY + barH - 1} y2={barY + barH - 1} stroke={C.accentDark} strokeWidth={2.5} />
        </>
      )}
      {ticks.map((tk, i) => (
        <React.Fragment key={i}>
          <Line x1={tk.x} x2={tk.x} y1={barY + barH} y2={barY + barH + 3} stroke={C.border} strokeWidth={0.8} />
          <SvgText x={tk.x} y={barY + barH + 12} style={{ fontSize: 7, fill: C.textMid }} textAnchor="middle">{tk.label}</SvgText>
        </React.Fragment>
      ))}
    </Svg>
  )
}

function GaugeSvg({ value, colorFor }: { value: number | null; colorFor: (v: number) => string }) {
  const W = 120, H = 62, cx = 60, cy = 58, r = 46, stroke = 9
  const arc = (from: number, to: number) => {
    const a0 = Math.PI + from * Math.PI, a1 = Math.PI + to * Math.PI
    return `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${to - from > 0.5 ? 1 : 0} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`
  }
  const v = value == null ? null : Math.max(0, Math.min(100, value))
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {Array.from({ length: 20 }, (_, i) => <Path key={i} d={arc(i / 20, (i + 1) / 20 + 0.002)} stroke={colorFor(((i + 0.5) / 20) * 100)} strokeOpacity={0.28} strokeWidth={stroke} fill="none" />)}
      {v != null && v > 0 && <Path d={arc(0, v / 100)} stroke={colorFor(v)} strokeWidth={stroke} strokeLinecap="round" fill="none" />}
      <SvgText x={cx} y={cy - 2} style={{ fontSize: 18, fontWeight: 700, fill: v == null ? C.textMid : colorFor(v) }} textAnchor="middle">{v == null ? '—' : String(Math.round(v))}</SvgText>
    </Svg>
  )
}

function GaugeBox({ title, value, label, colorFor }: { title: string; value: number | null; label: string; colorFor: (v: number) => string }) {
  const color = value == null ? C.textMid : colorFor(value)
  return (
    <View style={[st.box, { flex: 1, alignItems: 'center' }]}>
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.textMid }}>{tx(title)}</Text>
      <GaugeSvg value={value} colorFor={colorFor} />
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color, marginTop: 4 }}>{tx(label)}</Text>
    </View>
  )
}

function NightSvg({ night, tz }: { night: MonitoringNight; tz: number }) {
  const hours = night.hourly
  const W = CONTENT_W, H = 130
  const left = 30, right = 30, top = 8, bottom = 16
  const plotW = W - left - right, plotH = H - top - bottom
  const n = Math.max(1, hours.length), colW = plotW / n
  const rmssdMax = Math.max(20, Math.max(...hours.map((h) => h.rmssd ?? 0)) * 1.15)
  const hrVals = hours.map((h) => h.mean_hr).filter((v): v is number => v != null)
  const hrMin = hrVals.length ? Math.floor(Math.min(...hrVals) - 5) : 40
  const hrMax = hrVals.length ? Math.ceil(Math.max(...hrVals) + 5) : 80
  const yHr = (v: number) => top + plotH - ((v - hrMin) / Math.max(1, hrMax - hrMin)) * plotH
  let path = ''
  hours.forEach((h, i) => { if (h.mean_hr != null) path += `${path ? 'L' : 'M'}${(left + i * colW + colW / 2).toFixed(1)} ${yHr(h.mean_hr).toFixed(1)} ` })
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {hours.map((h, i) => <Rect key={`b${i}`} x={left + i * colW} y={top} width={colW} height={plotH} fill={STATE_COLOR[h.state]} fillOpacity={0.18} />)}
      {hours.map((h, i) => h.rmssd == null ? null : <Rect key={`r${i}`} x={left + i * colW + colW * 0.2} y={top + plotH - (h.rmssd / rmssdMax) * plotH} width={colW * 0.6} height={(h.rmssd / rmssdMax) * plotH} fill={C.accent} />)}
      {path && <Path d={path} fill="none" stroke={C.stress} strokeWidth={1.4} />}
      <SvgText x={0} y={top + 7} style={{ fontSize: 6.5, fill: C.accent }}>RMSSD</SvgText>
      <SvgText x={0} y={top + 16} style={{ fontSize: 6.5, fill: C.textMid }}>{String(Math.round(rmssdMax))}</SvgText>
      <SvgText x={W - right + 3} y={top + 7} style={{ fontSize: 6.5, fill: C.stress }}>HR</SvgText>
      <SvgText x={W - right + 3} y={top + 16} style={{ fontSize: 6.5, fill: C.textMid }}>{String(hrMax)}</SvgText>
      <SvgText x={W - right + 3} y={top + plotH} style={{ fontSize: 6.5, fill: C.textMid }}>{String(hrMin)}</SvgText>
      {hours.map((h, i) => (n > 8 && i % 2 === 1) ? null : <SvgText key={`t${i}`} x={left + i * colW + 2} y={top + plotH + 10} style={{ fontSize: 6.5, fill: C.textMid }}>{hm(h.hour_start, tz)}</SvgText>)}
    </Svg>
  )
}

function TrendSvg({ s, pick, digits, night }: { s: Monitoring24hSession; pick: (w: MonitoringWindow) => number | null; digits: number; night: MonitoringNight | null }) {
  const W = CONTENT_W, H = 120
  const left = 30, top = 6, bottom = 14
  const plotW = W - left, plotH = H - top - bottom
  const startMs = new Date(s.start_time).getTime()
  const totalMs = Math.max(1, new Date(s.end_time).getTime() - startMs)
  const x = (iso: string) => left + ((new Date(iso).getTime() - startMs) / totalMs) * plotW
  const vals = s.windows.filter((w) => w.valid).map(pick).filter((v): v is number => v != null)
  if (vals.length === 0) return null
  let vMin = Math.min(...vals), vMax = Math.max(...vals)
  if (vMax - vMin < 1e-6) { vMax += 1; vMin -= 1 }
  const pad = (vMax - vMin) * 0.08; vMin -= pad; vMax += pad
  const y = (v: number) => top + plotH - ((v - vMin) / (vMax - vMin)) * plotH
  // bande di stato (fuse)
  const bands: Array<{ x0: number; x1: number; state: MonitoringWindow['state'] }> = []
  for (const w of s.windows) {
    if (w.state === 'invalid' || w.state === 'neutral') continue
    const x0 = x(w.s), x1 = x(new Date(new Date(w.s).getTime() + 60_000).toISOString())
    const last = bands[bands.length - 1]
    if (last && last.state === w.state && Math.abs(last.x1 - x0) < 0.5) last.x1 = x1
    else bands.push({ x0, x1, state: w.state })
  }
  const segs: string[] = []
  let cur = ''
  for (const w of s.windows) {
    const v = w.valid ? pick(w) : null
    if (v == null) { if (cur) segs.push(cur); cur = ''; continue }
    cur += `${cur ? 'L' : 'M'}${x(w.s).toFixed(1)} ${y(v).toFixed(1)} `
  }
  if (cur) segs.push(cur)
  const ticks: number[] = [0, 0.25, 0.5, 0.75, 1]
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {bands.map((b, i) => <Rect key={i} x={b.x0} y={top} width={Math.max(0.5, b.x1 - b.x0)} height={plotH} fill={STATE_COLOR[b.state]} fillOpacity={0.16} />)}
      {night && <Rect x={x(night.night_start)} y={top} width={Math.max(0, x(night.night_end) - x(night.night_start))} height={plotH} fill={C.accentDark} fillOpacity={0.08} />}
      {ticks.map((f, i) => {
        const v = vMin + (vMax - vMin) * f
        return (
          <React.Fragment key={i}>
            <Line x1={left} x2={W} y1={y(v)} y2={y(v)} stroke={C.border} strokeWidth={0.5} />
            <SvgText x={0} y={y(v) + 2.5} style={{ fontSize: 6.5, fill: C.textMid }}>{v.toFixed(digits)}</SvgText>
          </React.Fragment>
        )
      })}
      {segs.map((d, i) => <Path key={i} d={d} fill="none" stroke={C.accentDark} strokeWidth={1} />)}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <SvgText key={`x${i}`} x={left + f * plotW} y={H - 3} style={{ fontSize: 6.5, fill: C.textMid }} textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}>
          {hm(new Date(startMs + f * totalMs).toISOString(), s.tz_offset_minutes)}
        </SvgText>
      ))}
    </Svg>
  )
}

function HourMapSvg({ hours, tz }: { hours: HourPattern[]; tz: number }) {
  const W = CONTENT_W, H = 110
  const left = 44, top = 4, bottom = 14
  const plotW = W - left, plotH = H - top - bottom
  const rows: Array<{ label: string; pick: (h: HourPattern) => number | null; warm: boolean }> = [
    { label: 'HR', pick: (h) => h.hr, warm: true },
    { label: 'ln RMSSD', pick: (h) => h.ln, warm: false },
    { label: 'LF/HF', pick: (h) => h.lfhf, warm: true },
    { label: 'Stato', pick: () => null, warm: true },
  ]
  const rowH = plotH / rows.length, colW = plotW / Math.max(1, hours.length)
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {rows.map((r, ri) => {
        const vals = hours.map(r.pick).filter((v): v is number => v != null)
        const mn = vals.length ? Math.min(...vals) : 0, mx = vals.length ? Math.max(...vals) : 0
        return (
          <React.Fragment key={r.label}>
            <SvgText x={0} y={top + ri * rowH + rowH / 2 + 2.5} style={{ fontSize: 6.5, fill: C.anthracite }}>{r.label}</SvgText>
            {hours.map((h, ci) => {
              let color: string
              if (ri === 3) color = h.n === 0 ? C.invalid : STATE_COLOR[h.state]
              else {
                const v = r.pick(h)
                color = v == null || !vals.length ? C.invalid : intensityColor(mx - mn < 1e-9 ? 0.5 : (v - mn) / (mx - mn), r.warm)
              }
              return <Rect key={ci} x={left + ci * colW + 0.5} y={top + ri * rowH + 0.5} width={colW - 1} height={rowH - 1} fill={color} />
            })}
          </React.Fragment>
        )
      })}
      {hours.map((h, ci) => (hours.length > 16 && ci % 2 === 1) ? null : (
        <SvgText key={`t${ci}`} x={left + ci * colW + colW / 2} y={H - 3} style={{ fontSize: 6.5, fill: C.textMid }} textAnchor="middle">{String((wallDate(h.h, tz)?.getUTCHours() ?? 0)).padStart(2, '0')}</SvgText>
      ))}
    </Svg>
  )
}

function CosinorSvg({ hours, fit, tz }: { hours: HourPattern[]; fit: NonNullable<NonNullable<Monitoring24hSession['summary']>['advanced']>['cosinor_hr'] & object; tz: number }) {
  const W = CONTENT_W, H = 120
  const left = 30, top = 6, bottom = 14
  const plotW = W - left, plotH = H - top - bottom
  const pts = hours.map((h) => { const d = wallDate(h.h, tz); return h.hr == null || !d ? null : { t: d.getUTCHours() + d.getUTCMinutes() / 60 + 0.5, v: h.hr } }).filter((p): p is { t: number; v: number } => p != null)
  if (pts.length === 0 || fit.mesor == null || fit.amp == null || fit.acro == null) return null
  let vMin = Math.min(...pts.map((p) => p.v), fit.mesor - fit.amp), vMax = Math.max(...pts.map((p) => p.v), fit.mesor + fit.amp)
  if (vMax - vMin < 1e-6) { vMax += 1; vMin -= 1 }
  const pad = (vMax - vMin) * 0.1; vMin -= pad; vMax += pad
  const x = (clock: number) => left + (clock / 24) * plotW
  const y = (v: number) => top + plotH - ((v - vMin) / (vMax - vMin)) * plotH
  const sine = Array.from({ length: 97 }, (_, i) => { const t = i / 4; return `${i === 0 ? 'M' : 'L'}${x(t).toFixed(1)} ${y(fit.mesor! + fit.amp! * Math.cos((2 * Math.PI * (t - fit.acro!)) / 24)).toFixed(1)}` }).join(' ')
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {[0, 6, 12, 18, 24].map((h) => <SvgText key={h} x={x(h)} y={H - 3} style={{ fontSize: 6.5, fill: C.textMid }} textAnchor="middle">{String(h).padStart(2, '0')}</SvgText>)}
      <Path d={sine} fill="none" stroke={C.accent} strokeWidth={1.4} />
      <Line x1={left} x2={W} y1={y(fit.mesor)} y2={y(fit.mesor)} stroke={C.accent} strokeOpacity={0.5} strokeWidth={0.8} />
      <Line x1={x(fit.acro % 24)} x2={x(fit.acro % 24)} y1={top} y2={top + plotH} stroke={C.stress} strokeWidth={0.9} />
      {fit.bathy != null && <Line x1={x(fit.bathy % 24)} x2={x(fit.bathy % 24)} y1={top} y2={top + plotH} stroke={C.recovery} strokeWidth={0.9} />}
      {pts.map((p, i) => <Circle key={i} cx={x(p.t)} cy={y(p.v)} r={2} fill={C.accentDark} />)}
      <SvgText x={0} y={top + 7} style={{ fontSize: 6.5, fill: C.textMid }}>{String(Math.round(vMax))}</SvgText>
      <SvgText x={0} y={top + plotH} style={{ fontSize: 6.5, fill: C.textMid }}>{String(Math.round(vMin))}</SvgText>
    </Svg>
  )
}

function ScoreBars({ scores, compact = false }: { scores: NonNullable<Monitoring24hSession['scores_night']>; compact?: boolean }) {
  const rows: Array<[string, number, boolean]> = [
    [scoreT('stress_score'), scores.stress, false],
    [scoreT('recovery_score'), scores.recovery, true],
    [scoreT('balance_score'), scores.balance, true],
    [scoreT('energy_score'), scores.energy, true],
    [scoreT('inflammatory_score'), scores.inflammation, true],
  ]
  const colorOf = (v: number, higher: boolean) => { const good = higher ? v : 100 - v; return good >= 65 ? C.recovery : good >= 45 ? C.warning : C.stress }
  return (
    <View>
      {rows.map(([label, v, higher]) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: compact ? 1 : 2 }}>
          <Text style={{ width: 90, fontSize: 8, color: C.textMid }}>{tx(label)}</Text>
          <View style={{ flex: 1, height: 7, backgroundColor: C.invalid, borderRadius: 3 }}>
            <View style={{ width: `${Math.max(0, Math.min(100, v))}%`, height: 7, backgroundColor: colorOf(v, higher), borderRadius: 3 }} />
          </View>
          <Text style={{ width: 28, textAlign: 'right', fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: colorOf(v, higher) }}>{Math.round(v)}</Text>
        </View>
      ))}
      <Text style={{ textAlign: 'right', fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.accentDark, marginTop: 2 }}>Composito {Math.round(scores.composite)}</Text>
    </View>
  )
}

// ── Pagine ──────────────────────────────────────────────────────────────────

function SummaryPage({ ctx }: { ctx: Ctx }) {
  const { s, tz, t, client } = ctx
  const sum = s.summary
  const a = sum?.advanced
  const { profile } = effectiveProfile(s)
  const f = profileFlags(profile)
  const cov = s.valid_coverage_percentage
  const night = s.night
  const rec = <Kpi label={t('kpi_recovery')} value={sum ? `${Math.round(sum.percent_recovery)} %` : '—'} color={C.recovery} />
  let kpis: React.ReactNode
  if (f.hasNightPages && !f.hasWakePages) {
    kpis = <>{rec}<Kpi label={`${t('kpi_hr_min')}${night?.min_hr_time ? ` · ${hm(night.min_hr_time, tz)}` : ''}`} value={night?.min_hr_night == null ? '—' : `${Math.round(night.min_hr_night)} bpm`} color={C.accentDark} /><Kpi label={t('kpi_hr_dip')} value={night?.hr_dip_percentage == null ? '—' : `−${Math.round(night.hr_dip_percentage)} %`} color={C.accent} /></>
  } else if (f.hasWakePages) {
    const p = a?.pauses, rt = a?.return_times
    kpis = <>{rec}<Kpi label={t('kpi_pauses')} value={p ? `${p.count} · ${p.total_min} min` : '—'} color={C.accentDark} /><Kpi label={t('kpi_return')} value={rt?.median == null ? '—' : `${Math.round(rt.median)} min`} color={C.accent} /></>
  } else {
    const rt = a?.return_times
    kpis = <>{rec}<Kpi label={t('kpi_peak')} value={sum?.peak_stress_time ? hm(sum.peak_stress_time, tz) : '—'} color={C.stress} /><Kpi label={t('kpi_return')} value={rt?.median == null ? '—' : `${Math.round(rt.median)} min`} color={C.accent} /></>
  }
  return (
    <Page size="A4" style={st.page}>
      <Header ctx={ctx} />
      <View style={{ height: 8 }} />
      <ProfSection p={ctx.professional} />
      {cov != null && cov < 80 && (
        <View style={[st.banner, { borderColor: cov < 60 ? C.warning : C.info }]}>
          <Text style={[st.bannerText, { color: cov < 60 ? C.warning : C.info }]}>
            {tx(t('coverage_banner').replace('{missing}', `${100 - Math.round(cov)}`).replace('{gap}', duration((sum?.gap_minutes ?? 0) + (sum?.clock_shortfall_minutes ?? 0))))}
          </Text>
        </View>
      )}
      <Text style={st.section}>{tx(t('timeline_reserve'))}</Text>
      <TimelineSvg s={s} reserve={a?.reserve} night={night} events={s.events} />
      {a?.reserve && <Text style={{ fontSize: 6.5, color: C.textMid, marginTop: 2 }}>{tx(t('reserve_hint'))}</Text>}
      <Legend t={t} />
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <GaugeBox title={t('balance')} value={sum?.stress_recovery_balance ?? null} label={sum ? (sum.stress_recovery_label || balanceLabel(sum.stress_recovery_balance)) : '—'} colorFor={balanceColor} />
        {f.hasNightPages && <><View style={{ width: 10 }} /><GaugeBox title={t('night_quality')} value={sum?.night_recovery_quality ?? null} label={sum?.night_recovery_quality == null ? t('night_na_short') : qualityLabel(sum.night_recovery_quality)} colorFor={qualityColor} /></>}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>{kpis}</View>
      {sum && (
        <>
          <Text style={st.section}>{tx(t('summary'))}</Text>
          <Text style={st.phrase}>{tx(sum.summary_phrase)}</Text>
          <View style={{ marginTop: 8 }}>
            {([[t('legend_recovery'), sum.percent_recovery, C.recovery], [t('legend_stress'), sum.percent_stress, C.stress], [t('legend_activity'), sum.percent_activity, C.activity], [t('legend_neutral'), sum.percent_neutral, C.neutral], [t('legend_invalid'), sum.percent_invalid, C.border]] as Array<[string, number, string]>).map(([label, pct, color]) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 1.5 }}>
                <Text style={{ width: 70, fontSize: 7.5, color: C.textMid }}>{tx(label)}</Text>
                <View style={{ flex: 1, height: 6, backgroundColor: C.invalid, borderRadius: 3 }}><View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: 6, backgroundColor: color, borderRadius: 3 }} /></View>
                <Text style={{ width: 30, textAlign: 'right', fontSize: 7.5, fontFamily: 'Helvetica-Bold' }}>{Math.round(pct)} %</Text>
              </View>
            ))}
          </View>
        </>
      )}
      <Footer ctx={ctx} client={client} />
    </Page>
  )
}

type CardSpec = { id: IndexId; value?: string | null; unit?: string | null; level?: IndexLevel | null; detail?: string | null; unavailable?: string | null; unreliable?: boolean }

function IndicesPage({ ctx }: { ctx: Ctx }) {
  const { s, tz, t, client } = ctx
  const pro = !client
  const a = s.summary?.advanced
  const sum = s.summary
  const { profile } = effectiveProfile(s)
  const f = profileFlags(profile)
  const specs: CardSpec[] = []
  if (a) {
    const r = a.reserve
    const delta = r ? (r.end ?? 0) - (r.start ?? 0) : 0
    specs.push({ id: 'reserve', unavailable: a.unavailable?.reserve, value: r ? (delta >= 0.5 ? t('reserve_up') : delta <= -0.5 ? t('reserve_down') : t('reserve_flat')) : null, level: r ? level.reserve(delta) : null, detail: r ? t('reserve_detail').replace('{min}', r.min_t ? hm(r.min_t, tz) : '—').replace('{max}', r.max_t ? hm(r.max_t, tz) : '—') : null })
    if (f.hasWakePages) {
      const p = a.pauses
      specs.push({ id: 'recovery_pauses', unavailable: a.unavailable?.recovery_pauses, unreliable: a.unreliable?.includes('recovery_pauses'), value: p ? `${p.count}` : null, unit: p ? (p.count === 1 ? t('pause_one').replace('{min}', `${p.total_min}`) : t('pauses_detail').replace('{n}', '').replace('{min}', `${p.total_min}`).trim()) : null, level: p ? level.pauses(p.count, p.total_min) : null, detail: p && p.items.length ? p.items.slice(0, 5).map((b) => `${hm(b.start, tz)} (${b.minutes} min)`).join(' · ') : null })
      const ls = a.longest_stretch
      specs.push({ id: 'longest_stretch', unavailable: a.unavailable?.longest_stretch, unreliable: a.unreliable?.includes('longest_stretch'), value: ls ? duration(ls.minutes) : null, level: ls ? level.stretch(ls.minutes) : null, detail: ls ? t('stretch_detail').replace('{from}', hm(ls.start, tz)).replace('{to}', hm(ls.end, tz)) : null })
    }
    const peak = sum?.peak_stress_time
    specs.push({ id: 'peak', unavailable: peak ? null : '—', value: peak ? hm(peak, tz) : null, detail: peak ? dayPart(peak, tz, s.night) : null })
    const rt = a.return_times
    specs.push({ id: 'return_time', unavailable: a.unavailable?.return_time, unreliable: a.unreliable?.includes('return_time'), value: rt?.median == null ? null : `${Math.round(rt.median)}`, unit: t('unit_min_median'), level: rt?.median == null ? null : level.returnTime(rt.median), detail: rt ? t('return_detail').replace('{worst}', `${rt.worst ?? '—'}`).replace('{n}', `${rt.items.length}`) : null })
    const pr = a.prsa
    specs.push({ id: 'dc', unavailable: a.unavailable?.dc, value: pr?.dc == null ? null : pr.dc.toFixed(1), unit: 'ms', level: pr?.dc == null ? null : level.dc(pr.dc), detail: pr && pro ? `${pr.n_dec} ${t('anchors')} · ${pr.beats} ${t('beats_used')}` : null })
    specs.push({ id: 'ac', unavailable: a.unavailable?.ac, value: pr?.ac == null ? null : pr.ac.toFixed(1), unit: 'ms', level: pr?.ac == null ? null : level.ac(pr.ac), detail: pr && pro ? `${pr.n_acc} ${t('anchors')}` : null })
    if (profile !== 'breve') {
      const fr = a.fragmentation
      const lab = fr?.pip == null ? null : fragmentationLabel(fr.pip)
      specs.push({ id: 'fragmentation', unavailable: a.unavailable?.fragmentation, unreliable: a.unreliable?.includes('fragmentation'), value: lab ? t(`frag_${lab}`) : null, level: lab ? level.fragmentation(lab) : null, detail: fr && pro ? `PIP ${fr.pip?.toFixed(1)}% · IALS ${fr.ials?.toFixed(2)} · PSS ${fr.pss?.toFixed(1)}% · PAS ${fr.pas?.toFixed(1)}%` : null })
      const resp = a.respiration
      const dayVal = resp?.day ?? resp?.all ?? null
      specs.push({ id: 'respiration', unavailable: a.unavailable?.respiration, value: dayVal == null ? null : `${Math.round(dayVal)}`, unit: resp?.day != null ? t('unit_bpm_day') : 'atti/min', detail: resp ? `${resp.night == null ? '' : `~${Math.round(resp.night)}/min ${t('resp_night')} · `}${t('resp_note')}` : null })
    }
  }
  const cards = specs.map((sp) => {
    const x = indexText(sp.id, ctx.lang)
    if (sp.unavailable || sp.value == null) return <Unavailable key={sp.id} name={x.name} reason={sp.unavailable ?? '—'} />
    const detail = [sp.detail, sp.unreliable ? t('unreliable') : null].filter(Boolean).join(' · ')
    return <IndexCard key={sp.id} name={x.name} value={sp.value} unit={sp.unit} levelLabel={sp.level ? lvlText(sp.level, t) : null} levelColor={sp.level ? lvlColor(sp.level) : C.accentDark} phrase={x.phrase} detail={detail || null} />
  })
  return (
    <Page size="A4" style={st.page}>
      <MiniHeader ctx={ctx} title={t('indices')} />
      {!a && <View style={st.box}><Text style={{ fontSize: 8 }}>—</Text></View>}
      {Array.from({ length: Math.ceil(cards.length / 2) }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 6 }} wrap={false}>
          <View style={{ flex: 1, marginRight: 4 }}>{cards[i * 2]}</View>
          <View style={{ flex: 1, marginLeft: 4 }}>{cards[i * 2 + 1] ?? null}</View>
        </View>
      ))}
      <Footer ctx={ctx} client={client} />
    </Page>
  )
}

function NightPage({ ctx }: { ctx: Ctx }) {
  const { s, tz, t, client, lang } = ctx
  const n = s.night
  const a = s.summary?.advanced
  const { profile } = effectiveProfile(s)
  const trendText = (tr: number | null) => tr == null ? t('trend_na') : tr > 3 ? t('trend_up') : tr < -3 ? t('trend_down') : t('trend_flat')
  return (
    <Page size="A4" style={st.page}>
      <MiniHeader ctx={ctx} title={t('night')} />
      {!n ? (
        <View style={st.box}><Text style={{ fontSize: 8 }}>{tx(`${t('night_na')}: ${a?.unavailable?.night_recovery ?? ''}`)}</Text></View>
      ) : (() => {
        const ttm = a?.time_to_min, u = a?.ultradian, resp = a?.respiration
        const q = s.summary?.night_recovery_quality ?? null
        const ix = (id: IndexId) => indexText(id, lang)
        return (
          <>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.accentDark }}>{hm(n.night_start, tz)} – {hm(n.night_end, tz)} · {duration(n.duration_minutes)} · {tx(n.detected ? t('night_detected') : t('night_from_events'))}</Text>
            <Text style={{ fontSize: 8.5, color: C.textMid, marginTop: 6 }}>{tx(t('night_chart'))}</Text>
            <NightSvg night={n} tz={tz} />
            <Legend t={t} />
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <Kpi label={`${t('kpi_hr_min')}${n.min_hr_time ? ` · ${hm(n.min_hr_time, tz)}` : ''}`} value={n.min_hr_night == null ? '—' : `${Math.round(n.min_hr_night)} bpm`} color={C.accentDark} />
              <Kpi label={t('hr_mean_night')} value={n.mean_hr_night == null ? '—' : `${Math.round(n.mean_hr_night)} bpm`} color={C.anthracite} />
              <Kpi label={t('kpi_recovery')} value={n.recovery_percentage_night == null ? '—' : `${Math.round(n.recovery_percentage_night)} %`} color={C.recovery} />
            </View>
            <View style={{ height: 8 }} />
            <TwoCol
              a={q == null ? <Unavailable name={ix('night_recovery').name} reason={a?.unavailable?.night_recovery ?? '—'} /> : <IndexCard name={ix('night_recovery').name} value={`${Math.round(q)}`} unit="/ 100" levelLabel={lvlText(level.nightQuality(q), t)} levelColor={lvlColor(level.nightQuality(q))} phrase={ix('night_recovery').phrase} detail={trendText(n.recovery_trend)} />}
              b={n.hr_dip_percentage == null ? <Unavailable name={ix('hr_dip').name} reason={a?.unavailable?.hr_dip ?? '—'} /> : <IndexCard name={ix('hr_dip').name} value={`−${Math.round(n.hr_dip_percentage)}`} unit="%" levelLabel={lvlText(level.hrDip(n.hr_dip_percentage), t)} levelColor={lvlColor(level.hrDip(n.hr_dip_percentage))} phrase={ix('hr_dip').phrase} />}
            />
            <TwoCol
              a={!ttm ? <Unavailable name={ix('time_to_min').name} reason={a?.unavailable?.time_to_min ?? '—'} /> : <IndexCard name={ix('time_to_min').name} value={duration(ttm.min)} phrase={ix('time_to_min').phrase} detail={t('time_to_min_detail').replace('{hr}', `${ttm.hr == null ? '—' : Math.round(ttm.hr)}`).replace('{at}', hm(ttm.at, tz))} />}
              b={!u ? <Unavailable name={ix('rest_waves').name} reason={a?.unavailable?.rest_waves ?? '—'} /> : <IndexCard name={ix('rest_waves').name} value={u.present ? t('waves_present') : t('waves_faint')} levelLabel={lvlText(level.waves(u.present), t)} levelColor={lvlColor(level.waves(u.present))} phrase={ix('rest_waves').phrase} detail={u.period == null ? null : t('waves_detail').replace('{p}', `${u.period}`).replace('{c}', u.cycles?.toFixed(1) ?? '—')} />}
            />
            {profile !== 'breve' && (
              <TwoCol
                a={resp?.night == null ? <Unavailable name={ix('respiration').name} reason={a?.unavailable?.respiration ?? '—'} /> : <IndexCard name={ix('respiration').name} value={`${Math.round(resp.night)}`} unit={t('unit_bpm_night')} phrase={ix('respiration').phrase} detail={`${resp.day == null ? '' : `~${Math.round(resp.day)}/min ${t('resp_day')} · `}${t('resp_note')}`} />}
                b={<View style={{ borderWidth: 0.8, borderColor: C.warning, borderRadius: 6, padding: 8 }}><Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.warning }}>{tx(t('awakenings'))}</Text><Text style={{ fontSize: 8, marginTop: 3, lineHeight: 1.5 }}>{n.awakenings_estimate ?? 0}{'\n'}{tx(t('awakenings_note'))}</Text></View>}
              />
            )}
            {s.scores_night && <><Text style={st.section}>{tx(t('night_scores'))}</Text><ScoreBars scores={s.scores_night} compact /></>}
            {s.scores_morning && <><Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.accentDark, marginTop: 6, marginBottom: 3 }}>{tx(t('morning_scores'))}</Text><ScoreBars scores={s.scores_morning} compact /></>}
          </>
        )
      })()}
      <Footer ctx={ctx} client={client} />
    </Page>
  )
}

function TrendPage({ ctx }: { ctx: Ctx }) {
  const { s, tz, t, client } = ctx
  const sorted = [...s.events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const resp = (label: string | null | undefined) => label === 'attivazione' ? t('resp_activation') : label === 'recupero' ? t('resp_recovery') : label === 'neutro' ? t('resp_neutral') : label === 'dati insufficienti' ? t('resp_insufficient') : '—'
  const cell = (hr: number | null, ln: number | null) => hr == null && ln == null ? '—' : `${hr == null ? '—' : Math.round(hr)} bpm / ${rmssdFromLn(ln) == null ? '—' : Math.round(rmssdFromLn(ln)!)} ms`
  const cols = [0.7, 1.6, 1.2, 1.2, 1.2, 1.0]
  return (
    <Page size="A4" style={st.page}>
      <MiniHeader ctx={ctx} title={t('trend24')} />
      <Text style={{ fontSize: 8.5, color: C.textMid }}>{tx(t('trend_hr'))}</Text>
      <TrendSvg s={s} pick={(w) => w.hr} digits={0} night={s.night} />
      <View style={{ height: 6 }} />
      <Text style={{ fontSize: 8.5, color: C.textMid }}>{tx(t('trend_rmssd'))}</Text>
      <TrendSvg s={s} pick={(w) => w.rmssd} digits={0} night={s.night} />
      <Legend t={t} />
      <Text style={st.section}>{tx(t('events'))}</Text>
      {sorted.length === 0 ? (
        <View style={st.box}><Text style={{ fontSize: 8 }}>{tx(t('no_events'))}</Text></View>
      ) : (
        <View style={{ borderWidth: 0.4, borderColor: C.border }}>
          <View style={{ flexDirection: 'row' }}>
            {[t('ev_time'), t('ev_event'), t('ev_before'), t('ev_after'), t('ev_late'), t('ev_response')].map((h, i) => <Text key={i} style={[st.th, { flex: cols[i] }]}>{tx(h)}</Text>)}
          </View>
          {sorted.map((e) => (
            <View key={e.id} style={{ flexDirection: 'row', borderTopWidth: 0.4, borderTopColor: C.border }}>
              <Text style={[st.td, { flex: cols[0] }]}>{hm(e.timestamp, tz)}</Text>
              <Text style={[st.td, { flex: cols[1] }]}>{tx(`${e.label}${e.note ? ` · ${e.note}` : ''}`)}</Text>
              <Text style={[st.td, { flex: cols[2] }]}>{e.response ? cell(e.response.hr_before, e.response.ln_rmssd_before) : '—'}</Text>
              <Text style={[st.td, { flex: cols[3] }]}>{e.response ? cell(e.response.hr_after, e.response.ln_rmssd_after) : '—'}</Text>
              <Text style={[st.td, { flex: cols[4] }]}>{e.response ? cell(e.response.hr_late, e.response.ln_rmssd_late) : '—'}</Text>
              <Text style={[st.td, { flex: cols[5], fontFamily: 'Helvetica-Bold' }]}>{e.type === 'sleep_start' || e.type === 'wake_up' ? '·' : tx(resp(e.response?.label))}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={{ fontSize: 6.5, color: C.textMid, marginTop: 4 }}>{tx(t('ev_note'))}</Text>
      <Footer ctx={ctx} client={client} />
    </Page>
  )
}

function HourMapPage({ ctx }: { ctx: Ctx }) {
  const { s, tz, t, client, lang } = ctx
  const hours = s.summary?.advanced?.hourly ?? []
  if (hours.length === 0) return null
  const x = indexText('hour_map', lang)
  const stateLabel = (h: HourPattern) => h.n === 0 ? '—' : t(`legend_${h.state}`)
  return (
    <Page size="A4" style={st.page}>
      <MiniHeader ctx={ctx} title={t('hour_map')} />
      <Text style={{ fontSize: 9.5 }}>{tx(x.phrase)}</Text>
      <View style={{ height: 8 }} />
      <HourMapSvg hours={hours} tz={tz} />
      <Text style={[st.small, { marginTop: 4 }]}>{tx(t('hour_map_note'))}</Text>
      {!client && (
        <View style={{ borderWidth: 0.4, borderColor: C.border, marginTop: 10 }}>
          <View style={{ flexDirection: 'row' }}>
            {[[t('ev_time'), 0.8], ['HR', 1], ['ln RMSSD', 1], ['LF/HF', 1], [t('ev_response'), 1], ['n', 0.6]].map(([h, fl], i) => <Text key={i} style={[st.th, { flex: fl as number }]}>{tx(h as string)}</Text>)}
          </View>
          {hours.map((h, i) => (
            <View key={i} style={{ flexDirection: 'row', borderTopWidth: 0.4, borderTopColor: C.border }}>
              <Text style={[st.td, { flex: 0.8 }]}>{hm(h.h, tz)}</Text>
              <Text style={[st.td, { flex: 1, textAlign: 'right' }]}>{h.hr == null ? '—' : Math.round(h.hr)}</Text>
              <Text style={[st.td, { flex: 1, textAlign: 'right' }]}>{h.ln?.toFixed(2) ?? '—'}</Text>
              <Text style={[st.td, { flex: 1, textAlign: 'right' }]}>{h.lfhf?.toFixed(2) ?? '—'}</Text>
              <Text style={[st.td, { flex: 1 }]}>{tx(stateLabel(h))}</Text>
              <Text style={[st.td, { flex: 0.6, textAlign: 'right' }]}>{h.n}</Text>
            </View>
          ))}
        </View>
      )}
      <Footer ctx={ctx} client={client} />
    </Page>
  )
}

function RhythmPage({ ctx }: { ctx: Ctx }) {
  const { s, tz, t, lang } = ctx
  const a = s.summary?.advanced
  const sf = s.summary?.series?.full
  const ix = (id: IndexId) => indexText(id, lang)
  const cos = a?.cosinor_hr, cosLn = a?.cosinor_ln_rmssd, pr = a?.prsa, fr = a?.fragmentation, m = a?.mse
  const amp = cos?.amp ?? null
  const clock = ix('internal_clock')
  const lab = fr?.pip == null ? null : fragmentationLabel(fr.pip)
  return (
    <Page size="A4" style={st.page}>
      <MiniHeader ctx={ctx} title={t('rhythm')} />
      {!cos || amp == null ? (
        <View style={{ marginBottom: 6 }}><Unavailable name={clock.name} reason={a?.unavailable?.internal_clock ?? t('clock_na')} /></View>
      ) : (
        <View style={{ marginBottom: 6 }}>
          <IndexCard
            name={clock.name}
            value={clockStrength(amp)}
            levelLabel={lvlText(level.clock(amp), t)}
            levelColor={lvlColor(level.clock(amp))}
            phrase={clock.phrase}
            detail={`${t('clock_strength')} ±${amp.toFixed(1)} bpm (MESOR ${cos.mesor == null ? '—' : Math.round(cos.mesor)}) · ${t('clock_min')} ${cos.bathy == null ? '—' : hourFraction(cos.bathy)} · ${t('clock_peak')} ${cos.acro == null ? '—' : hourFraction(cos.acro)} · R² ${cos.r2?.toFixed(2) ?? '—'} · ${cos.hours} h${cos.indicative ? ` · ${t('clock_indicative')}` : ''}${cosLn && cosLn.amp != null ? ` · ln RMSSD: A ${cosLn.amp.toFixed(2)}, ${t('clock_peak')} ${cosLn.acro == null ? '—' : hourFraction(cosLn.acro)}` : ''}`}
          />
          {a?.hourly?.length ? <View style={{ marginTop: 4 }}><CosinorSvg hours={a.hourly} fit={cos} tz={tz} /></View> : null}
        </View>
      )}
      {!pr ? (
        <View style={{ marginBottom: 6 }}><Unavailable name={ix('dc').name} reason={a?.unavailable?.dc ?? '—'} /></View>
      ) : (
        <TwoCol
          a={<IndexCard name={ix('dc').name} value={pr.dc?.toFixed(2) ?? '—'} unit="ms" levelLabel={pr.dc == null ? null : lvlText(level.dc(pr.dc), t)} levelColor={pr.dc == null ? C.accentDark : lvlColor(level.dc(pr.dc))} phrase={ix('dc').phrase} detail={`${pr.n_dec} ${t('anchors')} · ${pr.beats} ${t('beats_used')}`} />}
          b={<IndexCard name={ix('ac').name} value={pr.ac?.toFixed(2) ?? '—'} unit="ms" levelLabel={pr.ac == null ? null : lvlText(level.ac(pr.ac), t)} levelColor={pr.ac == null ? C.accentDark : lvlColor(level.ac(pr.ac))} phrase={ix('ac').phrase} detail={`${pr.n_acc} ${t('anchors')}`} />}
        />
      )}
      <TwoCol
        a={!fr || !lab ? <Unavailable name={ix('fragmentation').name} reason={a?.unavailable?.fragmentation ?? '—'} /> : <IndexCard name={ix('fragmentation').name} value={t(`frag_${lab}`)} levelLabel={lvlText(level.fragmentation(lab), t)} levelColor={lvlColor(level.fragmentation(lab))} phrase={ix('fragmentation').phrase} detail={`PIP ${fr.pip?.toFixed(1)}% · IALS ${fr.ials?.toFixed(3)} · PSS ${fr.pss?.toFixed(1)}% · PAS ${fr.pas?.toFixed(1)}% · ${fr.beats} ${t('beats_used')}${a?.unreliable?.includes('fragmentation') ? ` · ${t('unreliable')}` : ''}`} />}
        b={!m ? <Unavailable name={ix('mse').name} reason={a?.unavailable?.mse ?? '—'} /> : <IndexCard name={ix('mse').name} value={m.ci?.toFixed(1) ?? '—'} unit="CI" phrase={ix('mse').phrase} detail={`SampEn(1) ${m.e[0]?.toFixed(2) ?? '—'} · SampEn(10) ${(m.e.length > 9 ? m.e[9] : null)?.toFixed(2) ?? '—'} · ${m.chunks} × ${Math.floor(m.beats / (m.chunks || 1))} ${t('beats_used')}${a?.unreliable?.includes('mse') ? ` · ${t('unreliable')}` : ''}`} />}
      />
      <TwoCol
        a={a?.dfa_alpha2 == null ? <Unavailable name={ix('dfa_alpha2').name} reason={a?.unavailable?.dfa_alpha2 ?? '—'} /> : <IndexCard name={ix('dfa_alpha2').name} value={a.dfa_alpha2.toFixed(2)} unit="α2" phrase={ix('dfa_alpha2').phrase} detail={sf?.dfa_alpha1 == null ? null : `α1 ${sf.dfa_alpha1.toFixed(2)} (4-16)`} />}
        b={sf?.vlf == null ? <Unavailable name={ix('ulf_vlf').name} reason="—" /> : <IndexCard name={ix('ulf_vlf').name} value={`${Math.round(sf.vlf)}`} unit="ms² VLF" phrase={ix('ulf_vlf').phrase} detail={`ULF ${sf.ulf == null ? '—' : `${Math.round(sf.ulf)} ms²`} · LF ${sf.lf == null ? '—' : Math.round(sf.lf)} · HF ${sf.hf == null ? '—' : Math.round(sf.hf)} ms² · ${t('tracts_detail').replace('{n}', `${sf.tracts ?? 0}`).replace('{longest}', duration(a?.tracts?.longest_min ?? 0)).replace('{total}', duration(sf.tract_minutes ?? 0))}`} />}
      />
      <Footer ctx={ctx} client={false} />
    </Page>
  )
}

function ParamsPage({ ctx }: { ctx: Ctx }) {
  const { s, t } = ctx
  const sum = s.summary
  const f = (v: number | null | undefined, d: number, u: string) => v == null ? '—' : `${v.toFixed(d)}${u ? ` ${u}` : ''}`
  const rows: Array<[string, (x: SeriesHrv) => string]> = [
    [t('duration'), (x) => duration(x.minutes)], [t('beats'), (x) => `${x.rr_count}`], [t('tracts'), (x) => `${x.tracts ?? '—'}`],
    ['HR', (x) => f(x.mean_hr, 0, 'bpm')], ['RMSSD', (x) => f(x.rmssd, 1, 'ms')], ['SDNN', (x) => f(x.sdnn, 1, 'ms')], ['pNN50', (x) => f(x.pnn50, 1, '%')],
    ['ULF', (x) => f(x.ulf, 0, 'ms²')], ['VLF', (x) => f(x.vlf, 0, 'ms²')], ['LF', (x) => f(x.lf, 0, 'ms²')], ['HF', (x) => f(x.hf, 0, 'ms²')],
    ['LF/HF', (x) => f(x.lf_hf, 2, '')], ['LF n.u.', (x) => f(x.lf_nu, 1, '')], ['HF n.u.', (x) => f(x.hf_nu, 1, '')], ['Total Power', (x) => f(x.total_power, 0, 'ms²')],
    ['Baevsky SI', (x) => f(x.si, 0, '')], ['DFA α1', (x) => f(x.dfa_alpha1, 2, '')], ['DFA α2', (x) => f(x.dfa_alpha2, 2, '')], ['SD1 / SD2', (x) => `${f(x.sd1, 1, '')} / ${f(x.sd2, 1, '')}`],
  ]
  const series: Array<[string, SeriesHrv | null | undefined]> = [[t('series_full'), sum?.series?.full], [t('series_night'), sum?.series?.night], [t('series_day'), sum?.series?.day]]
  const tr = sum?.advanced?.tracts
  const { profile } = effectiveProfile(s)
  const meta: Array<[string, string]> = [
    [t('profile'), t(`profile_${profile}`)],
    [t('rr_total'), `${s.rr_count ?? '—'}`],
    [t('valid_data'), `${s.valid_coverage_percentage == null ? '—' : Math.round(s.valid_coverage_percentage)} % / ${s.windows.length} ${t('valid_windows').toLowerCase()}`],
    [t('artifacts'), `${s.artifact_percentage?.toFixed(1) ?? '—'} %`],
    [t('signal'), t(`signal_${s.signal_quality ?? 'fair'}`)],
    [t('irregular'), `${s.ectopic_count ?? 0}`],
    [t('gaps'), duration(sum?.gap_minutes ?? 0)],
    ...(tr ? [[t('tracts'), t('tracts_detail').replace('{n}', `${tr.count}`).replace('{longest}', duration(tr.longest_min)).replace('{total}', duration(tr.total_min))] as [string, string]] : []),
    [t('device'), `${sourceLabel(s.source)}${s.device_name ? ` · ${s.device_name}` : ''}`],
    [t('algorithm'), s.algorithm_version || '—'],
    ...(sum?.hr_rest != null ? [['HR rest (p5) / HRmax', `${Math.round(sum.hr_rest)} / ${sum.hr_max_used == null ? '—' : Math.round(sum.hr_max_used)} bpm`] as [string, string]] : []),
    ...(sum?.ln_rmssd_reference != null ? [['ln RMSSD ref. / MAD', `${sum.ln_rmssd_reference.toFixed(2)} / ${sum.ln_rmssd_mad?.toFixed(3) ?? '—'}`] as [string, string]] : []),
  ]
  return (
    <Page size="A4" style={st.page}>
      <MiniHeader ctx={ctx} title={t('params')} />
      <Text style={st.small}>{tx(t('tract_note'))}</Text>
      <View style={{ borderWidth: 0.4, borderColor: C.border, marginTop: 6 }}>
        <View style={{ flexDirection: 'row' }}>
          <Text style={[st.th, { flex: 1.4 }]} />
          {series.map(([n]) => <Text key={n} style={[st.th, { flex: 1, textAlign: 'right' }]}>{tx(n)}</Text>)}
        </View>
        {rows.map(([label, fn]) => (
          <View key={label} style={{ flexDirection: 'row', borderTopWidth: 0.4, borderTopColor: C.border }}>
            <Text style={[st.td, { flex: 1.4, fontFamily: 'Helvetica-Bold' }]}>{tx(label)}</Text>
            {series.map(([n, x]) => <Text key={n} style={[st.td, { flex: 1, textAlign: 'right' }]}>{tx(x ? fn(x) : '—')}</Text>)}
          </View>
        ))}
      </View>
      <Text style={st.section}>{tx(t('meta'))}</Text>
      <View style={{ borderWidth: 0.4, borderColor: C.border }}>
        {meta.map(([k, v], i) => (
          <View key={k} style={{ flexDirection: 'row', borderTopWidth: i === 0 ? 0 : 0.4, borderTopColor: C.border }}>
            <Text style={[st.td, { flex: 1.2, fontFamily: 'Helvetica-Bold' }]}>{tx(k)}</Text>
            <Text style={[st.td, { flex: 2 }]}>{tx(v)}</Text>
          </View>
        ))}
      </View>
      <View style={[st.box, { marginTop: 8 }]}><Text style={{ fontSize: 7.5, lineHeight: 1.5 }}>{tx(t('disclaimer'))}</Text></View>
      <Footer ctx={ctx} client={false} />
    </Page>
  )
}

function HowPage({ ctx }: { ctx: Ctx }) {
  const { s, t, lang } = ctx
  const { profile } = effectiveProfile(s)
  const f = profileFlags(profile)
  const ids: IndexId[] = [
    'balance', 'reserve',
    ...(f.hasWakePages ? (['recovery_pauses', 'longest_stretch'] as IndexId[]) : []),
    'peak', 'return_time', 'event_response',
    ...(f.hasNightPages ? (['night_recovery', 'hr_dip', 'time_to_min', 'rest_waves'] as IndexId[]) : []),
    ...(f.hasRhythmPage ? (['internal_clock'] as IndexId[]) : []),
    'dc', 'ac',
    ...(profile !== 'breve' ? (['fragmentation', 'respiration'] as IndexId[]) : []),
    ...(f.hasWakePages ? (['hour_map'] as IndexId[]) : []),
    ...(f.hasRhythmPage ? (['mse', 'dfa_alpha2', 'ulf_vlf'] as IndexId[]) : []),
  ]
  return (
    <Page size="A4" style={st.page}>
      <MiniHeader ctx={ctx} title={t('how')} />
      <Text style={{ fontSize: 8, color: C.textMid }}>{tx(t('how_intro'))}</Text>
      <Text style={{ fontSize: 7, lineHeight: 1.5, marginTop: 6, marginBottom: 8 }}>{tx(t('method_text'))}</Text>
      {ids.map((id) => {
        const x = indexText(id, lang)
        return (
          <View key={id} style={st.howBlock} wrap={false}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.accentDark }}>{tx(x.name)}</Text>
              <Text style={{ fontSize: 7.5, color: C.textMid, marginLeft: 8, flex: 1 }}>{tx(x.tech)}</Text>
            </View>
            <Text style={{ fontSize: 7.2, lineHeight: 1.4, marginTop: 3 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{tx(t('how_method'))}: </Text>{tx(x.method)}{'\n'}
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{tx(t('how_req'))}: </Text>{tx(x.req)}{'\n'}
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{tx(t('how_ref'))}: </Text>{tx(x.ref)}
            </Text>
          </View>
        )
      })}
      <Footer ctx={ctx} client={false} />
    </Page>
  )
}

// ── Documento ───────────────────────────────────────────────────────────────

export function MonitoringPdfDocument({ session, professional, client, lang = 'it' }: { session: Monitoring24hSession; professional: ProfessionalProfile | null; client: boolean; lang?: Lang }) {
  const ctx: Ctx = { s: session, tz: session.tz_offset_minutes, lang, client, professional, t: (k) => monT(k, lang) }
  const { profile } = effectiveProfile(session)
  const pages = pagesFor(profile, !client)
  return (
    <Document title={`${monT('title', lang)} – ${session.client_name ?? ''}`} author={professional ? `${professional.nome ?? ''} ${professional.cognome ?? ''}`.trim() : 'Stress Index'}>
      {pages.map((p) => {
        switch (p) {
          case 'riepilogo': return <React.Fragment key={p}><SummaryPage ctx={ctx} /><IndicesPage ctx={ctx} /></React.Fragment>
          case 'notte': return <NightPage key={p} ctx={ctx} />
          case 'andamento': return <TrendPage key={p} ctx={ctx} />
          case 'eventi': return null // già nella pagina Andamento.
          case 'mappa_ore': return <HourMapPage key={p} ctx={ctx} />
          case 'ritmo': return <RhythmPage key={p} ctx={ctx} />
          case 'parametri': return <React.Fragment key={p}><ParamsPage ctx={ctx} /><HowPage ctx={ctx} /></React.Fragment>
          default: return null
        }
      })}
    </Document>
  )
}

