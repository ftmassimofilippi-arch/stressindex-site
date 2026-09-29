import { getLocale, getTranslations } from 'next-intl/server'
import type { DfaWindow } from '@/lib/sport-data'
import { DFA_ZONES, dfaZoneLabel, zoneForAlpha1 } from '@/lib/sport-format'
import { formatClock } from '@/lib/sport-format'
import { num } from '@/lib/format'
import {
  formatIntensity,
  hrr60Band,
  thresholdModeLabel,
  thresholdReasonText,
  type HrZone,
  type ThresholdTestRecord,
} from '@/lib/threshold-types'
import { ThresholdScatterChart, ThresholdTimeChart } from '../../ThresholdCharts'

// Dettaglio di una sessione di tipo test incrementale con stima delle soglie:
// card soglie, scatter alpha1-FC con retta e soglie, grafico temporale con le
// bande degli step, tabella step, recupero, nota metodologica. Tutto letto da
// sport_sessions.threshold_test (calcolato dall'app), niente ricalcoli.

const Z3 = DFA_ZONES[2].color
const Z4 = DFA_ZONES[3].color

export async function ThresholdTestView({ record, windows }: { record: ThresholdTestRecord; windows: DfaWindow[] }) {
  const t = await getTranslations('sport')
  const locale = await getLocale()
  const a = record.analysis
  const mode = record.config.mode
  const reasons = a ? a.reasons.filter((r) => r !== 'lowR2') : []
  const stepReached =
    record.step_reached === 0
      ? t('threshold.warmup')
      : `${record.step_reached}${record.step_fraction < 0.99 ? ` (${Math.round(record.step_fraction * 100)}%)` : ''}`

  return (
    <div className="space-y-6">
      {/* Soglie stimate */}
      <section className="card p-5">
        <h2 className="font-serif text-lg text-anthracite mb-1">{t('threshold.estimatedTitle')}</h2>
        <p className="text-xs text-anthracite-lighter mb-4">
          {t('threshold.estimatedSubtitle', { mode: thresholdModeLabel(mode, t) })}
        </p>
        {!a ? (
          <div className="callout-blue text-sm text-anthracite">{t('threshold.noEstimate')}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ThresholdTile name={t('threshold.vt1')} color={Z3} hr={a.vt1?.hr ?? null} ci={a.vt1?.ci95 ?? null} intensity={a.vt1 ? formatIntensity(mode, a.vt1.intensity, true, locale) : null} ciLabel={(v) => t('threshold.ci', { value: num(v, 1, locale) })} />
              <ThresholdTile name={t('threshold.vt2')} color={Z4} hr={a.vt2?.hr ?? null} ci={a.vt2?.ci95 ?? null} intensity={a.vt2 ? formatIntensity(mode, a.vt2.intensity, true, locale) : null} ciLabel={(v) => t('threshold.ci', { value: num(v, 1, locale) })} />
            </div>
            <div className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${a.reliable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {a.regression
                ? a.reliable
                  ? t('threshold.reliable', { r2: num(a.regression.r2, 2, locale) })
                  : t('threshold.unreliable', { r2: num(a.regression.r2, 2, locale), min: num(0.6, 1, locale) })
                : t('threshold.noSignal')}
            </div>
            {reasons.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-anthracite-lighter">
                {reasons.map((r) => (
                  <li key={r}>· {thresholdReasonText(r, t)}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-anthracite-lighter">
              <Pill label={t('threshold.pillValidWindows')} value={t('threshold.pillWindowsValue', { n: a.valid_windows, minutes: Math.round(a.valid_seconds / 60) })} />
              <Pill label={t('threshold.pillDiscarded')} value={`${a.discarded_for_artifacts}`} />
              {a.hr_max_observed != null && <Pill label={t('threshold.pillHrMax')} value={`${Math.round(a.hr_max_observed)} bpm`} />}
              <Pill label={t('threshold.pillStep')} value={stepReached} />
              <Pill label={t('threshold.pillStop')} value={formatClock(record.stop_at_s * 1000)} />
              {record.sensor_name && <Pill label={t('threshold.pillSensor')} value={record.sensor_name} />}
            </div>
          </>
        )}
      </section>

      {/* Scatter */}
      <section className="card p-5">
        <h2 className="font-serif text-lg text-anthracite mb-3">{t('threshold.scatterTitle')}</h2>
        <ThresholdScatterChart windows={windows} record={record} />
      </section>

      {/* Temporale */}
      <section className="card p-5">
        <h2 className="font-serif text-lg text-anthracite mb-3">{t('threshold.timeTitle')}</h2>
        <ThresholdTimeChart windows={windows} record={record} />
      </section>

      {/* Step */}
      <section className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border">
          <h2 className="font-serif text-lg text-anthracite">{t('threshold.stepsTitle')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-anthracite-lighter">
              <tr>
                <th className="text-left px-6 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('threshold.colStep')}</th>
                <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('threshold.colIntensity')}</th>
                <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('threshold.colHrAvg')}</th>
                <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('threshold.colAlpha1Avg')}</th>
                <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('threshold.colZone')}</th>
              </tr>
            </thead>
            <tbody>
              {record.steps.map((s) => {
                const z = zoneForAlpha1(s.alpha1_avg)
                const intensity = s.actual_intensity ?? s.target_intensity
                return (
                  <tr key={s.index} className="border-t border-surface-border">
                    <td className="px-6 py-2.5 text-anthracite font-medium">
                      {s.index === 0 ? t('threshold.warmupRow') : `${s.index}`}
                      {s.completed_fraction < 0.99 && <span className="text-[11px] text-anthracite-lighter ml-1">({Math.round(s.completed_fraction * 100)}%)</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {s.index === 0 && intensity == null ? t('threshold.easyRun') : formatIntensity(mode, intensity, true, locale)}
                      {s.actual_intensity != null && <span className="text-[11px] text-anthracite-lighter ml-1" title={t('threshold.correctedTitle')}>*</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.hr_avg == null ? '—' : Math.round(s.hr_avg)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.alpha1_avg == null ? '—' : num(s.alpha1_avg, 2, locale)}</td>
                    <td className="px-3 py-2.5">
                      {z ? (
                        <span className="inline-flex items-center gap-1.5 text-xs"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: z.color }} />{z.short} · {dfaZoneLabel(z, t)}</span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {record.steps.some((s) => s.actual_intensity != null) && (
          <p className="px-6 py-2 text-[11px] text-anthracite-lighter">{t('threshold.correctedNote')}</p>
        )}
      </section>

      {/* Recupero */}
      <section className="card p-5">
        <h2 className="font-serif text-lg text-anthracite mb-1">{t('threshold.recoveryTitle')}</h2>
        {record.recovery?.hrr60 == null ? (
          <p className="text-sm text-anthracite-lighter">{t('threshold.recoveryMissing')}</p>
        ) : (
          <RecoveryBlock hrr60={record.recovery.hrr60} hrStop={record.recovery.hr_at_stop} hr60={record.recovery.hr_at_60} rmssd={record.recovery.rmssd_5min} />
        )}
      </section>

      {/* Zone */}
      <section className="card p-5">
        <h2 className="font-serif text-lg text-anthracite mb-1">{t('threshold.zonesTitle')}</h2>
        <p className="text-xs text-anthracite-lighter mb-3">{t('threshold.zonesText')}</p>
        <ZoneList zones={a?.zones ?? []} />
      </section>

      <div className="rounded-2xl bg-teal-light/40 px-5 py-4 text-sm text-anthracite">{t('threshold.methodNote')}</div>
    </div>
  )
}

function ThresholdTile({
  name,
  color,
  hr,
  ci,
  intensity,
  ciLabel,
}: {
  name: string
  color: string
  hr: number | null
  ci: number | null
  intensity: string | null
  ciLabel: (ci: number) => string
}) {
  return (
    <div className="rounded-xl border px-4 py-3 min-w-0" style={{ borderColor: color, backgroundColor: `${color}14` }}>
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>{name}</div>
      {hr == null ? (
        <div className="font-serif text-3xl text-anthracite-lighter mt-1">—</div>
      ) : (
        <>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-serif text-4xl text-anthracite">{Math.round(hr)}</span>
            <span className="text-xs text-anthracite-lighter">bpm</span>
          </div>
          {ci != null && Number.isFinite(ci) && <div className="text-[11px] text-anthracite-lighter">{ciLabel(ci)}</div>}
          {intensity && intensity !== '—' && <div className="text-sm font-medium text-anthracite mt-1">{intensity}</div>}
        </>
      )}
    </div>
  )
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface px-2 py-1">
      {label} <b className="text-anthracite">{value}</b>
    </span>
  )
}

export async function RecoveryBlock({ hrr60, hrStop, hr60, rmssd }: { hrr60: number; hrStop: number | null; hr60: number | null; rmssd: number | null }) {
  const t = await getTranslations('sport')
  const locale = await getLocale()
  const band = hrr60Band(hrr60)
  return (
    <div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-serif text-4xl text-anthracite">{hrr60}</span>
        <span className="text-xs text-anthracite-lighter">bpm</span>
        <span className={`ml-2 text-sm font-medium ${band.tone}`}>{t(`threshold.hrrBand.${band.key}`)}</span>
      </div>
      <div className="text-xs text-anthracite-lighter mt-1">
        {t('threshold.recoveryDetail', { stop: hrStop ?? '—', hr60: hr60 ?? '—' })}
        {rmssd != null && ` · ${t('threshold.recoveryRmssd', { value: num(rmssd, 1, locale) })}`}
      </div>
      <p className="text-[11px] text-anthracite-lighter mt-2">{t('threshold.recoveryReading')}</p>
    </div>
  )
}

export async function ZoneList({ zones }: { zones: HrZone[] }) {
  const t = await getTranslations('sport')
  const locale = await getLocale()
  if (zones.length === 0) return <p className="text-sm text-anthracite-lighter">{t('threshold.zonesNone')}</p>
  return (
    <ul className="space-y-1.5">
      {zones.map((z) => {
        const def = DFA_ZONES.find((d) => d.id === z.zone) ?? DFA_ZONES[4]
        const range =
          z.merged_with != null ? t('threshold.mergedWith', { zone: z.merged_with })
            : z.lo == null ? t('threshold.rangeBelow', { hi: Math.round(z.hi ?? 0) })
            : z.hi == null ? t('threshold.rangeAbove', { lo: Math.round(z.lo) })
            : t('threshold.rangeBetween', { lo: Math.round(z.lo), hi: Math.round(z.hi) })
        const alpha =
          def.max === Infinity ? `> ${num(def.min, 2, locale)}`
            : def.min === 0 ? `< ${num(def.max, 2, locale)}`
            : `${num(def.min, 2, locale)}–${num(def.max, 2, locale)}`
        return (
          <li key={z.zone} className="flex items-center justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-2 min-w-0 flex-wrap"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: def.color }} />{def.short} · {dfaZoneLabel(def, t)} <span className="text-[11px] text-anthracite-lighter">(α1 {alpha})</span></span>
            <span className={`tabular-nums whitespace-nowrap ${z.merged_with != null ? 'text-anthracite-lighter' : 'font-medium text-anthracite'}`}>{range}</span>
          </li>
        )
      })}
    </ul>
  )
}
