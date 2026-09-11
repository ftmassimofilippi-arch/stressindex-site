import type { Monitoring24hSession, SeriesHrv } from '@/lib/monitoring-types'
import { MON, PROFILE_LABEL, duration, effectiveProfile, fx, signalQualityLabel, sourceLabel } from '@/lib/monitoring-format'

// Pagina "Parametri" (solo professionista): tabella intera / notte / giorno
// con i parametri HRV calcolati dall'app nei tratti continui, la sezione
// Registrazione e la scala individuale usata per la classificazione.

const ROWS: Array<[string, (s: SeriesHrv) => string]> = [
  ['Durata (nei tratti)', (s) => duration(s.minutes)],
  ['Battiti', (s) => `${s.rr_count}`],
  ['Tratti continui', (s) => (s.tracts == null ? '—' : `${s.tracts}`)],
  ['HR media', (s) => fx(s.mean_hr, 0, 'bpm')],
  ['RMSSD', (s) => fx(s.rmssd, 1, 'ms')],
  ['SDNN', (s) => fx(s.sdnn, 1, 'ms')],
  ['pNN50', (s) => fx(s.pnn50, 1, '%')],
  ['ULF', (s) => fx(s.ulf, 0, 'ms²')],
  ['VLF', (s) => fx(s.vlf, 0, 'ms²')],
  ['LF', (s) => fx(s.lf, 0, 'ms²')],
  ['HF', (s) => fx(s.hf, 0, 'ms²')],
  ['LF/HF', (s) => fx(s.lf_hf, 2)],
  ['LF n.u.', (s) => fx(s.lf_nu, 1)],
  ['HF n.u.', (s) => fx(s.hf_nu, 1)],
  ['Potenza totale', (s) => fx(s.total_power, 0, 'ms²')],
  ['Baevsky SI', (s) => fx(s.si, 0)],
  ['DFA α1', (s) => fx(s.dfa_alpha1, 2)],
  ['DFA α2', (s) => fx(s.dfa_alpha2, 2)],
  ['SD1 / SD2', (s) => `${fx(s.sd1, 1)} / ${fx(s.sd2, 1)}`],
]

export function MonitoringParamsTable({ session }: { session: Monitoring24hSession }) {
  const sum = session.summary
  const series: Array<[string, SeriesHrv | null | undefined]> = [
    ['Intera', sum?.series?.full],
    ['Notte', sum?.series?.night],
    ['Giorno', sum?.series?.day],
  ]
  const tr = sum?.advanced?.tracts
  const { profile, estimated } = effectiveProfile(session)
  const b = session.baseline_snapshot
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-anthracite-lighter leading-relaxed">
        Tutti i parametri sono calcolati SOLO dentro i tratti continui (nessuna interruzione oltre 3 s) di almeno 5 minuti e riportati come media pesata sulla durata dei tratti. Un trattino significa che nessun tratto era abbastanza lungo.
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full text-xs min-w-[420px]">
          <thead>
            <tr>
              <th className="px-3 py-2" />
              {series.map(([n]) => <th key={n} className="px-3 py-2 text-right font-extrabold" style={{ color: MON.accentDark }}>{n}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, fn]) => (
              <tr key={label} className="border-t border-surface-border">
                <td className="px-3 py-1.5 text-anthracite-lighter">{label}</td>
                {series.map(([n, s]) => <td key={n} className="px-3 py-1.5 text-right font-bold text-anthracite tabular-nums">{s ? fn(s) : '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-[13px] font-bold text-anthracite mb-2">Registrazione</div>
          <Kv k="Profilo" v={`${PROFILE_LABEL[profile]}${estimated ? ' * (stimato)' : ''}`} />
          <Kv k="RR totali" v={`${session.rr_count ?? '—'}`} />
          <Kv k="Dati validi (copertura)" v={`${session.valid_coverage_percentage == null ? '—' : Math.round(session.valid_coverage_percentage)}% di ${session.windows.length} finestre`} />
          <Kv k="Artefatti (grezzo)" v={`${session.artifact_percentage?.toFixed(1) ?? '—'}%`} />
          <Kv k="Qualità del segnale" v={signalQualityLabel(session.signal_quality)} />
          <Kv k="Battiti irregolari (pattern)" v={`${session.ectopic_count ?? 0}`} />
          <Kv k="Buchi (fascia staccata)" v={duration(sum?.gap_minutes ?? 0)} />
          <Kv k="Tempo non coperto" v={duration(sum?.clock_shortfall_minutes ?? 0)} />
          {tr && <Kv k="Tratti continui" v={`${tr.count} · più lungo ${duration(tr.longest_min)} · totale ${duration(tr.total_min)}`} />}
          <Kv k="Sorgente" v={`${sourceLabel(session.source)}${session.device_name ? ` · ${session.device_name}` : ''}`} />
          <Kv k="Algoritmo" v={session.algorithm_version || '—'} />
        </div>
        <div className="card p-4">
          <div className="text-[13px] font-bold text-anthracite mb-2">Scala individuale usata</div>
          <Kv k="HR a riposo (5° percentile)" v={fx(sum?.hr_rest, 0, 'bpm')} />
          <Kv k="HR max usata" v={fx(sum?.hr_max_used, 0, 'bpm')} />
          <Kv k="Soglia attività" v={`> ${fx(sum?.activity_threshold_hr, 0, 'bpm')}`} />
          <Kv k="Riferimento ln RMSSD" v={fx(sum?.ln_rmssd_reference, 2)} />
          <Kv k="MAD ln RMSSD (scalata)" v={fx(sum?.ln_rmssd_mad, 3)} />
          <Kv k="Mediana HR (non attività)" v={fx(sum?.hr_median, 0, 'bpm')} />
          {b && <Kv k="Baseline" v={`${b.applied ? 'applicata' : 'non applicata'} · media ${b.mean.toFixed(2)} · SD ${b.sd.toFixed(2)}`} />}
        </div>
      </div>
    </div>
  )
}

export function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-xs">
      <span className="text-anthracite-lighter">{k}</span>
      <span className="font-bold text-anthracite text-right">{v}</span>
    </div>
  )
}
