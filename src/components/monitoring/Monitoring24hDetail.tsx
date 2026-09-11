'use client'

import Link from 'next/link'
import {
  Activity, BatteryCharging, Bed, Bolt, Clock, Grid3x3, Hourglass, Info, Layers, Minus, MoveDownRight, MoveUpRight,
  PauseCircle, Repeat, TrendingDown, TrendingUp, Waves, Wind, AudioLines, LineChart as LineChartIcon,
} from 'lucide-react'
import type { Monitoring24hSession } from '@/lib/monitoring-types'
import {
  MON, STATE_COLOR, balanceColor, balanceLabel, clockStrength, dayPart, duration, effectiveProfile, fragmentationLabel,
  hourFraction, hm, level, pagesFor, periodLabel, profileFlags, qualityColor, qualityLabel, reserveLabel, sourceLabel,
} from '@/lib/monitoring-format'
import { indexText, type IndexId } from '@/lib/monitoring-strings'
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

type Props = {
  session: Monitoring24hSession
  readOnly?: boolean
  baseQuery?: string
  /** Nome del professionista titolare (vista superadmin). */
  clientHref?: string
}

const AIR = Wind

export function Monitoring24hDetail({ session: s, readOnly = false, baseQuery = '', clientHref }: Props) {
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
            <h1 className="font-serif text-2xl sm:text-3xl text-anthracite">
              {clientHref && s.client_id ? <Link href={clientHref} className="hover:underline">{s.client_name ?? 'Cliente'}</Link> : (s.client_name ?? 'Cliente')}
            </h1>
            <p className="mt-1 text-sm text-anthracite-lighter">
              {periodLabel(s.start_time, s.end_time, tz)} · {duration(s.duration_minutes)}
            </p>
            <p className="mt-0.5 text-xs text-anthracite-lighter">
              {s.device_name ?? '—'} · {sourceLabel(s.source)}{s.rr_count != null ? ` · ${s.rr_count} battiti` : ''} · algoritmo {s.algorithm_version || '—'}
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
          <p className="mt-3 text-[11px] text-anthracite-lighter">
            * Profilo stimato: questa registrazione è stata analizzata con una versione precedente dell&apos;app, che non salvava il profilo. Derivato da durata e notte con la stessa regola dell&apos;app.
          </p>
        )}
      </header>

      <Notices s={s} />

      {/* ── 3.2 Timeline e Riserva ───────────────────────────────────────── */}
      <section className="card p-5">
        <SectionTitle sub={a?.reserve ? "La curva sopra la barra è la Riserva: sale nel recupero, scende nell'attivazione." : undefined}>Timeline e Riserva</SectionTitle>
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
      <div className={`grid gap-4 ${flags.hasNightPages ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <MonitoringGauge
          value={sum?.stress_recovery_balance}
          title="Bilancio della giornata"
          label={sum ? (sum.stress_recovery_label || balanceLabel(sum.stress_recovery_balance)) : '—'}
          colorFor={balanceColor}
          leftLabel="Attivazione"
          rightLabel="Recupero"
          centerMark
        />
        {flags.hasNightPages && (
          <MonitoringGauge
            value={sum?.night_recovery_quality}
            title="Recupero notturno"
            label={sum?.night_recovery_quality == null ? 'Non calcolabile' : qualityLabel(sum.night_recovery_quality)}
            colorFor={qualityColor}
            leftLabel="0"
            rightLabel="100"
          />
        )}
      </div>
      <KpiRow s={s} />

      {/* ── 3.3 I numeri del profilo ─────────────────────────────────────── */}
      <section>
        <SectionTitle>Cosa dice la registrazione</SectionTitle>
        {!a ? (
          <p className="text-sm text-anthracite-lighter">Indici non disponibili per questa registrazione (analisi con versione precedente: ricalcola dagli eventi).</p>
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
            <div className="text-[13px] font-bold text-anthracite mb-2">Ripartizione del periodo</div>
            <PctRow label="Recupero" pct={sum.percent_recovery} color={STATE_COLOR.recovery} />
            <PctRow label="Attivazione" pct={sum.percent_stress} color={STATE_COLOR.stress} />
            <PctRow label="Attività" pct={sum.percent_activity} color={STATE_COLOR.activity} />
            <PctRow label="Neutro" pct={sum.percent_neutral} color={STATE_COLOR.neutral} />
            <PctRow label="Non valido" pct={sum.percent_invalid} color={MON.borderMedium} />
          </div>
        )}
        <p className="mt-3 text-[10.5px] text-anthracite-lighter leading-relaxed">
          Indicatori di benessere basati sulla variabilità del battito. Non costituiscono una valutazione medica: per ogni dato da approfondire rivolgersi al proprio medico.
        </p>
      </section>

      {/* ── 3.4 La notte ─────────────────────────────────────────────────── */}
      {pages.includes('notte') && <NightSection s={s} />}

      {/* ── 3.5 Andamento ────────────────────────────────────────────────── */}
      <section className="card p-5">
        <SectionTitle>Andamento</SectionTitle>
        <MonitoringTrendChart windows={s.windows} start={s.start_time} end={s.end_time} tz={tz} events={s.events} night={night} pro={pro} />
      </section>

      {/* ── 3.6 Mappa delle ore ──────────────────────────────────────────── */}
      {pages.includes('mappa_ore') && (
        <section className="card p-5">
          <SectionTitle>Mappa delle ore</SectionTitle>
          <MonitoringIndexCard
            text={indexText('hour_map')}
            icon={Grid3x3}
            pro={pro}
            unavailableReason={!a?.hourly?.length ? (why('hour_map') ?? 'nessuna ora con dati validi') : null}
            className="!p-0 !border-0 !shadow-none"
          >
            {a?.hourly?.length ? <MonitoringHourMap hours={a.hourly} tz={tz} pro={pro} /> : null}
          </MonitoringIndexCard>
        </section>
      )}

      {/* ── 3.7 Eventi ───────────────────────────────────────────────────── */}
      <section className="card p-5">
        <SectionTitle>Eventi</SectionTitle>
        <MonitoringEvents sessionId={s.id} events={s.events} tz={tz} start={s.start_time} end={s.end_time} night={night} readOnly={readOnly} pendingRecalc={s.events_modified_on_web} pro={pro} />
      </section>

      {/* ── 3.8 Ritmo e complessità ──────────────────────────────────────── */}
      {pages.includes('ritmo') && <RhythmSection s={s} />}

      {/* ── 3.9 Parametri ────────────────────────────────────────────────── */}
      {pages.includes('parametri') && (
        <section className="card p-5">
          <SectionTitle>Parametri</SectionTitle>
          <MonitoringParamsTable session={s} />
        </section>
      )}
    </div>
  )
}

// ── Avvisi (E5: banner di copertura informativo, non allarmante) ─────────────

function Notices({ s }: { s: Monitoring24hSession }) {
  const cov = s.valid_coverage_percentage
  const a = s.summary?.advanced
  const out: Array<{ color: string; text: string }> = []
  if (cov != null && cov < 80) {
    const gap = s.summary?.gap_minutes ?? 0
    const short = s.summary?.clock_shortfall_minutes ?? 0
    const missing = 100 - Math.round(cov)
    const names: string[] = []
    for (const [id, why] of Object.entries(a?.unavailable ?? {})) {
      if (why.includes('non rilevata') || why.includes('non valutabile') || why.includes('servono')) names.push(indexText(id as IndexId)?.name ?? id)
    }
    const unrel = (a?.unreliable ?? []).map((id) => indexText(id as IndexId)?.name ?? id)
    let text = `Mancano circa il ${missing}% dei dati`
    if (gap > 0 || short > 0) text += `: la fascia è stata scollegata per circa ${duration(gap + short)}`
    text += '. '
    if (names.length) text += `Non calcolabili: ${Array.from(new Set(names)).slice(0, 5).join(', ')}. `
    if (unrel.length) text += `Da leggere con cautela: ${Array.from(new Set(unrel)).slice(0, 5).join(', ')}.`
    out.push({ color: cov < 60 ? MON.warning : MON.info, text })
  }
  if (s.duration_minutes < 60) out.push({ color: MON.warning, text: "Registrazione sotto i 60 minuti: l'analisi della notte non è disponibile." })
  const b = s.baseline_snapshot
  if (b) {
    out.push({
      color: b.applied ? MON.accent : MON.textSecondary,
      text: b.applied ? `Riferimento ln RMSSD dalla baseline personale (${b.source}, n=${b.n}).` : `Baseline personale presente ma non usata: ${b.reason ?? '—'}`,
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
  const sum = s.summary
  const night = s.night
  const a = sum?.advanced
  const tz = s.tz_offset_minutes
  const { profile } = effectiveProfile(s)
  const f = profileFlags(profile)
  const items: Array<{ label: string; value: string; unit?: string; color: string }> = [
    { label: 'Tempo in recupero', value: sum ? `${Math.round(sum.percent_recovery)}` : '—', unit: '%', color: STATE_COLOR.recovery },
  ]
  if (f.hasNightPages && !f.hasWakePages) {
    items.push(
      { label: night?.min_hr_time ? `HR min notte · ${hm(night.min_hr_time, tz)}` : 'HR minima notte', value: night?.min_hr_night == null ? '—' : `${Math.round(night.min_hr_night)}`, unit: 'bpm', color: MON.accentDark },
      { label: 'Calo notturno', value: night?.hr_dip_percentage == null ? '—' : `−${Math.round(night.hr_dip_percentage)}`, unit: '%', color: MON.accent },
    )
  } else if (f.hasWakePages) {
    const p = a?.pauses
    const rt = a?.return_times
    items.push(
      { label: 'Pause di recupero', value: p ? `${p.count}` : '—', unit: p ? `· ${p.total_min} min` : '', color: MON.accentDark },
      { label: 'Tempo di rientro (mediana)', value: rt?.median == null ? '—' : `${Math.round(rt.median)}`, unit: 'min', color: MON.accent },
    )
  } else {
    const rt = a?.return_times
    items.push(
      { label: sum?.peak_stress_time ? `Picco · ${dayPart(sum.peak_stress_time, tz, night)}` : 'Picco della giornata', value: sum?.peak_stress_time ? hm(sum.peak_stress_time, tz) : '—', color: STATE_COLOR.stress },
      { label: 'Tempo di rientro (mediana)', value: rt?.median == null ? '—' : `${Math.round(rt.median)}`, unit: 'min', color: MON.accent },
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map((k) => (
        <div key={k.label} className="card p-4">
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
  const a = s.summary?.advanced
  const r = a?.reserve
  const tz = s.tz_offset_minutes
  const delta = r ? (r.end ?? 0) - (r.start ?? 0) : 0
  return (
    <MonitoringIndexCard
      text={indexText('reserve')}
      icon={BatteryCharging}
      unavailableReason={a?.unavailable?.reserve ?? null}
      value={r ? reserveLabel(delta) : null}
      level={r ? level.reserve(delta) : null}
      detail={r ? `Punto più basso${r.min_t ? ` alle ${hm(r.min_t, tz)}, ${dayPart(r.min_t, tz, s.night)}` : ''}${r.max_t ? ` · più alto alle ${hm(r.max_t, tz)}` : ''}` : null}
    />
  )
}

function PausesCard({ s }: { s: Monitoring24hSession }) {
  const a = s.summary?.advanced
  const p = a?.pauses
  const tz = s.tz_offset_minutes
  return (
    <MonitoringIndexCard
      text={indexText('recovery_pauses')}
      icon={PauseCircle}
      unavailableReason={a?.unavailable?.recovery_pauses ?? null}
      unreliable={a?.unreliable?.includes('recovery_pauses')}
      value={p ? `${p.count}` : null}
      unit={p ? (p.count === 1 ? `pausa · ${p.total_min} min` : `pause · ${p.total_min} min in tutto`) : null}
      level={p ? level.pauses(p.count, p.total_min) : null}
      detail={p && p.items.length ? p.items.slice(0, 4).map((b) => `${hm(b.start, tz)} (${b.minutes} min)`).join(' · ') + (p.items.length > 4 ? ' · …' : '') : null}
    />
  )
}

function StretchCard({ s }: { s: Monitoring24hSession }) {
  const a = s.summary?.advanced
  const ls = a?.longest_stretch
  const tz = s.tz_offset_minutes
  return (
    <MonitoringIndexCard
      text={indexText('longest_stretch')}
      icon={Minus}
      unavailableReason={a?.unavailable?.longest_stretch ?? null}
      unreliable={a?.unreliable?.includes('longest_stretch')}
      value={ls ? duration(ls.minutes) : null}
      level={ls ? level.stretch(ls.minutes) : null}
      detail={ls ? `dalle ${hm(ls.start, tz)} alle ${hm(ls.end, tz)}` : null}
    />
  )
}

function PeakCard({ s }: { s: Monitoring24hSession }) {
  const peak = s.summary?.peak_stress_time ?? null
  const tz = s.tz_offset_minutes
  return (
    <MonitoringIndexCard
      text={indexText('peak')}
      icon={Bolt}
      unavailableReason={peak ? null : "nessuna finestra valida fuori dall'attività"}
      value={peak ? hm(peak, tz) : null}
      detail={peak ? dayPart(peak, tz, s.night) : null}
    />
  )
}

function ReturnCard({ s }: { s: Monitoring24hSession }) {
  const a = s.summary?.advanced
  const rt = a?.return_times
  const tz = s.tz_offset_minutes
  return (
    <MonitoringIndexCard
      text={indexText('return_time')}
      icon={Repeat}
      unavailableReason={a?.unavailable?.return_time ?? null}
      unreliable={a?.unreliable?.includes('return_time')}
      value={rt?.median == null ? null : `${Math.round(rt.median)}`}
      unit="min (mediana)"
      level={rt?.median == null ? null : level.returnTime(rt.median)}
      detail={rt ? `Caso più lungo: ${rt.worst ?? '—'} min${rt.worst_at ? ` dopo le ${hm(rt.worst_at, tz)}, ${dayPart(rt.worst_at, tz, s.night)}` : ''} · ${rt.items.length} moment${rt.items.length === 1 ? 'o' : 'i'} di pressione` : null}
    />
  )
}

function DcCard({ s }: { s: Monitoring24hSession }) {
  const a = s.summary?.advanced
  const pr = a?.prsa
  return (
    <MonitoringIndexCard
      text={indexText('dc')}
      icon={MoveDownRight}
      unavailableReason={a?.unavailable?.dc ?? null}
      value={pr?.dc == null ? null : pr.dc.toFixed(1)}
      unit="ms"
      level={pr?.dc == null ? null : level.dc(pr.dc)}
      detail={pr ? `${pr.n_dec} ancoraggi di decelerazione · ${pr.beats} battiti` : null}
    />
  )
}

function AcCard({ s }: { s: Monitoring24hSession }) {
  const a = s.summary?.advanced
  const pr = a?.prsa
  return (
    <MonitoringIndexCard
      text={indexText('ac')}
      icon={MoveUpRight}
      unavailableReason={a?.unavailable?.ac ?? null}
      value={pr?.ac == null ? null : pr.ac.toFixed(1)}
      unit="ms"
      level={pr?.ac == null ? null : level.ac(pr.ac)}
      detail={pr ? `${pr.n_acc} ancoraggi di accelerazione` : null}
    />
  )
}

function FragmentationCard({ s, pro, full = false }: { s: Monitoring24hSession; pro: boolean; full?: boolean }) {
  const a = s.summary?.advanced
  const f = a?.fragmentation
  const label = f?.pip == null ? null : fragmentationLabel(f.pip)
  return (
    <MonitoringIndexCard
      text={indexText('fragmentation')}
      icon={Activity}
      unavailableReason={a?.unavailable?.fragmentation ?? null}
      unreliable={a?.unreliable?.includes('fragmentation')}
      value={label ? (full ? label : label[0].toUpperCase() + label.slice(1)) : null}
      level={label ? level.fragmentation(label) : null}
      // Al cliente solo l'etichetta; i quattro numeri stanno nel popover / al professionista.
      detail={f && pro ? `PIP ${f.pip?.toFixed(1) ?? '—'}% · IALS ${f.ials?.toFixed(full ? 3 : 2) ?? '—'} · PSS ${f.pss?.toFixed(1) ?? '—'}% · PAS ${f.pas?.toFixed(1) ?? '—'}%${full ? ` · ${f.beats} battiti` : ''}` : null}
    />
  )
}

function RespirationCard({ s, where }: { s: Monitoring24hSession; where: 'day' | 'night' }) {
  const a = s.summary?.advanced
  const resp = a?.respiration
  if (where === 'night') {
    return (
      <MonitoringIndexCard
        text={indexText('respiration')}
        icon={AIR}
        unavailableReason={resp?.night == null ? (a?.unavailable?.respiration ?? 'troppo poche finestre notturne con un ritmo respiratorio leggibile') : null}
        value={resp?.night == null ? null : `${Math.round(resp.night)}`}
        unit="atti/min di notte"
        detail={resp ? `${resp.day == null ? '' : `Di giorno ~${Math.round(resp.day)}/min · `}stima dal battito, non una misura diretta` : null}
      />
    )
  }
  const dayVal = resp?.day ?? resp?.all ?? null
  return (
    <MonitoringIndexCard
      text={indexText('respiration')}
      icon={AIR}
      unavailableReason={a?.unavailable?.respiration ?? null}
      value={dayVal == null ? null : `${Math.round(dayVal)}`}
      unit={`atti/min${resp?.day != null ? ' di giorno' : ''}`}
      detail={resp ? `${resp.night == null ? '' : `Di notte ~${Math.round(resp.night)}/min · `}stima dal battito, non una misura diretta` : null}
    />
  )
}

function PctRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span className="w-24 text-[11px] text-anthracite-lighter">{label}</span>
      <div className="flex-1 h-2 rounded bg-surface-border/60 overflow-hidden">
        <div className="h-full rounded" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }} />
      </div>
      <span className="w-10 text-right text-[11px] font-bold text-anthracite tabular-nums">{Math.round(pct)}%</span>
    </div>
  )
}

// ── La notte (3.4) ───────────────────────────────────────────────────────────

function NightSection({ s }: { s: Monitoring24hSession }) {
  const n = s.night
  const a = s.summary?.advanced
  const tz = s.tz_offset_minutes
  const why = a?.unavailable?.night_recovery ?? null
  if (!n) {
    return (
      <section className="card p-5">
        <SectionTitle>La notte</SectionTitle>
        <div className="flex items-start gap-3">
          <Bed size={22} style={{ color: MON.accent }} />
          <div>
            <div className="font-serif text-base text-anthracite">Notte non calcolabile</div>
            <p className="text-sm text-anthracite-lighter mt-1 leading-relaxed">
              {why ?? 'La registrazione non contiene un periodo continuo di riposo notturno.'}. Le ore erano quelle del riposo, ma senza dati continui gli indici notturni non si possono calcolare: controlla la fascia e la vicinanza del telefono.
            </p>
          </div>
        </div>
      </section>
    )
  }
  const trend = n.recovery_trend
  const trendText = trend == null ? 'Non valutabile' : trend > 3 ? 'Il recupero cresce nelle ultime ore di sonno' : trend < -3 ? 'Il recupero cala verso il risveglio' : 'Recupero stabile per tutta la notte'
  const trendColor = trend == null ? MON.textMuted : trend > 3 ? STATE_COLOR.recovery : trend < -3 ? STATE_COLOR.stress : MON.accent
  const TrendIcon = trend == null ? Minus : trend > 3 ? TrendingUp : trend < -3 ? TrendingDown : Minus
  const ttm = a?.time_to_min
  const u = a?.ultradian
  const q = s.summary?.night_recovery_quality ?? null
  const { profile } = effectiveProfile(s)
  const episodes = n.awakenings_estimate ?? 0

  return (
    <section className="card p-5 space-y-4">
      <SectionTitle>La notte</SectionTitle>
      <div className="flex items-center gap-3">
        <Bed size={26} style={{ color: MON.accent }} />
        <div>
          <div className="text-base font-extrabold text-anthracite">{hm(n.night_start, tz)} → {hm(n.night_end, tz)} · {duration(n.duration_minutes)}</div>
          <div className="text-[11px] text-anthracite-lighter">{n.detected ? 'Notte rilevata automaticamente dalla frequenza cardiaca' : 'Notte dagli eventi "Vado a dormire" / "Mi sono svegliato"'}</div>
        </div>
      </div>
      <div>
        <div className="text-[13px] font-bold text-anthracite mb-2">RMSSD per ora (barre) e frequenza cardiaca (linea)</div>
        <MonitoringNightChart night={n} tz={tz} />
        <div className="mt-1"><StateLegend compact /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Mini label={n.min_hr_time ? `HR minima · ${hm(n.min_hr_time, tz)}` : 'HR minima'} value={n.min_hr_night == null ? '—' : `${Math.round(n.min_hr_night)}`} unit="bpm" color={MON.accentDark} />
        <Mini label="HR media notte" value={n.mean_hr_night == null ? '—' : `${Math.round(n.mean_hr_night)}`} unit="bpm" color={MON.textPrimary} />
        <Mini label="Recupero in notte" value={n.recovery_percentage_night == null ? '—' : `${Math.round(n.recovery_percentage_night)}`} unit="%" color={STATE_COLOR.recovery} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <MonitoringIndexCard
          text={indexText('night_recovery')}
          icon={Bed}
          unavailableReason={q == null ? (why ?? 'score notturni non calcolabili') : null}
          value={q == null ? null : `${Math.round(q)}`}
          unit="/ 100"
          level={q == null ? null : level.nightQuality(q)}
          detail={trendText}
        />
        <MonitoringIndexCard
          text={indexText('hr_dip')}
          icon={TrendingDown}
          unavailableReason={n.hr_dip_percentage == null ? (a?.unavailable?.hr_dip ?? 'riferimento diurno assente') : null}
          value={n.hr_dip_percentage == null ? null : `−${Math.round(n.hr_dip_percentage)}`}
          unit="%"
          level={n.hr_dip_percentage == null ? null : level.hrDip(n.hr_dip_percentage)}
        />
        <MonitoringIndexCard
          text={indexText('time_to_min')}
          icon={Hourglass}
          unavailableReason={a?.unavailable?.time_to_min ?? (ttm ? null : (a ? null : 'analisi con versione precedente'))}
          value={ttm ? duration(ttm.min) : null}
          detail={ttm ? `battito più basso ${ttm.hr == null ? '—' : Math.round(ttm.hr)} bpm alle ${hm(ttm.at, tz)}` : null}
        >
          {ttm && ttm.descent.length >= 2 ? <DescentChart ttm={ttm} /> : null}
        </MonitoringIndexCard>
        <MonitoringIndexCard
          text={indexText('rest_waves')}
          icon={Waves}
          unavailableReason={a?.unavailable?.rest_waves ?? (u ? null : (a ? null : 'analisi con versione precedente'))}
          unreliable={a?.unreliable?.includes('rest_waves')}
          value={u ? (u.present ? 'Presenti' : 'Poco evidenti') : null}
          level={u ? level.waves(u.present) : null}
          detail={u && u.period != null ? `periodo ~${u.period} min · ${u.cycles?.toFixed(1) ?? '—'} cicli · forza ${u.strength?.toFixed(2) ?? '—'}` : null}
        />
        {profile !== 'breve' && <RespirationCard s={s} where="night" />}
        <div className="card p-4 flex items-start gap-3">
          <TrendIcon size={28} style={{ color: trendColor }} className="flex-shrink-0" />
          <div>
            <div className="text-[13px] font-bold text-anthracite">Andamento del recupero</div>
            <div className="text-xs font-bold" style={{ color: trendColor }}>{trendText}</div>
            <div className="mt-1 text-[11px] text-anthracite-lighter leading-relaxed">
              Prime 3 ore: RMSSD {n.recovery_first_3h == null ? '—' : Math.round(n.recovery_first_3h)} ms · Ultime 3 ore: {n.recovery_last_3h == null ? '—' : Math.round(n.recovery_last_3h)} ms
              {' · '}{episodes} episod{episodes === 1 ? 'io' : 'i'} di attivazione stimat{episodes === 1 ? 'o' : 'i'} (non risvegli)
            </div>
          </div>
        </div>
      </div>
      {s.scores_night && (
        <div className="card p-4"><MonitoringScoreBars scores={s.scores_night} title="Score della notte" /></div>
      )}
      {s.scores_morning && (
        <div className="card p-4"><MonitoringScoreBars scores={s.scores_morning} title="Score del risveglio (primi 10 minuti)" /></div>
      )}
      <div className="card p-4">
        <div className="text-[13px] font-bold text-anthracite mb-1">Parametri della notte (medie delle finestre)</div>
        <Kv k="RMSSD medio" v={`${n.rmssd_mean_night?.toFixed(1) ?? '—'} ms`} />
        <Kv k="ln RMSSD" v={n.ln_rmssd_night?.toFixed(2) ?? '—'} />
        <Kv k="SDNN medio" v={`${n.sdnn_night?.toFixed(1) ?? '—'} ms`} />
        <Kv k="Ore analizzate" v={`${n.hourly.length}`} />
      </div>
    </section>
  )
}

function Mini({ label, value, unit, color }: { label: string; value: string; unit?: string; color: string }) {
  return (
    <div className="card p-3.5">
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
  const a = s.summary?.advanced
  const tz = s.tz_offset_minutes
  const hours = a?.hourly ?? []
  const cos = a?.cosinor_hr
  const cosLn = a?.cosinor_ln_rmssd
  const pr = a?.prsa
  const m = a?.mse
  const sf = s.summary?.series?.full
  const amp = cos?.amp ?? null
  return (
    <section className="card p-5">
      <SectionTitle sub="Solo per il professionista: ogni valore con la riga di spiegazione e la referenza dietro l'icona.">Ritmo e complessità</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="lg:col-span-2">
          <MonitoringIndexCard
            text={indexText('internal_clock')}
            icon={Clock}
            unavailableReason={cos == null || amp == null ? (a?.unavailable?.internal_clock ?? 'servono almeno 18 ore di registrazione') : null}
            unreliable={a?.unreliable?.includes('internal_clock')}
            value={amp == null ? null : clockStrength(amp)}
            level={amp == null ? null : level.clock(amp)}
            detail={cos && amp != null
              ? `Forza del ritmo ±${amp.toFixed(1)} bpm attorno a ${cos.mesor == null ? '—' : Math.round(cos.mesor)} · ora del minimo ${cos.bathy == null ? '—' : hourFraction(cos.bathy)} · picco ${cos.acro == null ? '—' : hourFraction(cos.acro)} · R² ${cos.r2?.toFixed(2) ?? '—'} · ${cos.hours} h${cos.indicative ? ' · stima indicativa (< 24 h)' : ''}${cosLn && cosLn.amp != null ? `\nln RMSSD: ampiezza ${cosLn.amp.toFixed(2)}, picco ${cosLn.acro == null ? '—' : hourFraction(cosLn.acro)}` : ''}`
              : null}
          >
            {cos && hours.length ? <CosinorChart hours={hours} fit={cos} tz={tz} pick={(h) => h.hr} /> : null}
          </MonitoringIndexCard>
        </div>
        <MonitoringIndexCard
          text={indexText('dc')}
          icon={MoveDownRight}
          unavailableReason={a?.unavailable?.dc ?? null}
          value={pr?.dc == null ? null : pr.dc.toFixed(2)}
          unit="ms"
          level={pr?.dc == null ? null : level.dc(pr.dc)}
          detail={pr ? `AC ${pr.ac?.toFixed(2) ?? '—'} ms · ${pr.n_dec} / ${pr.n_acc} ancoraggi · ${pr.beats} battiti · curve PRSA (verde decelerazione, rosso accelerazione)` : null}
        >
          {pr && pr.curve_dec.length ? <PrsaChart prsa={pr} /> : null}
        </MonitoringIndexCard>
        <FragmentationCard s={s} pro full />
        <MonitoringIndexCard
          text={indexText('mse')}
          icon={Layers}
          unavailableReason={a?.unavailable?.mse ?? null}
          unreliable={a?.unreliable?.includes('mse')}
          value={m?.ci == null ? null : m.ci.toFixed(1)}
          unit="Complexity Index"
          detail={m ? `SampEn scala 1 ${m.e[0]?.toFixed(2) ?? '—'} · scala 10 ${(m.e.length > 9 ? m.e[9] : null)?.toFixed(2) ?? '—'} · ${m.chunks} blocchi, ${m.beats} battiti` : null}
        >
          {m ? <MseChart mse={m} /> : null}
        </MonitoringIndexCard>
        <MonitoringIndexCard
          text={indexText('dfa_alpha2')}
          icon={LineChartIcon}
          unavailableReason={a?.unavailable?.dfa_alpha2 ?? (a?.dfa_alpha2 == null ? '—' : null)}
          unreliable={a?.unreliable?.includes('dfa_alpha2')}
          value={a?.dfa_alpha2 == null ? null : a.dfa_alpha2.toFixed(2)}
          unit="α2"
          detail={sf?.dfa_alpha1 == null ? null : `α1 sulle serie continue ${sf.dfa_alpha1.toFixed(2)} (scale 4-16)`}
        />
        <MonitoringIndexCard
          text={indexText('ulf_vlf')}
          icon={AudioLines}
          unavailableReason={sf?.vlf == null ? 'nessun tratto continuo di almeno 5 minuti' : null}
          unreliable={a?.unreliable?.includes('ulf_vlf')}
          value={sf?.vlf == null ? null : `${Math.round(sf.vlf)}`}
          unit="ms² VLF"
          detail={sf ? `ULF ${sf.ulf == null ? 'non calcolabile (servono 24 ore continue)' : `${Math.round(sf.ulf)} ms²`} · LF ${sf.lf == null ? '—' : Math.round(sf.lf)} · HF ${sf.hf == null ? '—' : Math.round(sf.hf)} ms² · ${sf.tracts ?? 0} tratti, ${duration(sf.tract_minutes ?? 0)}` : null}
        />
      </div>
    </section>
  )
}
