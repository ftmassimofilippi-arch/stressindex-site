'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { AlertCircle, ArrowLeftRight, Footprints, Info, Minus, Sparkles, TimerOff, TrendingDown, TrendingUp, Wifi, WifiOff } from 'lucide-react'
import type { SleepSession } from '@/lib/monitoring-types'
import {
  MON, SLEEP_PARAMS, STATE_COLOR, duration, fmtNum, hm, odi3Color, odi3Label, periodLabel, seconds, sleepComponentColor,
  sleepCoverageColor, sleepCoverageLabel, sleepOdiDisclaimer, sleepScoreColor, sleepScoreLabel, t90Color, t90Label,
} from '@/lib/monitoring-format'
import { sleepT } from '@/lib/sleep-strings'
import type { Lang } from '@/lib/monitoring-strings'
import { Chip, SectionTitle, TypeChip } from './MonitoringChips'
import { MonitoringGauge } from './MonitoringGauge'
import { MonitoringActions } from './MonitoringActions'
import { DesaturationStrip, PrNightChart, SleepStateLegend, Spo2NightChart } from './SleepCharts'
import { Kv } from './MonitoringParamsTable'

// Dettaglio di una notte del modulo Sonno (Checkme O2 Max). Segue la
// struttura reale delle righe sleep (night.sleep, summary.sleep_score,
// windows da 1 minuto) e le quattro pagine dell'app: Riepilogo,
// Ossigenazione, Cuore, Eventi. I testi che esistono nell'app arrivano da
// sleep-strings.ts (st); nessun valore è ricalcolato.

type Props = { session: SleepSession; readOnly?: boolean; clientHref?: string }

function useSleep() {
  const t = useTranslations('monitoring')
  const locale = useLocale() as Lang
  const st = (k: string) => sleepT(k, locale)
  const n = (v: number | null | undefined, d: number) => fmtNum(v, d, locale)
  return { t, locale, st, n }
}

export function SleepDetail({ session: s, readOnly = false, clientHref }: Props) {
  const { t, locale, st, n } = useSleep()
  const tc = useTranslations('common')
  const tz = s.tz_offset_minutes
  const night = s.night
  const sl = night?.sleep ?? null
  const analyzable = sl?.analyzable ?? false
  const sig = sl?.signal ?? null
  const o = sl?.oxygenation ?? null
  const c = sl?.cardiac ?? null
  const mv = sl?.movement ?? null
  const score = s.summary?.sleep_score ?? null
  const startIso = night?.night_start ?? s.start_time
  const endIso = night?.night_end ?? s.end_time
  const durMin = night?.duration_minutes ?? s.duration_minutes
  const clientName = s.client_name ?? t('client')

  return (
    <div className="space-y-6">
      {/* ── 4.1 Intestazione ─────────────────────────────────────────────── */}
      <header className="card p-5 sm:p-6" style={{ borderTop: `4px solid ${MON.sleep}` }}>
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2"><TypeChip type="sleep" /></div>
            <h1 className="font-serif text-2xl sm:text-3xl text-anthracite break-words">
              {clientHref && s.client_id ? <Link href={clientHref} className="hover:underline">{clientName}</Link> : clientName}
            </h1>
            <p className="mt-1 text-sm text-anthracite-lighter">{t('sleep.night')} · {periodLabel(startIso, endIso, tz, locale)} · {duration(durMin)}</p>
            <p className="mt-0.5 text-xs text-anthracite-lighter">
              {s.device_name ?? 'Checkme O2 Max'}{s.device_serial ? ` · ${t('sleep.serial', { serial: s.device_serial })}` : ''} · {t('algorithm', { version: sl?.algorithm_version ?? s.algorithm_version ?? '—' })}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <Chip label={sleepCoverageLabel(sig?.coverage_label ?? null, locale, t)} color={sleepCoverageColor(sig?.coverage_label ?? null)} icon={sig?.coverage_label === 'poor' ? WifiOff : Wifi} />
              <Chip label={`${duration(durMin)} · ${t('sleep.step', { s: sig?.sample_interval_sec ?? s.sample_interval_seconds ?? '—' })}`} color={MON.sleep} />
              {sig && <Chip label={t('sleep.validData', { pct: Math.round(sig.coverage_pct) })} color={sig.coverage_pct >= 85 ? MON.success : MON.warning} />}
              {s.professional_name && <Chip label={s.professional_name} color={MON.textSecondary} />}
            </div>
          </div>
          <MonitoringActions session={s} readOnly={readOnly} />
        </div>
      </header>

      <Notices s={s} />

      {!sl ? (
        <section className="card p-6">
          <div className="font-serif text-base text-anthracite">{t('sleep.noSleepBlock')}</div>
          <p className="text-sm text-anthracite-lighter mt-1">{t('sleep.noSleepBlockHint')}</p>
        </section>
      ) : !analyzable ? (
        <section className="card p-5">
          <div className="text-[13px] font-bold text-anthracite mb-1">{t('sleep.whatRead')}</div>
          <Kv k={t('sleep.recording')} v={`${hm(startIso, tz)} → ${hm(endIso, tz)}`} />
          <Kv k={st('duration')} v={duration(durMin)} />
          <Kv k={t('sleep.samples')} v={t('sleep.samplesValue', { count: sig?.sample_count ?? 0, valid: sig?.valid_sample_count ?? 0 })} />
          <Kv k={t('sleep.stepDerived')} v={!sig || sig.sample_interval_sec === 0 ? t('sleep.stepUnknown') : `${sig.sample_interval_sec} s`} />
        </section>
      ) : (
        <>
          {/* ── Riepilogo ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <MonitoringGauge
              value={score?.total ?? null}
              title={st('sleep_score')}
              label={score ? sleepScoreLabel(score.label, locale) : tc('notAvailable')}
              colorFor={sleepScoreColor}
              leftLabel="0"
              rightLabel="100"
            />
            {score && (
              <div className="card p-4 lg:col-span-2">
                <div className="text-[13px] font-bold text-anthracite mb-2">{st('components')}</div>
                <ScoreComponents score={score} />
              </div>
            )}
          </div>

          {s.summary?.summary_phrase && (
            <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ backgroundColor: MON.sleepLight }}>
              <Sparkles size={18} className="flex-shrink-0 mt-0.5" style={{ color: MON.sleepDark }} />
              <p className="text-[13px] leading-relaxed text-anthracite">{s.summary.summary_phrase}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Mini label={t('sleep.odi3Label', { label: odi3Label(o?.odi3_label, locale) })} value={o ? n(o.odi3, 1) : '—'} unit="/h" color={odi3Color(o?.odi3_label)} />
            <Mini label={st('t90')} value={o ? n(o.t90_pct, 1) : '—'} unit="%" color={t90Color(o?.t90_label)} />
            <Mini label={c?.min_pr_time ? t('sleep.prMinAt', { time: hm(c.min_pr_time, tz) }) : st('pr_min')} value={c ? `${Math.round(c.min_pr)}` : '—'} unit="bpm" color={MON.sleepDark} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="text-[13px] font-bold text-anthracite mb-1">{t('sleep.inBrief')}</div>
              <Kv k={t('sleep.recording')} v={`${hm(startIso, tz)} → ${hm(endIso, tz)} · ${duration(durMin)}`} />
              <Kv k={st('valid_time')} v={duration(Math.round(sig?.valid_recording_minutes ?? 0))} />
              <Kv k={st('spo2_mean')} v={o?.mean_spo2 == null ? '—' : `${n(o.mean_spo2, 1)} %`} />
              <Kv k={st('events')} v={o ? `${o.event_count}` : '—'} />
              <Kv k={st('pr_mean')} v={c ? `${Math.round(c.mean_pr)} bpm` : '—'} />
              {mv?.available && <Kv k={st('awakenings')} v={`${mv.estimated_awakenings}`} />}
            </div>
            {sl.device?.o2_score != null && (
              <div className="card p-4 flex items-start gap-3">
                <ArrowLeftRight size={24} className="text-anthracite-lighter flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-anthracite">{t('sleep.deviceCompare')}</div>
                  <p className="text-[11px] text-anthracite-lighter leading-relaxed mt-0.5">
                    {t('sleep.deviceCompareText', { device: sl.device.o2_score, score: score?.total ?? '—' })} {sl.device.drops_4 != null ? `${t('sleep.deviceDrops', { device: sl.device.drops_4, app: o?.event_count_4 ?? '—' })} ` : ''}{t('sleep.deviceNote')}
                  </p>
                </div>
              </div>
            )}
          </div>
          <p className="text-[10.5px] text-anthracite-lighter leading-relaxed">{t('sleep.disclaimer')}</p>

          {/* ── 4.2 Ossigenazione ──────────────────────────────────────────── */}
          <section className="card p-5 space-y-4">
            <SectionTitle sleep>{st('oxygenation')}</SectionTitle>
            {o ? (
              <>
                <div>
                  <div className="text-[13px] font-bold text-anthracite">{t('sleep.spo2AllNight')}</div>
                  <div className="text-[10.5px] text-anthracite-lighter mb-2">{t('sleep.spo2ChartHint')}</div>
                  <Spo2NightChart windows={s.windows} events={sl.events} tz={tz} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Mini label="ODI3" value={n(o.odi3, 1)} unit="/h" color={odi3Color(o.odi3_label)} />
                  <Mini label="ODI4" value={n(o.odi4, 1)} unit="/h" color={MON.sleepDark} />
                  <Mini label="T90" value={o.t90_minutes < 10 ? n(o.t90_minutes, 1) : `${Math.round(o.t90_minutes)}`} unit="min" color={t90Color(o.t90_label)} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="card p-4">
                    <div className="text-[13px] font-bold text-anthracite mb-1">{t('sleep.desatIndex')}</div>
                    <Kv k={st('odi3')} v={`${n(o.odi3, 1)} · ${odi3Label(o.odi3_label, locale)}`} />
                    <Kv k={st('odi4')} v={n(o.odi4, 1)} />
                    <Kv k={t('sleep.totalEvents')} v={t('sleep.totalEventsValue', { count: o.event_count, count4: o.event_count_4 })} />
                    <Kv k={t('sleep.validTimeUsed')} v={duration(Math.round(sig?.valid_recording_minutes ?? 0))} />
                    {sl.device?.drops_4 != null && <Kv k={st('device_drops4')} v={`${sl.device.drops_4}`} />}
                  </div>
                  <div className="card p-4">
                    <div className="text-[13px] font-bold text-anthracite mb-1">{st('below_threshold')}</div>
                    <Kv k={t('sleep.below90')} v={`${n(o.t90_minutes, 1)} min · ${n(o.t90_pct, 1)} % · ${t90Label(o.t90_label, locale)}`} />
                    <Kv k={t('sleep.below88')} v={`${n(o.t88_minutes, 1)} min · ${n(o.t88_pct, 1)} %`} />
                    <Kv k={t('sleep.below85')} v={`${n(o.t85_minutes, 1)} min · ${n(o.t85_pct, 1)} %`} />
                    <Kv k={st('ev_nadir')} v={o.nadir_time ? t('sleep.nadirAt', { v: o.nadir, time: hm(o.nadir_time, tz) }) : `${o.nadir} %`} />
                    <Kv k={st('spo2_mean')} v={o.mean_spo2 == null ? '—' : `${n(o.mean_spo2, 1)} %`} />
                    <Kv k={st('spo2_basal')} v={o.spo2_basal == null ? '—' : `${n(o.spo2_basal, 1)} %`} />
                  </div>
                  <div className="card p-4 lg:col-span-2">
                    <div className="text-[13px] font-bold text-anthracite mb-1">{t('sleep.signalStability')}</div>
                    <Kv k={t('sleep.spo2Sd')} v={n(o.spo2_sd, 2)} />
                    <Kv k={st('delta_index')} v={o.delta_index_12s == null ? '—' : `${n(o.delta_index_12s, 2)}${o.delta_index_12s > SLEEP_PARAMS.deltaIndexUnstable ? ` · ${t('sleep.unstable')}` : ''}`} />
                    <Kv k={st('cyclic')} v={o.cyclic_runs === 0 ? st('cyclic_none') : t('sleep.cyclicRuns', { count: o.cyclic_runs, duration: duration(Math.round(o.cyclic_minutes)) })} />
                    <p className="mt-1 text-[10.5px] text-anthracite-lighter leading-relaxed">{t('sleep.cyclicNote')}</p>
                  </div>
                </div>
                <Disclaimer />
              </>
            ) : (
              <p className="text-sm text-anthracite-lighter">{t('sleep.oxyUnavailable')}</p>
            )}
          </section>

          {/* ── Cuore ──────────────────────────────────────────────────────── */}
          <section className="card p-5 space-y-4">
            <SectionTitle sleep>{st('heart')}</SectionTitle>
            {c ? (
              <>
                <div>
                  <div className="text-[13px] font-bold text-anthracite">{t('sleep.pulseRate')}</div>
                  <div className="text-[10.5px] text-anthracite-lighter mb-2">{t('sleep.prChartHint')}</div>
                  <PrNightChart windows={s.windows} events={sl.events} prBasal={c.pr_basal} tz={tz} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Mini label={t('sleep.mean')} value={`${Math.round(c.mean_pr)}`} unit="bpm" color={MON.textPrimary} />
                  <Mini label={c.min_pr_time ? t('sleep.minAt', { time: hm(c.min_pr_time, tz) }) : t('sleep.min')} value={`${Math.round(c.min_pr)}`} unit="bpm" color={MON.sleepDark} />
                  <Mini label={t('sleep.basal')} value={`${Math.round(c.pr_basal)}`} unit="bpm" color={STATE_COLOR.recovery} />
                </div>
                <TrendCard c={c} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="card p-4">
                    <div className="text-[13px] font-bold text-anthracite mb-1">{t('sleep.dipTitle')}</div>
                    <Kv k={t('sleep.firstHourMedian')} v={`${Math.round(c.first_hour_median_pr)} bpm`} />
                    <Kv k={t('sleep.dipToBasal')} v={`${n(c.dip_pct, 1)} %`} />
                    <Kv k={t('sleep.max')} v={`${Math.round(c.max_pr)} bpm`} />
                    <Kv k={st('surge_pct')} v={`${Math.round(c.surge_event_pct)} %`} />
                    <p className="mt-1 text-[10.5px] text-anthracite-lighter leading-relaxed">{t('sleep.surgeNote')}</p>
                  </div>
                  {sl.hourly.length > 0 && (
                    <div className="card p-4">
                      <div className="text-[13px] font-bold text-anthracite mb-2">{st('hourly')}</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] min-w-[300px]">
                          <thead><tr className="text-anthracite-lighter font-bold"><th className="text-left py-1">{st('hour')}</th><th className="text-right py-1">{st('spo2_mean')}</th><th className="text-right py-1">{st('pr')}</th><th className="text-right py-1">{t('sleep.eventsShort')}</th></tr></thead>
                          <tbody>
                            {sl.hourly.map((h, i) => (
                              <tr key={i} className="border-t border-surface-border">
                                <td className="py-1">{hm(h.hour_start, tz)}</td>
                                <td className="py-1 text-right tabular-nums">{h.spo2 == null ? '—' : `${n(h.spo2, 1)} %`}</td>
                                <td className="py-1 text-right tabular-nums">{h.pr == null ? '—' : `${Math.round(h.pr)} bpm`}</td>
                                <td className="py-1 text-right tabular-nums">{h.events}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-anthracite-lighter">{t('sleep.prUnavailable')}</p>
            )}
          </section>

          {/* ── 4.3 Eventi ─────────────────────────────────────────────────── */}
          <section className="card p-5 space-y-4">
            <SectionTitle sleep>{t('sleep.eventsTitle')}</SectionTitle>
            <div>
              <div className="text-[13px] font-bold text-anthracite mb-2">{t('sleep.nightTimeline')}</div>
              <DesaturationStrip windows={s.windows} events={sl.events} tz={tz} />
              <div className="mt-2"><SleepStateLegend compact /></div>
            </div>
            <div>
              <div className="text-[13px] font-bold text-anthracite mb-2">{t('sleep.desatEvents', { count: sl.events.length })}</div>
              {sl.events.length === 0 ? (
                <p className="text-sm text-anthracite-lighter">{st('no_events')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] min-w-[420px]">
                    <thead><tr className="text-anthracite-lighter font-bold"><th className="text-left py-1">{st('ev_time')}</th><th className="text-right py-1">{st('ev_duration')}</th><th className="text-right py-1">{st('ev_drop')}</th><th className="text-right py-1">{st('ev_nadir')}</th><th className="text-right py-1">{st('ev_surge')}</th></tr></thead>
                    <tbody>
                      {sl.events.map((e, i) => (
                        <tr key={i} className="border-t border-surface-border">
                          <td className="py-1">{hm(e.start, tz)}</td>
                          <td className="py-1 text-right tabular-nums">{e.duration_sec} s</td>
                          <td className="py-1 text-right tabular-nums">−{n(e.drop, 1)}</td>
                          <td className="py-1 text-right tabular-nums" style={{ color: e.nadir < SLEEP_PARAMS.t90Threshold ? MON.error : undefined }}>{e.nadir} %</td>
                          <td className="py-1 text-right tabular-nums" style={{ color: (e.surge_bpm ?? 0) >= SLEEP_PARAMS.surgeThresholdBpm ? MON.warning : undefined }}>{e.surge_bpm == null ? '—' : `${e.surge_bpm >= 0 ? '+' : ''}${Math.round(e.surge_bpm)} bpm`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <Disclaimer />
          </section>
        </>
      )}
    </div>
  )
}

function Notices({ s }: { s: SleepSession }) {
  const { t } = useSleep()
  const sl = s.night?.sleep
  if (!sl) return null
  const out: Array<{ icon: typeof Info; color: string; text: string }> = []
  if (!sl.analyzable) out.push({ icon: AlertCircle, color: MON.error, text: t('sleep.notices.notAnalyzable', { reason: sl.not_analyzable_reason ?? '' }) })
  else if (sl.signal.coverage_label === 'poor') out.push({ icon: WifiOff, color: MON.warning, text: t('sleep.notices.poorSignal', { pct: Math.round(sl.signal.coverage_pct) }) })
  for (const seg of sl.signal.invalid_segments) {
    const sec = Math.round((new Date(seg.end).getTime() - new Date(seg.start).getTime()) / 1000)
    out.push({ icon: TimerOff, color: MON.warning, text: t('sleep.notices.probeOff', { from: hm(seg.start, s.tz_offset_minutes), to: hm(seg.end, s.tz_offset_minutes), duration: seconds(sec) }) })
  }
  if (sl.movement && !sl.movement.available && sl.analyzable) out.push({ icon: Footprints, color: MON.textSecondary, text: t('sleep.notices.noMovement') })
  if (out.length === 0) return null
  return (
    <div className="space-y-2">
      {out.map((item, i) => {
        const Icon = item.icon
        return (
          <div key={i} className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl border text-[12px] text-anthracite leading-relaxed" style={{ borderColor: `${item.color}59`, backgroundColor: `${item.color}17` }}>
            <Icon size={15} className="mt-0.5 flex-shrink-0" style={{ color: item.color }} />
            <span>{item.text}</span>
          </div>
        )
      })}
    </div>
  )
}

function ScoreComponents({ score }: { score: NonNullable<SleepSession['summary']>['sleep_score'] & object }) {
  const { st } = useSleep()
  const rows: Array<[string, number | null, number]> = [
    [st('comp_oxygenation'), score.oxygenation, score.weights.oxygenation],
    [st('comp_respiratory'), score.respiratory_stability, score.weights.respiratory_stability],
    [st('comp_cardiac'), score.cardiac_recovery, score.weights.cardiac_recovery],
    [st('comp_continuity'), score.continuity, score.weights.continuity],
  ]
  return (
    <div className="space-y-2">
      {rows.map(([label, v, w]) => {
        const color = v == null ? MON.textMuted : sleepComponentColor(v)
        return (
          <div key={label} className="flex items-center gap-3">
            <span className="w-40 text-[11px] text-anthracite-lighter truncate" title={label}>{label}{w > 0 ? ` · ${Math.round(w * 100)} %` : ''}</span>
            <div className="flex-1 h-2.5 rounded-md bg-surface-border/60 overflow-hidden">
              <div className="h-full rounded-md" style={{ width: `${v == null ? 0 : Math.max(0, Math.min(100, v))}%`, backgroundColor: color }} />
            </div>
            <span className="w-8 text-right text-[13px] font-extrabold tabular-nums" style={{ color }}>{v == null ? '—' : Math.round(v)}</span>
          </div>
        )
      })}
      <p className="text-[10px] text-anthracite-lighter leading-relaxed">
        {score.continuity == null ? st('weights_note_nomov') : st('weights_note')}
      </p>
    </div>
  )
}

function TrendCard({ c }: { c: NonNullable<NonNullable<SleepSession['night']>['sleep']['cardiac']> }) {
  const { t, n } = useSleep()
  const trend = c.trend_bpm
  const text = trend == null ? t('sleep.trendNa') : trend > 0 ? t('sleep.trendUp') : trend < 0 ? t('sleep.trendDown') : t('sleep.trendFlat')
  const color = trend == null ? MON.textMuted : trend > 0 ? STATE_COLOR.recovery : trend < 0 ? STATE_COLOR.stress : MON.sleep
  const Icon = trend == null ? Minus : trend > 0 ? TrendingDown : trend < 0 ? TrendingUp : Minus
  return (
    <div className="card p-4 flex items-start gap-3">
      <Icon size={30} style={{ color }} className="flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-anthracite">{t('sleep.trendTitle')}</div>
        <div className="text-xs font-bold" style={{ color }}>{text}</div>
        <div className="mt-1 text-[11px] text-anthracite-lighter leading-relaxed">
          {t('sleep.trendDetail', { first: c.first_3h_mean_pr == null ? '—' : Math.round(c.first_3h_mean_pr), last: c.last_3h_mean_pr == null ? '—' : Math.round(c.last_3h_mean_pr) })}
          {trend == null ? '' : ` · ${t('sleep.trendDiff', { v: `${trend > 0 ? '−' : '+'}${n(Math.abs(trend), 1)}` })}`}
        </div>
      </div>
    </div>
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

function Disclaimer() {
  const { locale } = useSleep()
  return (
    <div className="flex items-start gap-2 p-3.5 rounded-xl" style={{ backgroundColor: MON.sleepLight }}>
      <Info size={17} className="flex-shrink-0 mt-0.5" style={{ color: MON.sleepDark }} />
      <p className="text-[11px] leading-relaxed text-anthracite">{sleepOdiDisclaimer(locale)}</p>
    </div>
  )
}
