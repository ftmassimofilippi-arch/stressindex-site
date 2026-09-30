import { useLocale, useTranslations } from 'next-intl'
import type { Monitoring24hSession, SeriesHrv } from '@/lib/monitoring-types'
import { MON, duration, effectiveProfile, fmtNum, fx, profileLabel, signalQualityLabel, sourceLabel } from '@/lib/monitoring-format'
import { monT, type Lang } from '@/lib/monitoring-strings'

// Pagina "Parametri" (solo professionista): tabella intera / notte / giorno
// con i parametri HRV calcolati dall'app nei tratti continui, la sezione
// Registrazione e la scala individuale usata per la classificazione.
// `print`: pagina di stampa, griglia a due colonne fissa e nessuno scroll.

export function MonitoringParamsTable({ session, print = false }: { session: Monitoring24hSession; print?: boolean }) {
  const t = useTranslations('monitoring')
  const locale = useLocale() as Lang
  const m = (k: string) => monT(k, locale)
  const f = (v: number | null | undefined, dec: number, unit = '') => fx(v, dec, unit, locale)
  const rows: Array<[string, (s: SeriesHrv) => string]> = [
    [t('params.durationInTracts'), (s) => duration(s.minutes)],
    [t('params.beats'), (s) => `${s.rr_count}`],
    [m('tracts'), (s) => (s.tracts == null ? '—' : `${s.tracts}`)],
    [t('params.meanHr'), (s) => f(s.mean_hr, 0, 'bpm')],
    ['RMSSD', (s) => f(s.rmssd, 1, 'ms')],
    ['SDNN', (s) => f(s.sdnn, 1, 'ms')],
    ['pNN50', (s) => f(s.pnn50, 1, '%')],
    ['ULF', (s) => f(s.ulf, 0, 'ms²')],
    ['VLF', (s) => f(s.vlf, 0, 'ms²')],
    ['LF', (s) => f(s.lf, 0, 'ms²')],
    ['HF', (s) => f(s.hf, 0, 'ms²')],
    ['LF/HF', (s) => f(s.lf_hf, 2)],
    ['LF n.u.', (s) => f(s.lf_nu, 1)],
    ['HF n.u.', (s) => f(s.hf_nu, 1)],
    [t('params.totalPower'), (s) => f(s.total_power, 0, 'ms²')],
    ['Baevsky SI', (s) => f(s.si, 0)],
    ['DFA α1', (s) => f(s.dfa_alpha1, 2)],
    ['DFA α2', (s) => f(s.dfa_alpha2, 2)],
    ['SD1 / SD2', (s) => `${f(s.sd1, 1)} / ${f(s.sd2, 1)}`],
  ]
  const sum = session.summary
  const series: Array<[string, SeriesHrv | null | undefined]> = [
    [m('series_full'), sum?.series?.full],
    [m('series_night'), sum?.series?.night],
    [m('series_day'), sum?.series?.day],
  ]
  const tr = sum?.advanced?.tracts
  const { profile, estimated } = effectiveProfile(session)
  const b = session.baseline_snapshot
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-anthracite-lighter leading-relaxed">{m('tract_note')}</p>
      <div className={`card ${print ? '' : 'overflow-x-auto'}`}>
        <table className={`w-full text-xs ${print ? '' : 'min-w-[420px]'}`}>
          <thead>
            <tr>
              <th className="px-3 py-2" />
              {series.map(([n]) => <th key={n} className="px-3 py-2 text-right font-extrabold" style={{ color: MON.accentDark }}>{n}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fn]) => (
              <tr key={label} className="border-t border-surface-border">
                <td className="px-3 py-1.5 text-anthracite-lighter">{label}</td>
                {series.map(([n, s]) => <td key={n} className="px-3 py-1.5 text-right font-bold text-anthracite tabular-nums">{s ? fn(s) : '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`grid gap-4 ${print ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}`}>
        <div className={`card p-4 ${print ? 'print-avoid' : ''}`}>
          <div className="text-[13px] font-bold text-anthracite mb-2">{m('meta')}</div>
          <Kv k={m('profile')} v={`${profileLabel(profile, locale)}${estimated ? ` * ${t('params.estimatedSuffix')}` : ''}`} />
          <Kv k={m('rr_total')} v={`${session.rr_count ?? '—'}`} />
          <Kv k={t('params.validCoverage')} v={t('params.validCoverageValue', { pct: session.valid_coverage_percentage == null ? '—' : Math.round(session.valid_coverage_percentage), count: session.windows.length })} />
          <Kv k={m('artifacts')} v={`${fmtNum(session.artifact_percentage, 1, locale)}%`} />
          <Kv k={t('params.signalQuality')} v={signalQualityLabel(session.signal_quality, t)} />
          <Kv k={m('irregular')} v={`${session.ectopic_count ?? 0}`} />
          <Kv k={m('gaps')} v={duration(sum?.gap_minutes ?? 0)} />
          <Kv k={t('params.uncovered')} v={duration(sum?.clock_shortfall_minutes ?? 0)} />
          {tr && <Kv k={m('tracts')} v={m('tracts_detail').replace('{n}', `${tr.count}`).replace('{longest}', duration(tr.longest_min)).replace('{total}', duration(tr.total_min))} />}
          <Kv k={t('params.source')} v={`${sourceLabel(session.source, t)}${session.device_name ? ` · ${session.device_name}` : ''}`} />
          <Kv k={m('algorithm')} v={session.algorithm_version || '—'} />
        </div>
        <div className={`card p-4 ${print ? 'print-avoid' : ''}`}>
          <div className="text-[13px] font-bold text-anthracite mb-2">{t('params.scaleTitle')}</div>
          <Kv k={t('params.hrRest')} v={f(sum?.hr_rest, 0, 'bpm')} />
          <Kv k={t('params.hrMax')} v={f(sum?.hr_max_used, 0, 'bpm')} />
          <Kv k={t('params.activityThreshold')} v={`> ${f(sum?.activity_threshold_hr, 0, 'bpm')}`} />
          <Kv k={t('params.lnRef')} v={f(sum?.ln_rmssd_reference, 2)} />
          <Kv k={t('params.lnMad')} v={f(sum?.ln_rmssd_mad, 3)} />
          <Kv k={t('params.hrMedian')} v={f(sum?.hr_median, 0, 'bpm')} />
          {b && <Kv k={t('params.baseline')} v={t('params.baselineValue', { applied: b.applied ? t('params.applied') : t('params.notApplied'), mean: fmtNum(b.mean, 2, locale), sd: fmtNum(b.sd, 2, locale) })} />}
        </div>
      </div>
    </div>
  )
}

export function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-xs">
      <span className="text-anthracite-lighter min-w-0">{k}</span>
      <span className="font-bold text-anthracite text-right">{v}</span>
    </div>
  )
}
