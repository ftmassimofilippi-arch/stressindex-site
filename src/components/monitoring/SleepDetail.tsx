'use client'

import Link from 'next/link'
import { AlertCircle, ArrowLeftRight, Footprints, Info, Minus, Sparkles, TimerOff, TrendingDown, TrendingUp, Wifi, WifiOff } from 'lucide-react'
import type { SleepSession } from '@/lib/monitoring-types'
import {
  MON, SLEEP_ODI_DISCLAIMER, SLEEP_PARAMS, STATE_COLOR, duration, hm, odi3Color, odi3Label, periodLabel, seconds, sleepComponentColor,
  sleepCoverageColor, sleepCoverageLabel, sleepScoreColor, sleepScoreLabel, t90Color, t90Label,
} from '@/lib/monitoring-format'
import { Chip, SectionTitle, TypeChip } from './MonitoringChips'
import { MonitoringGauge } from './MonitoringGauge'
import { MonitoringActions } from './MonitoringActions'
import { DesaturationStrip, PrNightChart, SleepStateLegend, Spo2NightChart } from './SleepCharts'
import { Kv } from './MonitoringParamsTable'

// Dettaglio di una notte del modulo Sonno (Checkme O2 Max). Segue la
// struttura reale delle righe sleep (night.sleep, summary.sleep_score,
// windows da 1 minuto) e le quattro pagine dell'app: Riepilogo,
// Ossigenazione, Cuore, Eventi. I testi sono copiati dall'app senza
// riformulazioni; nessun valore è ricalcolato.

type Props = { session: SleepSession; readOnly?: boolean; clientHref?: string }

export function SleepDetail({ session: s, readOnly = false, clientHref }: Props) {
  const tz = s.tz_offset_minutes
  const n = s.night
  const sl = n?.sleep ?? null
  const analyzable = sl?.analyzable ?? false
  const sig = sl?.signal ?? null
  const o = sl?.oxygenation ?? null
  const c = sl?.cardiac ?? null
  const mv = sl?.movement ?? null
  const score = s.summary?.sleep_score ?? null
  const startIso = n?.night_start ?? s.start_time
  const endIso = n?.night_end ?? s.end_time
  const durMin = n?.duration_minutes ?? s.duration_minutes

  return (
    <div className="space-y-6">
      {/* ── 4.1 Intestazione ─────────────────────────────────────────────── */}
      <header className="card p-5 sm:p-6" style={{ borderTop: `4px solid ${MON.sleep}` }}>
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2"><TypeChip type="sleep" /></div>
            <h1 className="font-serif text-2xl sm:text-3xl text-anthracite">
              {clientHref && s.client_id ? <Link href={clientHref} className="hover:underline">{s.client_name ?? 'Cliente'}</Link> : (s.client_name ?? 'Cliente')}
            </h1>
            <p className="mt-1 text-sm text-anthracite-lighter">Notte · {periodLabel(startIso, endIso, tz)} · {duration(durMin)}</p>
            <p className="mt-0.5 text-xs text-anthracite-lighter">
              {s.device_name ?? 'Checkme O2 Max'}{s.device_serial ? ` · seriale ${s.device_serial}` : ''} · algoritmo {sl?.algorithm_version ?? s.algorithm_version ?? '—'}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <Chip label={sleepCoverageLabel(sig?.coverage_label ?? null)} color={sleepCoverageColor(sig?.coverage_label ?? null)} icon={sig?.coverage_label === 'poor' ? WifiOff : Wifi} />
              <Chip label={`${duration(durMin)} · passo ${sig?.sample_interval_sec ?? s.sample_interval_seconds ?? '—'} s`} color={MON.sleep} />
              {sig && <Chip label={`Dati validi ${Math.round(sig.coverage_pct)} %`} color={sig.coverage_pct >= 85 ? MON.success : MON.warning} />}
              {s.professional_name && <Chip label={s.professional_name} color={MON.textSecondary} />}
            </div>
          </div>
          <MonitoringActions session={s} readOnly={readOnly} />
        </div>
      </header>

      <Notices s={s} />

      {!sl ? (
        <section className="card p-6">
          <div className="font-serif text-base text-anthracite">Dati della notte non presenti nella riga.</div>
          <p className="text-sm text-anthracite-lighter mt-1">La riga è stata scritta da una versione dell&apos;app senza il blocco Sonno.</p>
        </section>
      ) : !analyzable ? (
        <section className="card p-5">
          <div className="text-[13px] font-bold text-anthracite mb-1">Cosa e&apos; stato letto</div>
          <Kv k="Registrazione" v={`${hm(startIso, tz)} → ${hm(endIso, tz)}`} />
          <Kv k="Durata" v={duration(durMin)} />
          <Kv k="Campioni" v={`${sig?.sample_count ?? 0} (validi ${sig?.valid_sample_count ?? 0})`} />
          <Kv k="Passo ricavato" v={!sig || sig.sample_interval_sec === 0 ? 'non riconosciuto' : `${sig.sample_interval_sec} s`} />
        </section>
      ) : (
        <>
          {/* ── Riepilogo ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <MonitoringGauge
              value={score?.total ?? null}
              title="Sleep Score"
              label={score ? sleepScoreLabel(score.label) : 'Non disponibile'}
              colorFor={sleepScoreColor}
              leftLabel="0"
              rightLabel="100"
            />
            {score && (
              <div className="card p-4 lg:col-span-2">
                <div className="text-[13px] font-bold text-anthracite mb-2">Le quattro componenti</div>
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
            <Mini label={`ODI3 · ${odi3Label(o?.odi3_label)}`} value={o ? o.odi3.toFixed(1) : '—'} unit="/h" color={odi3Color(o?.odi3_label)} />
            <Mini label="Tempo sotto 90 %" value={o ? o.t90_pct.toFixed(1) : '—'} unit="%" color={t90Color(o?.t90_label)} />
            <Mini label={c?.min_pr_time ? `Polso min · ${hm(c.min_pr_time, tz)}` : 'Polso minimo'} value={c ? `${Math.round(c.min_pr)}` : '—'} unit="bpm" color={MON.sleepDark} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="text-[13px] font-bold text-anthracite mb-1">La notte in breve</div>
              <Kv k="Registrazione" v={`${hm(startIso, tz)} → ${hm(endIso, tz)} · ${duration(durMin)}`} />
              <Kv k="Tempo valido per l'ODI" v={duration(Math.round(sig?.valid_recording_minutes ?? 0))} />
              <Kv k="SpO₂ media" v={o?.mean_spo2 == null ? '—' : `${o.mean_spo2.toFixed(1)} %`} />
              <Kv k="Eventi di desaturazione" v={o ? `${o.event_count}` : '—'} />
              <Kv k="Polso medio" v={c ? `${Math.round(c.mean_pr)} bpm` : '—'} />
              {mv?.available && <Kv k="Risvegli stimati" v={`${mv.estimated_awakenings}`} />}
            </div>
            {sl.device?.o2_score != null && (
              <div className="card p-4 flex items-start gap-3">
                <ArrowLeftRight size={24} className="text-anthracite-lighter flex-shrink-0" />
                <div>
                  <div className="text-[13px] font-bold text-anthracite">Confronto con il dispositivo</div>
                  <p className="text-[11px] text-anthracite-lighter leading-relaxed mt-0.5">
                    O2 score del dispositivo {sl.device.o2_score} contro Sleep Score {score?.total ?? '—'}. {sl.device.drops_4 != null ? `Cali ≥ 4 punti: dispositivo ${sl.device.drops_4}, app ${o?.event_count_4 ?? '—'}. ` : ''}Il punteggio del dispositivo non entra nella formula: il suo calcolo non è pubblico.
                  </p>
                </div>
              </div>
            )}
          </div>
          <p className="text-[10.5px] text-anthracite-lighter leading-relaxed">
            Indicatori di benessere basati su ossigenazione e frequenza del polso. Non costituiscono una valutazione medica: per ogni dato da approfondire rivolgersi al proprio medico.
          </p>

          {/* ── 4.2 Ossigenazione ──────────────────────────────────────────── */}
          <section className="card p-5 space-y-4">
            <SectionTitle sleep>Ossigenazione</SectionTitle>
            {o ? (
              <>
                <div>
                  <div className="text-[13px] font-bold text-anthracite">SpO₂ di tutta la notte</div>
                  <div className="text-[10.5px] text-anthracite-lighter mb-2">Media per minuto; banda rossa sotto il 90 %; punti rossi sui nadir degli eventi.</div>
                  <Spo2NightChart windows={s.windows} events={sl.events} tz={tz} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Mini label="ODI3" value={o.odi3.toFixed(1)} unit="/h" color={odi3Color(o.odi3_label)} />
                  <Mini label="ODI4" value={o.odi4.toFixed(1)} unit="/h" color={MON.sleepDark} />
                  <Mini label="T90" value={o.t90_minutes < 10 ? o.t90_minutes.toFixed(1) : `${Math.round(o.t90_minutes)}`} unit="min" color={t90Color(o.t90_label)} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="card p-4">
                    <div className="text-[13px] font-bold text-anthracite mb-1">Indice di desaturazione</div>
                    <Kv k="ODI3 (cali ≥ 3 punti / ora valida)" v={`${o.odi3.toFixed(1)} · ${odi3Label(o.odi3_label)}`} />
                    <Kv k="ODI4 (cali ≥ 4 punti / ora valida)" v={o.odi4.toFixed(1)} />
                    <Kv k="Eventi totali" v={`${o.event_count} (di cui ${o.event_count_4} con calo ≥ 4)`} />
                    <Kv k="Tempo valido usato" v={duration(Math.round(sig?.valid_recording_minutes ?? 0))} />
                    {sl.device?.drops_4 != null && <Kv k="Cali ≥ 4 contati dal dispositivo" v={`${sl.device.drops_4}`} />}
                  </div>
                  <div className="card p-4">
                    <div className="text-[13px] font-bold text-anthracite mb-1">Tempo sotto soglia (sul tempo valido)</div>
                    <Kv k="Sotto 90 %" v={`${o.t90_minutes.toFixed(1)} min · ${o.t90_pct.toFixed(1)} % · ${t90Label(o.t90_label)}`} />
                    <Kv k="Sotto 88 %" v={`${o.t88_minutes.toFixed(1)} min · ${o.t88_pct.toFixed(1)} %`} />
                    <Kv k="Sotto 85 %" v={`${o.t85_minutes.toFixed(1)} min · ${o.t85_pct.toFixed(1)} %`} />
                    <Kv k="Nadir" v={o.nadir_time ? `${o.nadir} % alle ${hm(o.nadir_time, tz)}` : `${o.nadir} %`} />
                    <Kv k="SpO₂ media" v={o.mean_spo2 == null ? '—' : `${o.mean_spo2.toFixed(1)} %`} />
                    <Kv k="SpO₂ basale (mediana)" v={o.spo2_basal == null ? '—' : `${o.spo2_basal.toFixed(1)} %`} />
                  </div>
                  <div className="card p-4 lg:col-span-2">
                    <div className="text-[13px] font-bold text-anthracite mb-1">Stabilità del segnale</div>
                    <Kv k="Deviazione standard SpO₂" v={o.spo2_sd?.toFixed(2) ?? '—'} />
                    <Kv k="Delta index 12 s" v={o.delta_index_12s == null ? '—' : `${o.delta_index_12s.toFixed(2)}${o.delta_index_12s > SLEEP_PARAMS.deltaIndexUnstable ? ' · instabile' : ''}`} />
                    <Kv k="Pattern ciclico" v={o.cyclic_runs === 0 ? 'nessuna sequenza' : `${o.cyclic_runs} sequenz${o.cyclic_runs === 1 ? 'a' : 'e'} · ${duration(Math.round(o.cyclic_minutes))}`} />
                    <p className="mt-1 text-[10.5px] text-anthracite-lighter leading-relaxed">Il pattern ciclico (almeno 3 cali consecutivi a 20-100 s di distanza e ampiezza simile) è un proxy di respiro periodico: si riporta, non si interpreta.</p>
                  </div>
                </div>
                <Disclaimer />
              </>
            ) : (
              <p className="text-sm text-anthracite-lighter">Ossigenazione non disponibile: la notte non è analizzabile, vedi il riepilogo.</p>
            )}
          </section>

          {/* ── Cuore ──────────────────────────────────────────────────────── */}
          <section className="card p-5 space-y-4">
            <SectionTitle sleep>Cuore</SectionTitle>
            {c ? (
              <>
                <div>
                  <div className="text-[13px] font-bold text-anthracite">Frequenza del polso</div>
                  <div className="text-[10.5px] text-anthracite-lighter mb-2">Media per minuto; linea verde = polso basale; punti gialli = eventi con surge ≥ 6 bpm.</div>
                  <PrNightChart windows={s.windows} events={sl.events} prBasal={c.pr_basal} tz={tz} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Mini label="Media" value={`${Math.round(c.mean_pr)}`} unit="bpm" color={MON.textPrimary} />
                  <Mini label={c.min_pr_time ? `Minimo · ${hm(c.min_pr_time, tz)}` : 'Minimo'} value={`${Math.round(c.min_pr)}`} unit="bpm" color={MON.sleepDark} />
                  <Mini label="Basale (10° pct)" value={`${Math.round(c.pr_basal)}`} unit="bpm" color={STATE_COLOR.recovery} />
                </div>
                <TrendCard c={c} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="card p-4">
                    <div className="text-[13px] font-bold text-anthracite mb-1">Calo notturno e microrisvegli</div>
                    <Kv k="Mediana della prima ora" v={`${Math.round(c.first_hour_median_pr)} bpm`} />
                    <Kv k="Calo verso il basale" v={`${c.dip_pct.toFixed(1)} %`} />
                    <Kv k="Massimo" v={`${Math.round(c.max_pr)} bpm`} />
                    <Kv k="Eventi con surge ≥ 6 bpm" v={`${Math.round(c.surge_event_pct)} %`} />
                    <p className="mt-1 text-[10.5px] text-anthracite-lighter leading-relaxed">Il surge (polso che sale dopo il nadir di una desaturazione) è un proxy di microrisveglio: senza EEG non si contano i risvegli veri.</p>
                  </div>
                  {sl.hourly.length > 0 && (
                    <div className="card p-4">
                      <div className="text-[13px] font-bold text-anthracite mb-2">Profilo orario</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] min-w-[300px]">
                          <thead><tr className="text-anthracite-lighter font-bold"><th className="text-left py-1">Ora</th><th className="text-right py-1">SpO₂ media</th><th className="text-right py-1">Polso</th><th className="text-right py-1">Eventi</th></tr></thead>
                          <tbody>
                            {sl.hourly.map((h, i) => (
                              <tr key={i} className="border-t border-surface-border">
                                <td className="py-1">{hm(h.hour_start, tz)}</td>
                                <td className="py-1 text-right tabular-nums">{h.spo2 == null ? '—' : `${h.spo2.toFixed(1)} %`}</td>
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
              <p className="text-sm text-anthracite-lighter">Frequenza del polso non disponibile: la notte non è analizzabile, vedi il riepilogo.</p>
            )}
          </section>

          {/* ── 4.3 Eventi ─────────────────────────────────────────────────── */}
          <section className="card p-5 space-y-4">
            <SectionTitle sleep>Eventi</SectionTitle>
            <div>
              <div className="text-[13px] font-bold text-anthracite mb-2">Timeline della notte</div>
              <DesaturationStrip windows={s.windows} events={sl.events} tz={tz} />
              <div className="mt-2"><SleepStateLegend compact /></div>
            </div>
            <div>
              <div className="text-[13px] font-bold text-anthracite mb-2">Eventi di desaturazione ({sl.events.length})</div>
              {sl.events.length === 0 ? (
                <p className="text-sm text-anthracite-lighter">Nessun calo di almeno 3 punti sotto la baseline locale.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] min-w-[420px]">
                    <thead><tr className="text-anthracite-lighter font-bold"><th className="text-left py-1">Ora</th><th className="text-right py-1">Durata</th><th className="text-right py-1">Calo</th><th className="text-right py-1">Nadir</th><th className="text-right py-1">Surge</th></tr></thead>
                    <tbody>
                      {sl.events.map((e, i) => (
                        <tr key={i} className="border-t border-surface-border">
                          <td className="py-1">{hm(e.start, tz)}</td>
                          <td className="py-1 text-right tabular-nums">{e.duration_sec} s</td>
                          <td className="py-1 text-right tabular-nums">−{e.drop?.toFixed(1) ?? '—'}</td>
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
  const sl = s.night?.sleep
  if (!sl) return null
  const out: Array<{ icon: typeof Info; color: string; text: string }> = []
  if (!sl.analyzable) out.push({ icon: AlertCircle, color: MON.error, text: `Notte non analizzabile. ${sl.not_analyzable_reason ?? ''}` })
  else if (sl.signal.coverage_label === 'poor') out.push({ icon: WifiOff, color: MON.warning, text: `Segnale disturbato: campioni validi ${Math.round(sl.signal.coverage_pct)} %. I numeri vanno letti con cautela.` })
  for (const seg of sl.signal.invalid_segments) {
    const sec = Math.round((new Date(seg.end).getTime() - new Date(seg.start).getTime()) / 1000)
    out.push({ icon: TimerOff, color: MON.warning, text: `Sonda staccata dalle ${hm(seg.start, s.tz_offset_minutes)} alle ${hm(seg.end, s.tz_offset_minutes)} (${seconds(sec)}): tratto escluso dai calcoli.` })
  }
  if (sl.movement && !sl.movement.available && sl.analyzable) out.push({ icon: Footprints, color: MON.textSecondary, text: 'Il dispositivo non ha fornito dati di movimento: continuità non calcolata, pesi rinormalizzati.' })
  if (out.length === 0) return null
  return (
    <div className="space-y-2">
      {out.map((n, i) => {
        const Icon = n.icon
        return (
          <div key={i} className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl border text-[12px] text-anthracite leading-relaxed" style={{ borderColor: `${n.color}59`, backgroundColor: `${n.color}17` }}>
            <Icon size={15} className="mt-0.5 flex-shrink-0" style={{ color: n.color }} />
            <span>{n.text}</span>
          </div>
        )
      })}
    </div>
  )
}

function ScoreComponents({ score }: { score: NonNullable<SleepSession['summary']>['sleep_score'] & object }) {
  const rows: Array<[string, number | null, number]> = [
    ['Ossigenazione', score.oxygenation, score.weights.oxygenation],
    ['Stabilità respiratoria', score.respiratory_stability, score.weights.respiratory_stability],
    ['Recupero cardiaco', score.cardiac_recovery, score.weights.cardiac_recovery],
    ['Continuità', score.continuity, score.weights.continuity],
  ]
  return (
    <div className="space-y-2">
      {rows.map(([label, v, w]) => {
        const color = v == null ? MON.textMuted : sleepComponentColor(v)
        return (
          <div key={label} className="flex items-center gap-3">
            <span className="w-40 text-[11px] text-anthracite-lighter">{label}{w > 0 ? ` · ${Math.round(w * 100)} %` : ''}</span>
            <div className="flex-1 h-2.5 rounded-md bg-surface-border/60 overflow-hidden">
              <div className="h-full rounded-md" style={{ width: `${v == null ? 0 : Math.max(0, Math.min(100, v))}%`, backgroundColor: color }} />
            </div>
            <span className="w-8 text-right text-[13px] font-extrabold tabular-nums" style={{ color }}>{v == null ? '—' : Math.round(v)}</span>
          </div>
        )
      })}
      <p className="text-[10px] text-anthracite-lighter leading-relaxed">
        {score.continuity == null
          ? 'Movimento non disponibile dal dispositivo: la continuità non entra nel punteggio e i pesi sono 41 / 35 / 24 %.'
          : 'Pesi: 35 / 30 / 20 / 15 %. Il punteggio del dispositivo (O2 score) non entra nella formula.'}
      </p>
    </div>
  )
}

function TrendCard({ c }: { c: NonNullable<NonNullable<SleepSession['night']>['sleep']['cardiac']> }) {
  const trend = c.trend_bpm
  const text = trend == null ? 'Non valutabile (servono almeno 3 ore)' : trend > 0 ? 'Il polso scende nel corso della notte: il recupero cresce' : trend < 0 ? 'Il polso sale nel corso della notte' : 'Polso stabile fra inizio e fine notte'
  const color = trend == null ? MON.textMuted : trend > 0 ? STATE_COLOR.recovery : trend < 0 ? STATE_COLOR.stress : MON.sleep
  const Icon = trend == null ? Minus : trend > 0 ? TrendingDown : trend < 0 ? TrendingUp : Minus
  return (
    <div className="card p-4 flex items-start gap-3">
      <Icon size={30} style={{ color }} className="flex-shrink-0" />
      <div>
        <div className="text-[13px] font-bold text-anthracite">Prime 3 ore contro ultime 3 ore</div>
        <div className="text-xs font-bold" style={{ color }}>{text}</div>
        <div className="mt-1 text-[11px] text-anthracite-lighter leading-relaxed">
          Prime 3 ore: {c.first_3h_mean_pr == null ? '—' : Math.round(c.first_3h_mean_pr)} bpm · Ultime 3 ore: {c.last_3h_mean_pr == null ? '—' : Math.round(c.last_3h_mean_pr)} bpm{trend == null ? '' : ` · differenza ${trend > 0 ? '−' : '+'}${Math.abs(trend).toFixed(1)} bpm`}
        </div>
      </div>
    </div>
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

function Disclaimer() {
  return (
    <div className="flex items-start gap-2 p-3.5 rounded-xl" style={{ backgroundColor: MON.sleepLight }}>
      <Info size={17} className="flex-shrink-0 mt-0.5" style={{ color: MON.sleepDark }} />
      <p className="text-[11px] leading-relaxed text-anthracite">{SLEEP_ODI_DISCLAIMER}</p>
    </div>
  )
}

