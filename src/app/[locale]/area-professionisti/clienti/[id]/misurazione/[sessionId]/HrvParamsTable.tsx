import { num, toStr } from '@/lib/format'
import type { MeasurementAnalytics } from '@/lib/types'

// signal_quality è un'etichetta testuale ("good"|"fair"|"poor"), non un numero:
// va mostrata come tale, non passata a un formatter numerico.
const SIGNAL_QUALITY_LABEL: Record<string, string> = {
  excellent: 'Ottima',
  good: 'Buona',
  fair: 'Discreta',
  poor: 'Scarsa',
}

function signalQualityLabel(value: unknown): string {
  const raw = toStr(value)
  if (!raw) return '—'
  return SIGNAL_QUALITY_LABEL[raw.toLowerCase()] ?? raw
}

const GROUPS: { title: string; fields: Array<{ key: keyof MeasurementAnalytics; label: string; unit?: string; digits?: number }> }[] = [
  {
    title: 'Time Domain',
    fields: [
      { key: 'mean_rr', label: 'Mean RR', unit: 'ms' },
      { key: 'sdnn', label: 'SDNN', unit: 'ms' },
      { key: 'rmssd', label: 'RMSSD', unit: 'ms' },
      { key: 'pnn50', label: 'pNN50', unit: '%' },
      { key: 'pnn20', label: 'pNN20', unit: '%' },
      { key: 'cv', label: 'CV', unit: '%' },
      { key: 'mean_hr', label: 'BPM medio', unit: 'bpm' },
      { key: 'sdnn_index', label: 'SDNN Index', unit: 'ms' },
      { key: 'rmssd_sdnn_ratio', label: 'RMSSD/SDNN', digits: 2 },
    ],
  },
  {
    title: 'Frequency Domain (Welch)',
    fields: [
      { key: 'vlf_power', label: 'VLF', unit: 'ms²' },
      { key: 'lf_power', label: 'LF', unit: 'ms²' },
      { key: 'hf_power', label: 'HF', unit: 'ms²' },
      { key: 'lf_hf_ratio', label: 'LF/HF', digits: 2 },
      { key: 'total_power', label: 'Total Power', unit: 'ms²' },
      { key: 'lf_nu', label: 'LFnu', unit: 'n.u.' },
      { key: 'hf_nu', label: 'HFnu', unit: 'n.u.' },
      { key: 'lf_vlf_ratio', label: 'LF/VLF', digits: 2 },
    ],
  },
  {
    title: 'Frequency Domain (Lomb-Scargle)',
    fields: [
      { key: 'vlf_power_ls', label: 'VLF LS', unit: 'ms²' },
      { key: 'lf_power_ls', label: 'LF LS', unit: 'ms²' },
      { key: 'hf_power_ls', label: 'HF LS', unit: 'ms²' },
      { key: 'lf_hf_ratio_ls', label: 'LF/HF LS', digits: 2 },
      { key: 'total_power_ls', label: 'Total LS', unit: 'ms²' },
      { key: 'lf_nu_ls', label: 'LFnu LS', unit: 'n.u.' },
      { key: 'hf_nu_ls', label: 'HFnu LS', unit: 'n.u.' },
    ],
  },
  {
    title: 'Non-linear',
    fields: [
      { key: 'sd1', label: 'SD1', unit: 'ms' },
      { key: 'sd2', label: 'SD2', unit: 'ms' },
      { key: 'sd1_sd2_ratio', label: 'SD1/SD2', digits: 2 },
      { key: 'dfa_alpha1', label: 'DFA α1', digits: 2 },
      { key: 'dfa_alpha2', label: 'DFA α2', digits: 2 },
      { key: 'sample_entropy', label: 'Sample Entropy', digits: 2 },
      { key: 'approximate_entropy', label: 'Approx Entropy', digits: 2 },
    ],
  },
  {
    title: 'Geometric & Baevsky',
    fields: [
      { key: 'triangular_index', label: 'Triangular Index', digits: 2 },
      { key: 'tinn', label: 'TINN', unit: 'ms' },
      { key: 'stress_index_baevsky', label: 'Baevsky SI', digits: 1 },
    ],
  },
  {
    title: 'Qualità del segnale',
    fields: [
      { key: 'artifact_percentage', label: 'Artefatti', unit: '%' },
      { key: 'ectopic_count', label: 'Battiti ectopici', digits: 0 },
      { key: 'rr_count', label: 'Intervalli RR', digits: 0 },
    ],
  },
]

export function HrvParamsTable({ measurement }: { measurement: MeasurementAnalytics }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <h4 className="text-xs font-medium uppercase tracking-wide text-anthracite-lighter mb-3">{g.title}</h4>
          <dl className="divide-y divide-surface-border">
            {g.fields.map((f) => {
              const v = measurement[f.key] as number | null | undefined
              return (
                <div key={String(f.key)} className="flex items-center justify-between py-2 text-sm">
                  <dt className="text-anthracite-lighter">{f.label}</dt>
                  <dd className="font-medium text-anthracite tabular-nums">
                    {num(v, f.digits ?? 1)} {f.unit ? <span className="text-anthracite-lighter text-xs ml-0.5">{f.unit}</span> : null}
                  </dd>
                </div>
              )
            })}
            {g.title === 'Qualità del segnale' && (
              <div className="flex items-center justify-between py-2 text-sm">
                <dt className="text-anthracite-lighter">Qualità segnale</dt>
                <dd className="font-medium text-anthracite">{signalQualityLabel(measurement.signal_quality)}</dd>
              </div>
            )}
          </dl>
        </div>
      ))}
    </div>
  )
}
