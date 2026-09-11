// Report Sonno — solo server (renderToBuffer). Stessa struttura di
// sleep_pdf_service.dart: Riepilogo, Ossigenazione, Cuore + eventi, Nota
// metodologica. Stringhe da SleepPdfStrings (identiche all'app).
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Svg, Rect, Line, Path, Circle, Text as SvgText } from '@react-pdf/renderer'
import type { SleepDesaturationEvent, SleepSession, SleepWindow } from './monitoring-types'
import { MON, SLEEP_PARAMS, SLEEP_STATE_COLOR, SLEEP_STATE_LABEL, SLEEP_STATE_ORDER, STATE_COLOR, dayNumeric, duration, hm, seconds, sleepComponentColor, sleepScoreColor } from './monitoring-format'
import { sleepT } from './sleep-strings'
import type { Lang } from './monitoring-strings'
import { pdfText as tx } from './pdf-text'
import type { ProfessionalProfile } from './types'

const C = {
  accent: MON.sleep, accentDark: MON.sleepDark, accentLight: MON.sleepLight,
  anthracite: '#2F343A', textMid: '#66707A', border: '#E2E6EA', bgGray: '#F6F7F8', invalid: STATE_COLOR.invalid,
  good: STATE_COLOR.recovery, bad: STATE_COLOR.stress, warning: MON.warning, white: '#FFFFFF',
} as const

const PAGE_W = 595.28
const MARGIN_H = 51
const CONTENT_W = PAGE_W - MARGIN_H * 2
const MAX_EVENTS = 20

const st = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 46, paddingHorizontal: MARGIN_H, fontSize: 9, fontFamily: 'Helvetica', color: C.anthracite, lineHeight: 1.35 },
  header: { backgroundColor: C.accentDark, borderRadius: 8, padding: 14, flexDirection: 'row' },
  chip: { fontSize: 7, color: C.white, borderWidth: 0.6, borderColor: C.white, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginRight: 5, marginTop: 5 },
  miniHeader: { backgroundColor: C.accentDark, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  section: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.accentDark, marginTop: 8, marginBottom: 5 },
  box: { backgroundColor: C.bgGray, borderWidth: 0.5, borderColor: C.border, borderRadius: 6, padding: 8 },
  phrase: { backgroundColor: C.accentLight, borderRadius: 6, padding: 10, fontSize: 9.5, lineHeight: 1.5 },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.accentDark, padding: 3, backgroundColor: C.accentLight },
  td: { fontSize: 7.5, padding: 3 },
  footer: { position: 'absolute', bottom: 22, left: MARGIN_H, right: MARGIN_H, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: C.textMid, borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6 },
  kpiLabel: { fontSize: 7, color: C.textMid },
  kpiValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  infoTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  infoText: { fontSize: 8, marginTop: 3, lineHeight: 1.5 },
})

type Ctx = { s: SleepSession; tz: number; t: (k: string) => string; professional: ProfessionalProfile | null; client: boolean }

function Footer({ ctx }: { ctx: Ctx }) {
  return (
    <View style={st.footer} fixed>
      <Text>{tx(ctx.t('title'))} · {tx(ctx.s.client_name ?? '')} · {dayNumeric(ctx.s.start_time, ctx.tz)}</Text>
      <Text render={({ pageNumber, totalPages }) => `${ctx.client ? 'Stress Index · ' : ''}${tx(ctx.t('page'))} ${pageNumber} / ${totalPages}`} />
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

function InfoBox({ title, text, color }: { title: string; text: string; color: string }) {
  return (
    <View style={{ borderWidth: 0.8, borderColor: color, borderRadius: 6, padding: 8, flex: 1 }}>
      <Text style={[st.infoTitle, { color }]}>{tx(title)}</Text>
      <Text style={st.infoText}>{tx(text)}</Text>
    </View>
  )
}

function TextBox({ text }: { text: string }) {
  return <View style={st.box}><Text style={{ fontSize: 7.5, lineHeight: 1.5 }}>{tx(text)}</Text></View>
}

function DisclaimerBox({ text }: { text: string }) {
  return <View style={{ backgroundColor: C.accentLight, borderRadius: 6, padding: 9 }}><Text style={{ fontSize: 7.5, lineHeight: 1.5 }}>{tx(text)}</Text></View>
}

function odiColor(l: string | null | undefined) { return l === 'normal' ? C.good : l === 'mild' ? C.warning : l === 'moderate' ? '#D98C5F' : l === 'marked' ? C.bad : C.textMid }
function t90Color(l: string | null | undefined) { return l === 'normal' ? C.good : l === 'observe' ? C.warning : l === 'relevant' ? C.bad : C.textMid }

function GaugeSvg({ value }: { value: number | null }) {
  const W = 120, H = 62, cx = 60, cy = 58, r = 46, stroke = 9
  const arc = (from: number, to: number) => { const a0 = Math.PI + from * Math.PI, a1 = Math.PI + to * Math.PI; return `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${to - from > 0.5 ? 1 : 0} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}` }
  const v = value == null ? null : Math.max(0, Math.min(100, value))
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {Array.from({ length: 20 }, (_, i) => <Path key={i} d={arc(i / 20, (i + 1) / 20 + 0.002)} stroke={sleepScoreColor(((i + 0.5) / 20) * 100)} strokeOpacity={0.28} strokeWidth={stroke} fill="none" />)}
      {v != null && v > 0 && <Path d={arc(0, v / 100)} stroke={sleepScoreColor(v)} strokeWidth={stroke} strokeLinecap="round" fill="none" />}
      <SvgText x={cx} y={cy - 2} style={{ fontSize: 18, fontWeight: 700, fill: v == null ? C.textMid : sleepScoreColor(v) }} textAnchor="middle">{v == null ? '—' : String(Math.round(v))}</SvgText>
    </Svg>
  )
}

function CurveSvg({ windows, pick, color, thresholdY, referenceY, referenceLabel, markers, markerColor, yMax, tz }: { windows: SleepWindow[]; pick: (w: SleepWindow) => number | null; color: string; thresholdY?: number; referenceY?: number | null; referenceLabel?: string | null; markers: Array<[string, number]>; markerColor: string; yMax?: number; tz: number }) {
  const W = CONTENT_W, H = 130
  const left = 28, top = 6, bottom = 14
  const plotW = W - left, plotH = H - top - bottom
  if (windows.length === 0) return null
  const startMs = new Date(windows[0].s).getTime()
  const totalMs = Math.max(1, new Date(windows[windows.length - 1].e).getTime() - startMs)
  const x = (iso: string) => left + ((new Date(iso).getTime() - startMs) / totalMs) * plotW
  const vals = windows.filter((w) => w.state !== 'nonValido').map(pick).filter((v): v is number => v != null)
  if (vals.length === 0) return null
  let vMin = Math.min(...vals, ...markers.map((m) => m[1]), referenceY ?? Infinity)
  let vMax = yMax ?? Math.max(...vals)
  if (vMax - vMin < 1e-6) { vMax += 1; vMin -= 1 }
  const pad = (vMax - vMin) * 0.08
  vMin -= pad; if (yMax == null) vMax += pad
  const y = (v: number) => top + plotH - ((v - vMin) / (vMax - vMin)) * plotH
  const segs: string[] = []
  let cur = ''
  for (const w of windows) {
    const v = w.state === 'nonValido' ? null : pick(w)
    if (v == null) { if (cur) segs.push(cur); cur = ''; continue }
    cur += `${cur ? 'L' : 'M'}${x(w.s).toFixed(1)} ${y(v).toFixed(1)} `
  }
  if (cur) segs.push(cur)
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {thresholdY != null && thresholdY > vMin && <Rect x={left} y={y(thresholdY)} width={plotW} height={Math.max(0, top + plotH - y(thresholdY))} fill={C.bad} fillOpacity={0.1} />}
      {thresholdY != null && thresholdY > vMin && <Line x1={left} x2={W} y1={y(thresholdY)} y2={y(thresholdY)} stroke={C.bad} strokeOpacity={0.55} strokeWidth={0.8} strokeDasharray="3 3" />}
      {referenceY != null && <Line x1={left} x2={W} y1={y(referenceY)} y2={y(referenceY)} stroke={C.good} strokeOpacity={0.7} strokeWidth={0.8} strokeDasharray="3 3" />}
      {referenceY != null && referenceLabel && <SvgText x={W - 2} y={y(referenceY) - 2} style={{ fontSize: 6.5, fill: C.good }} textAnchor="end">{referenceLabel}</SvgText>}
      {[0, 0.5, 1].map((f, i) => { const v = vMin + (vMax - vMin) * f; return <React.Fragment key={i}><Line x1={left} x2={W} y1={y(v)} y2={y(v)} stroke={C.border} strokeWidth={0.5} /><SvgText x={0} y={y(v) + 2.5} style={{ fontSize: 6.5, fill: C.textMid }}>{String(Math.round(v))}</SvgText></React.Fragment> })}
      {segs.map((d, i) => <Path key={i} d={d} fill="none" stroke={color} strokeWidth={1} />)}
      {markers.map(([iso, v], i) => <Circle key={i} cx={x(iso)} cy={y(v)} r={markers.length > 120 ? 1.2 : 1.8} fill={markerColor} />)}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => <SvgText key={`x${i}`} x={left + f * plotW} y={H - 3} style={{ fontSize: 6.5, fill: C.textMid }} textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}>{hm(new Date(startMs + f * totalMs).toISOString(), tz)}</SvgText>)}
    </Svg>
  )
}

function StripSvg({ windows, events }: { windows: SleepWindow[]; events: SleepDesaturationEvent[] }) {
  const W = CONTENT_W, H = 30
  if (windows.length === 0) return null
  const startMs = new Date(windows[0].s).getTime()
  const totalMs = Math.max(1, new Date(windows[windows.length - 1].e).getTime() - startMs)
  const x = (iso: string) => ((new Date(iso).getTime() - startMs) / totalMs) * W
  const runs: Array<{ x0: number; x1: number; state: SleepWindow['state'] }> = []
  for (const w of windows) {
    const x0 = x(w.s), x1 = x(w.e)
    const last = runs[runs.length - 1]
    if (last && last.state === w.state) last.x1 = x1
    else runs.push({ x0, x1, state: w.state })
  }
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {runs.map((r, i) => <Rect key={i} x={r.x0} y={0} width={Math.max(0.4, r.x1 - r.x0)} height={H} fill={SLEEP_STATE_COLOR[r.state]} />)}
      {events.map((e, i) => { const h = Math.max(0.35, Math.min(1, 0.35 + (((e.drop ?? 3) - 3) / 7) * 0.65)) * H; return <Line key={`e${i}`} x1={x(e.start)} x2={x(e.start)} y1={H} y2={H - h} stroke={C.bad} strokeWidth={events.length > 200 ? 0.6 : 1} /> })}
      <Rect x={0.3} y={0.3} width={W - 0.6} height={H - 0.6} fill="none" stroke={C.border} strokeWidth={0.6} />
    </Svg>
  )
}

function StripLegend() {
  return (
    <View style={{ flexDirection: 'row', marginTop: 3 }}>
      {SLEEP_STATE_ORDER.map((s) => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
          <View style={{ width: 8, height: 8, marginRight: 3, backgroundColor: SLEEP_STATE_COLOR[s], borderWidth: 0.3, borderColor: C.border }} />
          <Text style={{ fontSize: 7, color: C.textMid }}>{tx(SLEEP_STATE_LABEL[s])}</Text>
        </View>
      ))}
    </View>
  )
}

function Header({ ctx }: { ctx: Ctx }) {
  const { s, tz, t } = ctx
  const sl = s.night?.sleep
  return (
    <View style={st.header}>
      <View style={{ width: 56, marginRight: 12 }}>
        <View style={{ width: 38, height: 38, backgroundColor: C.white, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.accentDark }}>SI</Text></View>
        <Text style={{ fontSize: 7.5, color: C.white, marginTop: 4 }}>{tx(t('module'))}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 9, color: C.white }}>{tx(t('title'))}</Text>
        <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.white }}>{tx(s.client_name ?? '')}</Text>
        <Text style={{ fontSize: 9, color: C.white, marginTop: 4 }}>
          {tx(t('night_of'))}: {dayNumeric(s.night?.night_start ?? s.start_time, tz)} {hm(s.night?.night_start ?? s.start_time, tz)} – {hm(s.night?.night_end ?? s.end_time, tz)}  ·  {tx(t('duration'))}: {duration(s.night?.duration_minutes ?? s.duration_minutes)}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Text style={st.chip}>{tx(t('device'))}: {tx(s.device_name ?? 'Checkme O2 Max')}</Text>
          {s.device_serial && <Text style={st.chip}>{tx(t('serial'))}: {s.device_serial}</Text>}
          <Text style={st.chip}>{tx(t('signal'))}: {tx(t(`signal_${sl?.signal.coverage_label ?? 'poor'}`))}</Text>
          <Text style={st.chip}>{tx(t('valid_data'))}: {sl ? Math.round(sl.signal.coverage_pct) : '—'} %</Text>
          <Text style={st.chip}>{tx(t('sample_step'))}: {sl?.signal.sample_interval_sec ?? s.sample_interval_seconds ?? '—'} s</Text>
        </View>
      </View>
    </View>
  )
}

function MiniHeader({ ctx, title }: { ctx: Ctx; title: string }) {
  return (
    <View style={st.miniHeader} fixed>
      <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.white, flex: 1 }}>{tx(title)}</Text>
      <Text style={{ fontSize: 8, color: C.white }}>{tx(ctx.s.client_name ?? '')} · {dayNumeric(ctx.s.start_time, ctx.tz)}</Text>
    </View>
  )
}

function ProfSection({ p }: { p: ProfessionalProfile | null }) {
  if (!p) return null
  const rows = [[p.titolo, p.nome, p.cognome].filter(Boolean).join(' '), [p.professione, p.specializzazione].filter(Boolean).join(' · '), p.nome_studio, p.indirizzo, [p.telefono, p.sito_web].filter(Boolean).join(' · ')].filter((r) => r && r.trim())
  if (rows.length === 0) return null
  return <View style={[st.box, { marginBottom: 8 }]}>{rows.map((r, i) => <Text key={i} style={{ fontSize: i === 0 ? 9 : 7.5, fontFamily: i === 0 ? 'Helvetica-Bold' : 'Helvetica', color: i === 0 ? C.anthracite : C.textMid }}>{tx(r as string)}</Text>)}</View>
}

export function SleepPdfDocument({ session, professional, client, lang = 'it' }: { session: SleepSession; professional: ProfessionalProfile | null; client: boolean; lang?: Lang }) {
  const t = (k: string) => sleepT(k, lang)
  const ctx: Ctx = { s: session, tz: session.tz_offset_minutes, t, professional, client }
  const s = session
  const tz = s.tz_offset_minutes
  const n = s.night?.sleep ?? null
  const analyzable = !!n?.analyzable
  const o = n?.oxygenation ?? null
  const c = n?.cardiac ?? null
  const score = s.summary?.sleep_score ?? null
  const trendText = (tr: number | null) => tr == null ? t('trend_na') : tr > 0 ? t('trend_up') : tr < 0 ? t('trend_down') : t('trend_flat')
  const trendColor = (tr: number | null) => tr == null ? C.textMid : tr > 0 ? C.good : tr < 0 ? C.bad : C.accent
  const events = n?.events ?? []

  return (
    <Document title={`${t('title')} – ${s.client_name ?? ''}`} author={professional ? `${professional.nome ?? ''} ${professional.cognome ?? ''}`.trim() : 'Stress Index'}>
      {/* ── Pagina 1: riepilogo ────────────────────────────────────────── */}
      <Page size="A4" style={st.page}>
        <Header ctx={ctx} />
        <View style={{ height: 8 }} />
        <ProfSection p={professional} />
        {!n || !analyzable ? (
          <>
            <Text style={[st.section, { color: C.bad }]}>{tx(t('not_analyzable'))}</Text>
            <TextBox text={n?.not_analyzable_reason ?? t('na')} />
          </>
        ) : (
          <>
            <Text style={st.section}>{tx(t('components'))}</Text>
            {score && (
              <View>
                {([['comp_oxygenation', score.oxygenation, score.weights.oxygenation], ['comp_respiratory', score.respiratory_stability, score.weights.respiratory_stability], ['comp_cardiac', score.cardiac_recovery, score.weights.cardiac_recovery], ['comp_continuity', score.continuity, score.weights.continuity]] as Array<[string, number | null, number]>).map(([k, v, w]) => {
                  const color = v == null ? C.textMid : sleepComponentColor(v)
                  return (
                    <View key={k} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 2 }}>
                      <Text style={{ width: 130, fontSize: 8, color: C.textMid }}>{tx(t(k))}{w > 0 ? ` · ${Math.round(w * 100)} %` : ''}</Text>
                      <View style={{ flex: 1, height: 7, backgroundColor: C.invalid, borderRadius: 3 }}><View style={{ width: `${v == null ? 0 : Math.max(0, Math.min(100, v))}%`, height: 7, backgroundColor: color, borderRadius: 3 }} /></View>
                      <Text style={{ width: 28, textAlign: 'right', fontSize: 8.5, fontFamily: 'Helvetica-Bold', color }}>{v == null ? '—' : Math.round(v)}</Text>
                    </View>
                  )
                })}
                <Text style={{ fontSize: 6.5, color: C.textMid, marginTop: 2 }}>{tx(score.continuity == null ? t('weights_note_nomov') : t('weights_note'))}</Text>
              </View>
            )}
            <View style={{ height: 6 }} />
            <View style={[st.box, { alignItems: 'center' }]}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.textMid }}>{tx(t('sleep_score'))}</Text>
              <GaugeSvg value={score?.total ?? null} />
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: score ? sleepScoreColor(score.total) : C.textMid, marginTop: 4 }}>{tx(score ? t(`score_${score.label}`) : t('na'))}</Text>
            </View>
            <Text style={st.section}>{tx(t('summary'))}</Text>
            <Text style={st.phrase}>{tx(s.summary?.summary_phrase ?? '')}</Text>
            <Text style={st.section}>{tx(t('key_numbers'))}</Text>
            <View style={{ flexDirection: 'row' }}>
              <Kpi label={t('odi3').split(' (')[0]} value={o ? `${o.odi3.toFixed(1)} /h · ${t(`odi_${o.odi3_label}`)}` : '—'} color={odiColor(o?.odi3_label)} />
              <Kpi label={t('t90')} value={o ? `${o.t90_pct.toFixed(1)} % · ${t(`band_${o.t90_label}`)}` : '—'} color={t90Color(o?.t90_label)} />
              <Kpi label={t('pr_min')} value={c ? `${Math.round(c.min_pr)} bpm` : '—'} color={C.accentDark} />
            </View>
            <View style={{ flexDirection: 'row', marginTop: 6 }}>
              <Kpi label={t('spo2_mean')} value={o?.mean_spo2 == null ? '—' : `${o.mean_spo2.toFixed(1)} %`} color={C.anthracite} />
              <Kpi label={t('events')} value={o ? `${o.event_count}` : '—'} color={C.anthracite} />
              <Kpi label={t('pr_mean')} value={c ? `${Math.round(c.mean_pr)} bpm` : '—'} color={C.anthracite} />
            </View>
            {n.device?.o2_score != null && <View style={{ marginTop: 8 }}><TextBox text={`${t('device_o2score')}: ${n.device.o2_score} · ${t('sleep_score')}: ${score?.total ?? '—'}${n.device.drops_4 != null ? ` · ${t('device_drops4')}: ${n.device.drops_4}` : ''}`} /></View>}
          </>
        )}
        <Footer ctx={ctx} />
      </Page>

      {/* ── Pagina 2: ossigenazione ────────────────────────────────────── */}
      <Page size="A4" style={st.page}>
        <MiniHeader ctx={ctx} title={t('oxygenation')} />
        {!n || !analyzable || !o ? (
          <TextBox text={t('not_analyzable')} />
        ) : (
          <>
            <Text style={{ fontSize: 8.5, color: C.textMid }}>{tx(t('spo2_chart'))}</Text>
            <CurveSvg windows={s.windows} pick={(w) => w.spo2} color={C.accent} thresholdY={SLEEP_PARAMS.t90Threshold} markers={events.map((e) => [e.nadir_time, e.nadir])} markerColor={C.bad} yMax={100} tz={tz} />
            <StripSvg windows={s.windows} events={events} />
            <StripLegend />
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <Kpi label="ODI3" value={`${o.odi3.toFixed(1)} /h`} color={odiColor(o.odi3_label)} />
              <Kpi label="ODI4" value={`${o.odi4.toFixed(1)} /h`} color={C.accentDark} />
              <Kpi label={t('t90')} value={`${o.t90_minutes.toFixed(1)} min`} color={t90Color(o.t90_label)} />
              <Kpi label={t('nadir')} value={`${o.nadir} %${o.nadir_time ? ` · ${hm(o.nadir_time, tz)}` : ''}`} color={o.nadir < SLEEP_PARAMS.oxyNadirPenaltyBelow ? C.bad : C.anthracite} />
            </View>
            <Text style={st.section}>{tx(t('below_threshold'))}</Text>
            <View style={{ borderWidth: 0.4, borderColor: C.border }}>
              <View style={{ flexDirection: 'row' }}>{[t('threshold'), t('minutes'), t('percent'), t('band')].map((h, i) => <Text key={i} style={[st.th, { flex: 1, textAlign: i === 0 ? 'left' : 'right' }]}>{tx(h)}</Text>)}</View>
              {([['90 %', o.t90_minutes, o.t90_pct, t(`band_${o.t90_label}`)], ['88 %', o.t88_minutes, o.t88_pct, ''], ['85 %', o.t85_minutes, o.t85_pct, '']] as Array<[string, number, number, string]>).map(([th, min, pct, band]) => (
                <View key={th} style={{ flexDirection: 'row', borderTopWidth: 0.4, borderTopColor: C.border }}>
                  <Text style={[st.td, { flex: 1 }]}>{th}</Text><Text style={[st.td, { flex: 1, textAlign: 'right' }]}>{min.toFixed(1)}</Text><Text style={[st.td, { flex: 1, textAlign: 'right' }]}>{pct.toFixed(1)}</Text><Text style={[st.td, { flex: 1, textAlign: 'right' }]}>{tx(band)}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <InfoBox title={t('odi3')} text={`${o.odi3.toFixed(2)} · ${t(`odi_${o.odi3_label}`)}\n${t('events')}: ${o.event_count} (ODI4: ${o.event_count_4}) · ${t('valid_time')}: ${duration(Math.round(n.signal.valid_recording_minutes))}${n.device?.drops_4 == null ? '' : `\n${t('device_drops4')}: ${n.device.drops_4}`}`} color={odiColor(o.odi3_label)} />
              <View style={{ width: 8 }} />
              <InfoBox title={t('delta_index')} text={`${o.delta_index_12s?.toFixed(2) ?? '—'} · SD ${o.spo2_sd?.toFixed(2) ?? '—'}\n${t('cyclic')}: ${o.cyclic_runs === 0 ? t('cyclic_none') : `${o.cyclic_runs} ${t('cyclic_runs')} · ${duration(Math.round(o.cyclic_minutes))}`}`} color={C.accent} />
            </View>
            {n.signal.invalid_segments.map((seg, i) => (
              <View key={i} style={{ marginTop: 6 }}><TextBox text={`${t('probe_off')}: ${hm(seg.start, tz)} – ${hm(seg.end, tz)} (${seconds(Math.round((new Date(seg.end).getTime() - new Date(seg.start).getTime()) / 1000))}), ${t('probe_off_note')}`} /></View>
            ))}
            <View style={{ marginTop: 10 }}><DisclaimerBox text={t('disclaimer_odi')} /></View>
          </>
        )}
        <Footer ctx={ctx} />
      </Page>

      {/* ── Pagina 3: cuore + eventi ───────────────────────────────────── */}
      <Page size="A4" style={st.page}>
        <MiniHeader ctx={ctx} title={t('heart')} />
        {!n || !analyzable || !c ? (
          <TextBox text={t('not_analyzable')} />
        ) : (
          <>
            <Text style={{ fontSize: 8.5, color: C.textMid }}>{tx(t('pr_chart'))}</Text>
            <CurveSvg windows={s.windows} pick={(w) => w.pr} color={C.bad} referenceY={c.pr_basal} referenceLabel={`${Math.round(c.pr_basal)} bpm`} markers={events.filter((e) => (e.surge_bpm ?? 0) >= SLEEP_PARAMS.surgeThresholdBpm).map((e) => [e.nadir_time, c.pr_basal])} markerColor={C.warning} tz={tz} />
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <Kpi label={t('pr_mean')} value={`${Math.round(c.mean_pr)} bpm`} color={C.anthracite} />
              <Kpi label={`${t('pr_min')}${c.min_pr_time ? ` · ${hm(c.min_pr_time, tz)}` : ''}`} value={`${Math.round(c.min_pr)} bpm`} color={C.accentDark} />
              <Kpi label={t('pr_basal')} value={`${Math.round(c.pr_basal)} bpm`} color={C.good} />
              <Kpi label={t('dip')} value={`${c.dip_pct.toFixed(1)} %`} color={c.dip_pct >= SLEEP_PARAMS.cardioDipFullPct ? C.good : C.anthracite} />
            </View>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <InfoBox title={t('trend')} text={`${c.first_3h_mean_pr == null ? '—' : Math.round(c.first_3h_mean_pr)} › ${c.last_3h_mean_pr == null ? '—' : Math.round(c.last_3h_mean_pr)} bpm · ${trendText(c.trend_bpm)}`} color={trendColor(c.trend_bpm)} />
              <View style={{ width: 8 }} />
              <InfoBox title={t('surge_pct')} text={`${Math.round(c.surge_event_pct)} %${n.movement?.available ? `\n${t('moved_pct')}: ${Math.round(n.movement.moved_pct)} % · ${t('awakenings')}: ${n.movement.estimated_awakenings}` : `\n${t('moved_pct')}: ${t('movement_na')}`}`} color={c.surge_event_pct >= 50 ? C.warning : C.accent} />
            </View>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <View style={{ flex: 2, marginRight: 10 }}>
                <Text style={st.section}>{tx(t('hourly'))}</Text>
                <View style={{ borderWidth: 0.4, borderColor: C.border }}>
                  <View style={{ flexDirection: 'row' }}>{[t('hour'), 'SpO₂', t('pr'), t('events')].map((h, i) => <Text key={i} style={[st.th, { flex: 1, textAlign: i === 0 ? 'left' : 'right' }]}>{tx(h)}</Text>)}</View>
                  {n.hourly.map((h, i) => (
                    <View key={i} style={{ flexDirection: 'row', borderTopWidth: 0.4, borderTopColor: C.border }}>
                      <Text style={[st.td, { flex: 1 }]}>{hm(h.hour_start, tz)}</Text><Text style={[st.td, { flex: 1, textAlign: 'right' }]}>{h.spo2 == null ? '—' : h.spo2.toFixed(1)}</Text><Text style={[st.td, { flex: 1, textAlign: 'right' }]}>{h.pr == null ? '—' : Math.round(h.pr)}</Text><Text style={[st.td, { flex: 1, textAlign: 'right' }]}>{h.events}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={{ flex: 3 }}>
                <Text style={st.section}>{tx(t('events_table'))}</Text>
                {events.length === 0 ? <TextBox text={t('no_events')} /> : (
                  <View style={{ borderWidth: 0.4, borderColor: C.border }}>
                    <View style={{ flexDirection: 'row' }}>{[t('ev_time'), t('ev_duration'), t('ev_drop'), t('ev_nadir'), t('ev_surge')].map((h, i) => <Text key={i} style={[st.th, { flex: 1, textAlign: i === 0 ? 'left' : 'right' }]}>{tx(h)}</Text>)}</View>
                    {events.slice(0, MAX_EVENTS).map((e, i) => (
                      <View key={i} style={{ flexDirection: 'row', borderTopWidth: 0.4, borderTopColor: C.border }}>
                        <Text style={[st.td, { flex: 1 }]}>{hm(e.start, tz)}</Text><Text style={[st.td, { flex: 1, textAlign: 'right' }]}>{e.duration_sec} s</Text><Text style={[st.td, { flex: 1, textAlign: 'right' }]}>-{e.drop?.toFixed(1) ?? '—'}</Text><Text style={[st.td, { flex: 1, textAlign: 'right', color: e.nadir < SLEEP_PARAMS.t90Threshold ? C.bad : C.anthracite }]}>{e.nadir} %</Text><Text style={[st.td, { flex: 1, textAlign: 'right' }]}>{e.surge_bpm == null ? '—' : `${e.surge_bpm >= 0 ? '+' : ''}${Math.round(e.surge_bpm)}`}</Text>
                      </View>
                    ))}
                    {events.length > MAX_EVENTS && <Text style={[st.td, { color: C.textMid }]}>{events.length - MAX_EVENTS} {tx(t('more_events'))}</Text>}
                  </View>
                )}
              </View>
            </View>
          </>
        )}
        <Footer ctx={ctx} />
      </Page>

      {/* ── Pagina 4: nota metodologica ────────────────────────────────── */}
      <Page size="A4" style={st.page}>
        <MiniHeader ctx={ctx} title={t('method')} />
        {(['odi', 't90', 'score', 'not'] as const).map((k) => (
          <View key={k} style={[st.box, { marginBottom: 8 }]}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.accentDark }}>{tx(t(`method_${k}_title`))}</Text>
            <Text style={{ fontSize: 7.5, lineHeight: 1.5, marginTop: 3 }}>{tx(t(`method_${k}`))}</Text>
          </View>
        ))}
        <View style={{ marginTop: 4 }}><DisclaimerBox text={t('disclaimer_odi')} /></View>
        <View style={{ marginTop: 8 }}><TextBox text={t('disclaimer')} /></View>
        <Text style={{ fontSize: 7, color: C.textMid, marginTop: 8 }}>
          {tx(`${t('algorithm')}: ${n?.algorithm_version ?? s.algorithm_version ?? '—'} · ${t('device')}: ${s.device_name ?? '—'}${s.device_serial ? ` · ${t('serial')} ${s.device_serial}` : ''} · ${t('sample_step')}: ${n?.signal.sample_interval_sec ?? '—'} s`)}
        </Text>
        <Footer ctx={ctx} />
      </Page>
    </Document>
  )
}
