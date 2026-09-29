'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import {
  Activity, BatteryCharging, Bed, Bolt, Clock, Grid3x3, Hourglass, Info, Layers, Minus, MoveDownRight, MoveUpRight,
  PauseCircle, Repeat, TrendingDown, TrendingUp, Waves, Wind, AudioLines, LineChart as LineChartIcon,
} from 'lucide-react'
import type { Monitoring24hSession } from '@/lib/monitoring-types'
import {
  MON, STATE_COLOR, balanceColor, balanceLabelFor, cap, clockStrength, clockStrengthText, dayPart, duration, effectiveProfile, fmtNum, fragmentationLabel,
  fragmentationText, hourFraction, hm, level, pagesFor, periodLabel, profileFlags, qualityColor, qualityLabel, reserveLabel, sourceLabel, stateLabel,
} from '@/lib/monitoring-format'
import { indexText, monT, type IndexId, type Lang } from '@/lib/monitoring-strings'
import { ArtifactChip, Chip, ProfileChip, QualityChip, SectionTitle, TypeChip } from './MonitoringChips'
import { MonitoringTimeline, StateLegend } from './MonitoringTimeline'
import { MonitoringGauge } from './MonitoringGauge'
import { MonitoringIndexCard } from './MonitoringIndexCard'
import { MonitoringNightChart } from './MonitoringNightChart'
import { MonitoringScoreBars } from './MonitoringScoreBars'
import { MonitoringTrendChart } from './MonitoringTrendChart'
import { MonitoringHourMap } from './MonitoringHourMap'
import { MonitoringEvents } from './MonitoringEvents'
import { CosinorChart, DescentChart, MseChart, PrsaChart } from './MonitoringRhythmCharts'
import { MonitoringParamsTable, Kv } from './MonitoringParamsTable'
import { MonitoringActions } from './MonitoringActions'

// Dettaglio di un monitoraggio 24h: le sezioni rispecchiano le pagine
// dell'app (Riepilogo, Notte, Andamento, Eventi, Mappa delle ore, Ritmo e
// complessità, Parametri) e compaiono SOLO se il profilo le prevede. Nessun
// numero è calcolato qui: tutto viene da summary / night / windows / events
// scritti dall'app. Testi delle card: MonitoringIndexTexts (identici).
//
// I motivi di indisponibilità (`advanced.unavailable[id]`) sono testo scritto
// dall'app nella riga: si mostrano così come sono.

type Props = {
  session: Monitoring24hSession
  readOnly?: boolean
  baseQuery?: string
  /** Nome del professionista titolare (vista superadmin). */
  clientHref?: string
}

const AIR = Wind

/** Traduttori del dettaglio: `t` (namespace monitoring), `m` (stringhe dell'app), `n` (numeri). */
function useMon() {
  const t = useTranslations('monitoring')
  const locale = useLocale() as Lang
  const m = (k: string) => monT(k, locale)
  const n = (v: number | null | undefined, d: number) => fmtNum(v, d, locale)
  return { t, locale, m, n }
}

export function Monitoring24hDetail({ session: s, readOnly = false, clientHref }: Props) {
  const { t, locale, m } = useMon()
  const tz = s.tz_offset_minutes
  const pro = true // il sito è l'area professionisti
  const { profile, estimated } = effectiveProfile(s)
  const flags = profileFlags(profile)
  const pages = pagesFor(profile, pro)
  const sum = s.summary
  const a = sum?.advanced ?? null
  const night = s.night
  const cov = s.valid_coverage_percentage
  const why = (id: IndexId) => a?.unavailable?.[id] ?? null
  const clientName = s.client_name ?? t('client')

  return (
    <div className="space-y-6">
      {/* ── 3.1 Intestazione ─────────────────────────────────────────────── */}
      <header className="card p-5 sm:p-6" style={{ borderTop: `4px solid ${MON.accent}` }}>
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <TypeChip type={s.monitoring_type} />
              <ProfileChip profile={profile} estimated={estimated} />
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl text-anthracite break-words">
              {clientHref && s.client_id ? <Link href={clientHref} className="hover:underline">{clientName}</Link> : clientName}
            </h1>
            <p className="mt-1 text-sm text-anthracite-lighter">
              {periodLabel(s.start_time, s.end_time, tz, locale)} · {duration(s.duration_minutes)}
            </p>
            <p className="mt-0.5 text-xs text-anthracite-lighter">
              {s.device_name ?? '—'} · {sourceLabel(s.source, t)}{s.rr_count != null ? ` · ${t('beats', { count: s.rr_count })}` : ''} · {t('algorithm', { version: s.algorithm_version || '—' })}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <QualityChip quality={s.signal_quality} coverage={cov} />
              <ArtifactChip pct={s.artifact_percentage} />
              {s.professional_name && <Chip label={s.professional_name} color={MON.textSecondary} />}
            </div>
          </div>
          <MonitoringActions session={s} readOnly={readOnly} />
        </div>
        {estimated && (
          <p className="mt-3 text-[11px] text-anthracite-lighter">{t('detail24.estimatedProfileNote')}</p>
        )}
      </header>

      <Notices s={s} />

      {/* ── 3.2 Timeline e Riserva ───────────────────────────────────────── */}
      <section className="card p-5">
        <SectionTitle sub={a?.reserve ? m('reserve_hint') : undefined}>{t('detail24.timelineReserve')}</SectionTitle>
        <MonitoringTimeline windows={s.windows} start={s.start_time} end={s.end_time} tz={tz} events={s.events} night={night} reserve={a?.reserve ?? null} height={40} />
        <div className="mt-2"><StateLegend compact /></div>
        {sum?.summary_phrase && (
          <div className="mt-4 flex items-start gap-3 p-4 rounded-2xl" style={{ backgroundColor: MON.accentLight }}>
            <Info size={18} className="flex-shrink-0 mt-0.5" style={{ color: MON.accentDark }} />
            <p className="text-[13px] leading-relaxed text-anthracite">{sum.summary_phrase}</p>
          </div>
        )}
      </section>

      {/* Gauge + KPI del profilo */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <MonitoringGauge
          value={sum?.stress_recovery_balance}
          title={m('balance')}
          label={sum ? balanceLabelFor(sum.stress_recovery_balance, sum.stress_recovery_label, locale, t) : '—'}
          colorFor={balanceColor}
          leftLabel={stateLabel('stress', locale)}
          rightLabel={stateLabel('recovery', locale)}
          centerMark
        />
        {flags.hasNightPages && (
          <MonitoringGauge
            value={sum?.night_recovery_quality}
            title={m('night_quality')}
            label={sum?.night_recovery_quality == null ? m('night_na_short') : qualityLabel(sum.night_recovery_quality, t)}
            colorFor={qualityColor}
            leftLabel="0"
            rightLabel="100"
          />
        )}
      </div>
      <KpiRow s={s} />

      {/* ── 3.3 I numeri del profilo ─────────────────────────────────────── */}
      <section>
        <SectionTitle>{t('detail24.whatSays')}</SectionTitle>
        {!a ? (
          <p className="text-sm text-anthracite-lighter">{t('detail24.indicesUnavailable')}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <ReserveCard s={s} />
            {flags.hasWakePages && <PausesCard s={s} />}
            {flags.hasWakePages && <StretchCard s={s} />}
            <PeakCard s={s} />
            <ReturnCard s={s} />
            <DcCard s={s} />
            <AcCard s={s} />
            {profile !== 'breve' && <FragmentationCard s={s} pro={pro} />}
            {profile !== 'breve' && <RespirationCard s={s} where="day" />}
          </div>
        )}
        {sum && (
          <div className="card p-4 mt-3">
            <div className="text-[13px] font-bold text-anthracite mb-2">{t('detail24.breakdown')}</div>
            <PctRow label={stateLabel('recovery', locale)} pct={sum.percent_recovery} color={STATE_COLOR.recovery} />
            <PctRow label={stateLabel('stress', locale)} pct={sum.percent_stress} color={STATE_COLOR.stress} />
            <PctRow label={stateLabel('activity', locale)} pct={sum.percent_activity} color={STATE_COLOR.activity} />
            <PctRow label={stateLabel('neutral', locale)} pct={sum.percent_neutral} color={STATE_COLOR.neutral} />
            <PctRow label={stateLabel('invalid', locale)} pct={sum.percent_invalid} color={MON.borderMedium} />
          </div>
        )}
        <p className="mt-3 text-[10.5px] text-anthracite-lighter leading-relaxed">{t('detail24.disclaimer')}</p>
      </section>

      {/* ── 3.4 La notte ─────────────────────────────────────────────────── */}
      {pages.includes('notte') && <NightSection s={s} />}

      {/* ── 3.5 Andamento ────────────────────────────────────────────────── */}
      <section className="card p-5">
        <SectionTitle>{t('detail24.trend')}</SectionTitle>
        <MonitoringTrendChart windows={s.windows} start={s.start_time} end={s.end_time} tz={tz} events={s.events} night={night} pro={pro} />
      </section>

      {/* ── 3.6 Mappa delle ore ──────────────────────────────────────────── */}
      {pages.includes('mappa_ore') && (
        <section className="card p-5">
          <SectionTitle>{t('detail24.hourMap')}</SectionTitle>
          <MonitoringIndexCard
            text={indexText('hour_map', locale)}
            icon={Grid3x3}
            pro={pro}
            unavailableReason={!a?.hourly?.length ? (why('hour_map') ?? t('hourMap.noValidHours')) : null}
            className="!p-0 !border-0 !shadow-none"
          >
            {a?.hourly?.length ? <MonitoringHourMap hours={a.hourly} tz={tz} pro={pro} /> : null}
          </MonitoringIndexCard>
        </section>
      )}

      {/* ── 3.7 Eventi ───────────────────────────────────────────────────── */}
      <section className="card p-5">
        <SectionTitle>{t('detail24.events')}</SectionTitle>
        <MonitoringEvents sessionId={s.id} events={s.events} tz={tz} start={s.start_time} end={s.end_time} night={night} readOnly={readOnly} pendingRecalc={s.events_modified_on_web} pro={pro} />
      </section>

      {/* ── 3.8 Ritmo e complessità ──────────────────────────────────────── */}
      {pages.includes('ritmo') && <RhythmSection s={s} />}

      {/* ── 3.9 Parametri ────────────────────────────────────────────────── */}
      {pages.includes('parametri') && (
        <section className="card p-5">
          <SectionTitle>{t('detail24.params')}</SectionTitle>
          <MonitoringParamsTable session={s} />
        </section>
      )}
    </div>
  )
}

// ── Avvisi (E5: banner di copertura informativo, non allarmante) ─────────────

function Notices({ s }: { s: Monitoring24hSession }) {
  const { t, locale } = useMon()
  const cov = s.valid_coverage_percentage
  const a = s.summary?.advanced
  const out: Array<{ color: string; text: string }> = []
  if (cov != null && cov < 80) {
    const gap = s.summary?.gap_minutes ?? 0
    const short = s.summary?.clock_shortfall_minutes ?? 0
    const missing = 100 - Math.round(cov)
    const names: string[] = []
    // I motivi sono scritti dall'app in italiano: qui si riconoscono quelli legati alla copertura.
    for (const [id, reason] of Object.entries(a?.unavailable ?? {})) {
      if (reason.includes('non rilevata') || reason.includes('non valutabile') || reason.includes('servono')) names.push(indexText(id as IndexId, locale)?.name ?? id)
    }
    const unrel = (a?.unreliable ?? []).map((id) => indexText(id as IndexId, locale)?.name ?? id)
    let text = t('detail24.notices.missing', { missing })
    if (gap > 0 || short > 0) text += t('detail24.notices.gap', { gap: duration(gap + short) })
    text += '. '
    if (names.length) text += t('detail24.notices.notComputable', { list: Array.from(new Set(names)).slice(0, 5).join(', ') }) + ' '
    if (unrel.length) text += t('detail24.notices.readWithCare', { list: Array.from(new Set(unrel)).slice(0, 5).join(', ') })
    out.push({ color: cov < 60 ? MON.warning : MON.info, text })
  }
  if (s.duration_minutes < 60) out.push({ color: MON.warning, text: t('detail24.notices.short') })
  const b = s.baseline_snapshot
  if (b) {
    out.push({
      color: b.applied ? MON.accent : MON.textSecondary,
      text: b.applied ? t('detail24.notices.baselineApplied', { source: b.source, n: b.n }) : t('detail24.notices.baselineNotApplied', { reason: b.reason ?? '—' }),
    })
  }
  if (out.length === 0) return null
  return (
    <div className="space-y-2">
      {out.map((n, i) => (
        <div key={i} className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl border text-[12px] text-anthracite leading-relaxed" style={{ borderColor: `${n.color}59`, backgroundColor: `${n.color}17` }}>
          <Info size={15} className="mt-0.5 flex-shrink-0" style={{ color: n.color }} />
          <span>{n.text}</span>
        </div>
      ))}
    </div>
  )
}

// ── KPI del profilo (tre numeri) ─────────────────────────────────────────────

function KpiRow({ s }: { s: Monitoring24hSession }) {
  const { t, m } = useMon()
  const sum = s.summary
  const night = s.night
  const a = sum?.advanced
  const tz = s.tz_offset_minutes
  const { profile } = effectiveProfile(s)
  const f = profileFlags(profile)
  const items: Array<{ label: string; value: string; unit?: string; color: string }> = [
    { label: m('kpi_recovery'), value: sum ? `${Math.round(sum.percent_recovery)}` : '—', unit: '%', color: STATE_COLOR.recovery },
  ]
  if (f.hasNightPages && !f.hasWakePages) {
    items.push(
      { label: night?.min_hr_time ? t('detail24.kpi.hrMinNightAt', { time: hm(night.min_hr_time, tz) }) : m('kpi_hr_min'), value: night?.min_hr_night == null ? '—' : `${Math.round(night.min_hr_night)}`, unit: 'bpm', color: MON.accentDark },
      { label: t('detail24.kpi.nightDip'), value: night?.hr_dip_percentage == null ? '—' : `−${Math.round(night.hr_dip_percentage)}`, unit: '%', color: MON.accent },
    )
  } else if (f.hasWakePages) {
    const p = a?.pauses
    const rt = a?.return_times
    items.push(
      { label: m('kpi_pauses'), value: p ? `${p.count}` : '—', unit: p ? `· ${p.total_min} min` : '', color: MON.accentDark },
      { label: m('kpi_return'), value: rt?.median == null ? '—' : `${Math.round(rt.median)}`, unit: 'min', color: MON.accent },
    )
  } else {
    const rt = a?.return_times
    items.push(
      { label: sum?.peak_stress_time ? t('detail24.kpi.peakAt', { part: dayPart(sum.peak_stress_time, tz, night, t) }) : m('kpi_peak'), value: sum?.peak_stress_time ? hm(sum.peak_stress_time, tz) : '—', color: STATE_COLOR.stress },
      { label: m('kpi_return'), value: rt?.median == null ? '—' : `${Math.round(rt.median)}`, unit: 'min', color: MON.accent },
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map((k) => (
        <div key={k.label} className="card p-4 min-w-0">
          <div className="text-[11px] font-medium text-anthracite-lighter">{k.label}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-serif text-2xl" style={{ color: k.color }}>{k.value}</span>
            {k.unit && <span className="text-xs text-anthracite-lighter">{k.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Card degli indici (Parte D) ──────────────────────────────────────────────

function ReserveCard({ s }: { s: Monitoring24hSession }) {
  const { t, locale } = useMon()
  const a = s.summary?.advanced
  const r = a?.reserve
  const tz = s.tz_offset_minutes
  const delta = r ? (r.end ?? 0) - (r.start ?? 0) : 0
  const parts: string[] = []
  if (r) {
    parts.push(r.min_t ? t('detail24.cards.lowestAt', { time: hm(r.min_t, tz), part: dayPart(r.min_t, tz, s.night, t) }) : t('detail24.cards.lowest'))
    if (r.max_t) parts.push(t('detail24.cards.highestAt', { time: hm(r.max_t, tz) }))
  }
  return (
    <MonitoringIndexCard
      text={indexText('reserve', locale)}
      icon={BatteryCharging}
      unavailableReason={a?.unavailable?.reserve ?? null}
      value={r ? reserveLabel(delta, locale) : null}
      level={r ? level.reserve(delta) : null}
      detail={r ? parts.join(' · ') : null}
    />
  )
}

function PausesCard({ s }: { s: Monitoring24hSession }) {
  const { t, locale, m } = useMon()
  const a = s.summary?.advanced
  const p = a?.pauses
  const tz = s.tz_offset_minutes
  // Le stringhe dell'app portano anche il numero: qui il numero è il valore grande, resta l'unità.
  const unit = p
    ? (p.count === 1 ? m('pause_one').replace('1 ', '').replace('{min}', `${p.total_min}`) : m('pauses_detail').replace('{n}', '').replace('{min}', `${p.total_min}`).trim())
    : null
  return (
    <MonitoringIndexCard
      text={indexText('recovery_pauses', locale)}
      icon={PauseCircle}
      unavailableReason={a?.unavailable?.recovery_pauses ?? null}
      unreliable={a?.unreliable?.includes('recovery_pauses')}
      value={p ? `${p.count}` : null}
      unit={unit}
      level={p ? level.pauses(p.count, p.total_min) : null}
      detail={p && p.items.length ? p.items.slice(0, 4).map((b) => t('detail24.cards.pauseItem', { time: hm(b.start, tz), min: b.minutes })).join(' · ') + (p.items.length > 4 ? ' · …' : '') : null}
    />
  )
}

function StretchCard({ s }: { s: Monitoring24hSession }) {
  const { locale, m } = useMon()
  const a = s.summary?.advanced
  const ls = a?.longest_stretch
  const tz = s.tz_offset_minutes
  return (
    <MonitoringIndexCard
      text={indexText('longest_stretch', locale)}
      icon={Minus}
      unavailableReason={a?.unavailable?.longest_stretch ?? null}
      unreliable={a?.unreliable?.includes('longest_stretch')}
      value={ls ? duration(ls.minutes) : null}
      level={ls ? level.stretch(ls.minutes) : null}
      detail={ls ? m('stretch_detail').replace('{from}', hm(ls.start, tz)).replace('{to}', hm(ls.end, tz)) : null}
    />
  )
}

function PeakCard({ s }: { s: Monitoring24hSession }) {
  const { t, locale } = useMon()
  const peak = s.summary?.peak_stress_time ?? null
  const tz = s.tz_offset_minutes
  return (
    <MonitoringIndexCard
      text={indexText('peak', locale)}
      icon={Bolt}
      unavailableReason={peak ? null : t('detail24.cards.peakUnavailable')}
      value={peak ? hm(peak, tz) : null}
      detail={peak ? dayPart(peak, tz, s.night, t) : null}
    />
  )
}

function ReturnCard({ s }: { s: Monitoring24hSession }) {
  const { t, locale, m } = useMon()
  const a = s.summary?.advanced
  const rt = a?.return_times
  const tz = s.tz_offset_minutes
  let detail: string | null = null
  if (rt) {
    detail = t('detail24.cards.longestCase', { worst: rt.worst ?? '—' })
    if (rt.worst_at) detail += ` ${t('detail24.cards.afterAt', { time: hm(rt.worst_at, tz), part: dayPart(rt.worst_at, tz, s.night, t) })}`
    detail += ` · ${t('detail24.cards.pressureMoments', { count: rt.items.length })}`
  }
  return (
    <MonitoringIndexCard
      text={indexText('return_time', locale)}
      icon={Repeat}
      unavailableReason={a?.unavailable?.return_time ?? null}
      unreliable={a?.unreliable?.includes('return_time')}
      value={rt?.median == null ? null : `${Math.round(rt.median)}`}
      unit={m('unit_min_median')}
      level={rt?.median == null ? null : level.returnTime(rt.median)}
      detail={detail}
    />
  )
}

function DcCard({ s }: { s: Monitoring24hSession }) {
  const { t, locale, n } = useMon()
  const a = s.summary?.advanced
  const pr = a?.prsa
  return (
    <MonitoringIndexCard
      text={indexText('dc', locale)}
      icon={MoveDownRight}
      unavailableReason={a?.unavailable?.dc ?? null}
      value={pr?.dc == null ? null : n(pr.dc, 1)}
      unit="ms"
      level={pr?.dc == null ? null : level.dc(pr.dc)}
      detail={pr ? t('detail24.cards.dcDetail', { n: pr.n_dec, beats: pr.beats }) : null}
    />
  )
}

function AcCard({ s }: { s: Monitoring24hSession }) {
  const { t, locale, n } = useMon()
  const a = s.summary?.advanced
  const pr = a?.prsa
  return (
    <MonitoringIndexCard
      text={indexText('ac', locale)}
      icon={MoveUpRight}
      unavailableReason={a?.unavailable?.ac ?? null}
      value={pr?.ac == null ? null : n(pr.ac, 1)}
      unit="ms"
      level={pr?.ac == null ? null : level.ac(pr.ac)}
      detail={pr ? t('detail24.cards.acDetail', { n: pr.n_acc }) : null}
    />
  )
}

function FragmentationCard({ s, pro, full = false }: { s: Monitoring24hSession; pro: boolean; full?: boolean }) {
  const { t, locale, n } = useMon()
  const a = s.summary?.advanced
  const f = a?.fragmentation
  const id = f?.pip == null ? null : fragmentationLabel(f.pip)
  const label = id ? fragmentationText(id, locale) : null
  return (
    <MonitoringIndexCard
      text={indexText('fragmentation', locale)}
      icon={Activity}
      unavailableReason={a?.unavailable?.fragmentation ?? null}
      unreliable={a?.unreliable?.includes('fragmentation')}
      value={label ? (full ? label : cap(label)) : null}
      level={id ? level.fragmentation(id) : null}
      // Al cliente solo l'etichetta; i quattro numeri stanno nel popover / al professionista.
      detail={f && pro ? `PIP ${n(f.pip, 1)}% · IALS ${n(f.ials, full ? 3 : 2)} · PSS ${n(f.pss, 1)}% · PAS ${n(f.pas, 1)}%${full ? ` · ${t('beats', { count: f.beats })}` : ''}` : null}
    />
  )
}

function RespirationCard({ s, where }: { s: Monitoring24hSession; where: 'day' | 'night' }) {
  const { t, locale, m } = useMon()
  const a = s.summary?.advanced
  const resp = a?.respiration
  if (where === 'night') {
    return (
      <MonitoringIndexCard
        text={indexText('respiration', locale)}
        icon={AIR}
        unavailableReason={resp?.night == null ? (a?.unavailable?.respiration ?? t('detail24.cards.respNightUnavailable')) : null}
        value={resp?.night == null ? null : `${Math.round(resp.night)}`}
        unit={m('unit_bpm_night')}
        detail={resp ? `${resp.day == null ? '' : `${t('detail24.cards.respDay', { v: Math.round(resp.day) })} · `}${m('resp_note')}` : null}
      />
    )
  }
  const dayVal = resp?.day ?? resp?.all ?? null
  return (
    <MonitoringIndexCard
      text={indexText('respiration', locale)}
      icon={AIR}
      unavailableReason={a?.unavailable?.respiration ?? null}
      value={dayVal == null ? null : `${Math.round(dayVal)}`}
      unit={resp?.day != null ? m('unit_bpm_day') : t('detail24.cards.breathsPerMin')}
      detail={resp ? `${resp.night == null ? '' : `${t('detail24.cards.respNight', { v: Math.round(resp.night) })} · `}${m('resp_note')}` : null}
    />
  )
}

function PctRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span className="w-24 text-[11px] text-anthracite-lighter truncate" title={label}>{label}</span>
      <div className="flex-1 h-2 rounded bg-surface-border/60 overflow-hidden">
        <div className="h-full rounded" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }} />
      </div>
      <span className="w-10 text-right text-[11px] font-bold text-anthracite tabular-nums">{Math.round(pct)}%</span>
    </div>
  )
}

// ── La notte (3.4) ───────────────────────────────────────────────────────────

function nightTrendText(trend: number | null | undefined, m: (k: string) => string): string {
  return trend == null ? cap(m('trend_na')) : trend > 3 ? cap(m('trend_up')) : trend < -3 ? cap(m('trend_down')) : cap(m('trend_flat'))
}

function NightSection({ s }: { s: Monitoring24hSession }) {
  const { t, locale, m, n } = useMon()
  const night = s.night
  const a = s.summary?.advanced
  const tz = s.tz_offset_minutes
  const why = a?.unavailable?.night_recovery ?? null
  if (!night) {
    return (
      <section className="card p-5">
        <SectionTitle>{t('detail24.night')}</SectionTitle>
        <div className="flex items-start gap-3">
          <Bed size={22} style={{ color: MON.accent }} />
          <div>
            <div className="font-serif text-base text-anthracite">{t('night.notComputable')}</div>
            <p className="text-sm text-anthracite-lighter mt-1 leading-relaxed">
              {why ?? t('night.noRestPeriod')} {t('night.noRestHint')}
            </p>
          </div>
        </div>
      </section>
    )
  }
  const trend = night.recovery_trend
  const trendText = nightTrendText(trend, m)
  const trendColor = trend == null ? MON.textMuted : trend > 3 ? STATE_COLOR.recovery : trend < -3 ? STATE_COLOR.stress : MON.accent
  const TrendIcon = trend == null ? Minus : trend > 3 ? TrendingUp : trend < -3 ? TrendingDown : Minus
  const ttm = a?.time_to_min
  const u = a?.ultradian
  const q = s.summary?.night_recovery_quality ?? null
  const { profile } = effectiveProfile(s)
  const episodes = night.awakenings_estimate ?? 0

  return (
    <section className="card p-5 space-y-4">
      <SectionTitle>{t('detail24.night')}</SectionTitle>
      <div className="flex items-center gap-3">
        <Bed size={26} style={{ color: MON.accent }} />
        <div className="min-w-0">
          <div className="text-base font-extrabold text-anthracite">{hm(night.night_start, tz)} → {hm(night.night_end, tz)} · {duration(night.duration_minutes)}</div>
          <div className="text-[11px] text-anthracite-lighter">{night.detected ? t('night.detected') : t('night.fromEvents')}</div>
        </div>
      </div>
      <div>
        <div className="text-[13px] font-bold text-anthracite mb-2">{m('night_chart')}</div>
        <MonitoringNightChart night={night} tz={tz} />
        <div className="mt-1"><StateLegend compact /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Mini label={night.min_hr_time ? t('night.hrMinAt', { time: hm(night.min_hr_time, tz) }) : t('night.hrMin')} value={night.min_hr_night == null ? '—' : `${Math.round(night.min_hr_night)}`} unit="bpm" color={MON.accentDark} />
        <Mini label={m('hr_mean_night')} value={night.mean_hr_night == null ? '—' : `${Math.round(night.mean_hr_night)}`} unit="bpm" color={MON.textPrimary} />
        <Mini label={t('night.recoveryInNight')} value={night.recovery_percentage_night == null ? '—' : `${Math.round(night.recovery_percentage_night)}`} unit="%" color={STATE_COLOR.recovery} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <MonitoringIndexCard
          text={indexText('night_recovery', locale)}
          icon={Bed}
          unavailableReason={q == null ? (why ?? t('night.scoresUnavailable')) : null}
          value={q == null ? null : `${Math.round(q)}`}
          unit="/ 100"
          level={q == null ? null : level.nightQuality(q)}
          detail={trendText}
        />
        <MonitoringIndexCard
          text={indexText('hr_dip', locale)}
          icon={TrendingDown}
          unavailableReason={night.hr_dip_percentage == null ? (a?.unavailable?.hr_dip ?? t('night.dayRefMissing')) : null}
          value={night.hr_dip_percentage == null ? null : `−${Math.round(night.hr_dip_percentage)}`}
          unit="%"
          level={night.hr_dip_percentage == null ? null : level.hrDip(night.hr_dip_percentage)}
        />
        <MonitoringIndexCard
          text={indexText('time_to_min', locale)}
          icon={Hourglass}
          unavailableReason={a?.unavailable?.time_to_min ?? (ttm ? null : (a ? null : t('night.legacyAnalysis')))}
          value={ttm ? duration(ttm.min) : null}
          detail={ttm ? m('time_to_min_detail').replace('{hr}', ttm.hr == null ? '—' : `${Math.round(ttm.hr)}`).replace('{at}', hm(ttm.at, tz)) : null}
        >
          {ttm && ttm.descent.length >= 2 ? <DescentChart ttm={ttm} /> : null}
        </MonitoringIndexCard>
        <MonitoringIndexCard
          text={indexText('rest_waves', locale)}
          icon={Waves}
          unavailableReason={a?.unavailable?.rest_waves ?? (u ? null : (a ? null : t('night.legacyAnalysis')))}
          unreliable={a?.unreliable?.includes('rest_waves')}
          value={u ? (u.present ? m('waves_present') : m('waves_faint')) : null}
          level={u ? level.waves(u.present) : null}
          detail={u && u.period != null ? t('night.wavesDetail', { p: u.period, c: n(u.cycles, 1), s: n(u.strength, 2) }) : null}
        />
        {profile !== 'breve' && <RespirationCard s={s} where="night" />}
        <div className="card p-4 flex items-start gap-3">
          <TrendIcon size={28} style={{ color: trendColor }} className="flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-anthracite">{m('recovery_trend')}</div>
            <div className="text-xs font-bold" style={{ color: trendColor }}>{trendText}</div>
            <div className="mt-1 text-[11px] text-anthracite-lighter leading-relaxed">
              {t('night.trendDetail', { first3h: m('first_3h'), last3h: m('last_3h'), first: night.recovery_first_3h == null ? '—' : Math.round(night.recovery_first_3h), last: night.recovery_last_3h == null ? '—' : Math.round(night.recovery_last_3h) })}
              {' · '}{t('night.episodes', { count: episodes })}
            </div>
          </div>
        </div>
      </div>
      {s.scores_night && (
        <div className="card p-4"><MonitoringScoreBars scores={s.scores_night} title={t('night.scores')} /></div>
      )}
      {s.scores_morning && (
        <div className="card p-4"><MonitoringScoreBars scores={s.scores_morning} title={m('morning_scores')} /></div>
      )}
      <div className="card p-4">
        <div className="text-[13px] font-bold text-anthracite mb-1">{t('night.paramsTitle')}</div>
        <Kv k={t('night.rmssdMean')} v={`${n(night.rmssd_mean_night, 1)} ms`} />
        <Kv k="ln RMSSD" v={n(night.ln_rmssd_night, 2)} />
        <Kv k={t('night.sdnnMean')} v={`${n(night.sdnn_night, 1)} ms`} />
        <Kv k={t('night.hoursAnalyzed')} v={`${night.hourly.length}`} />
      </div>
    </section>
  )
}

function Mini({ label, value, unit, color }: { label: string; value: string; unit?: string; color: string }) {
  return (
    <div className="card p-3.5 min-w-0">
      <div className="text-[11px] text-anthracite-lighter">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="font-serif text-2xl" style={{ color }}>{value}</span>
        {unit && <span className="text-xs text-anthracite-lighter">{unit}</span>}
      </div>
    </div>
  )
}

// ── Ritmo e complessità (3.8, solo professionista) ───────────────────────────

function RhythmSection({ s }: { s: Monitoring24hSession }) {
  const { t, locale, m, n } = useMon()
  const a = s.summary?.advanced
  const tz = s.tz_offset_minutes
  const hours = a?.hourly ?? []
  const cos = a?.cosinor_hr
  const cosLn = a?.cosinor_ln_rmssd
  const pr = a?.prsa
  const mse = a?.mse
  const sf = s.summary?.series?.full
  const amp = cos?.amp ?? null
  const clockDetail = cos && amp != null
    ? t('rhythm.clockDetail', {
      amp: n(amp, 1),
      mesor: cos.mesor == null ? '—' : Math.round(cos.mesor),
      min: cos.bathy == null ? '—' : hourFraction(cos.bathy),
      peak: cos.acro == null ? '—' : hourFraction(cos.acro),
      r2: n(cos.r2, 2),
      hours: cos.hours,
    }) + (cos.indicative ? ` · ${m('clock_indicative')}` : '') + (cosLn && cosLn.amp != null ? `\n${t('rhythm.clockLn', { amp: n(cosLn.amp, 2), peak: cosLn.acro == null ? '—' : hourFraction(cosLn.acro) })}` : '')
    : null
  return (
    <section className="card p-5">
      <SectionTitle sub={t('detail24.rhythmSub')}>{t('detail24.rhythm')}</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="lg:col-span-2">
          <MonitoringIndexCard
            text={indexText('internal_clock', locale)}
            icon={Clock}
            unavailableReason={cos == null || amp == null ? (a?.unavailable?.internal_clock ?? t('rhythm.clockNeeds18h')) : null}
            unreliable={a?.unreliable?.includes('internal_clock')}
            value={amp == null ? null : clockStrengthText(clockStrength(amp), t)}
            level={amp == null ? null : level.clock(amp)}
            detail={clockDetail}
          >
            {cos && hours.length ? <CosinorChart hours={hours} fit={cos} tz={tz} pick={(h) => h.hr} /> : null}
          </MonitoringIndexCard>
        </div>
        <MonitoringIndexCard
          text={indexText('dc', locale)}
          icon={MoveDownRight}
          unavailableReason={a?.unavailable?.dc ?? null}
          value={pr?.dc == null ? null : n(pr.dc, 2)}
          unit="ms"
          level={pr?.dc == null ? null : level.dc(pr.dc)}
          detail={pr ? `AC ${n(pr.ac, 2)} ms · ${pr.n_dec} / ${pr.n_acc} ${m('anchors')} · ${pr.beats} ${m('beats_used')} · ${m('prsa_curves')}` : null}
        >
          {pr && pr.curve_dec.length ? <PrsaChart prsa={pr} /> : null}
        </MonitoringIndexCard>
        <FragmentationCard s={s} pro full />
        <MonitoringIndexCard
          text={indexText('mse', locale)}
          icon={Layers}
          unavailableReason={a?.unavailable?.mse ?? null}
          unreliable={a?.unreliable?.includes('mse')}
          value={mse?.ci == null ? null : n(mse.ci, 1)}
          unit={t('rhythm.ciUnit')}
          detail={mse ? t('rhythm.mseDetail', { s1: n(mse.e[0], 2), s10: n(mse.e.length > 9 ? mse.e[9] : null, 2), chunks: mse.chunks, beats: mse.beats }) : null}
        >
          {mse ? <MseChart mse={mse} /> : null}
        </MonitoringIndexCard>
        <MonitoringIndexCard
          text={indexText('dfa_alpha2', locale)}
          icon={LineChartIcon}
          unavailableReason={a?.unavailable?.dfa_alpha2 ?? (a?.dfa_alpha2 == null ? '—' : null)}
          unreliable={a?.unreliable?.includes('dfa_alpha2')}
          value={a?.dfa_alpha2 == null ? null : n(a.dfa_alpha2, 2)}
          unit="α2"
          detail={sf?.dfa_alpha1 == null ? null : t('rhythm.alpha1Detail', { v: n(sf.dfa_alpha1, 2) })}
        />
        <MonitoringIndexCard
          text={indexText('ulf_vlf', locale)}
          icon={AudioLines}
          unavailableReason={sf?.vlf == null ? t('rhythm.noTract') : null}
          unreliable={a?.unreliable?.includes('ulf_vlf')}
          value={sf?.vlf == null ? null : `${Math.round(sf.vlf)}`}
          unit="ms² VLF"
          detail={sf ? t('rhythm.bandsDetail', {
            ulf: sf.ulf == null ? t('rhythm.ulfNa') : `${Math.round(sf.ulf)} ms²`,
            lf: sf.lf == null ? '—' : Math.round(sf.lf),
            hf: sf.hf == null ? '—' : Math.round(sf.hf),
            count: sf.tracts ?? 0,
            duration: duration(sf.tract_minutes ?? 0),
          }) : null}
        />
      </div>
    </section>
  )
}
