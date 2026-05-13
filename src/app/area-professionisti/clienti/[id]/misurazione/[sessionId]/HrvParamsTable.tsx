import { num } from '@/lib/format'
import type { Session } from '@/lib/types'

const GROUPS: { title: string; fields: Array<{ key: keyof Session; label: string; unit?: string; digits?: number }> }[] = [
  {
    title: 'Time Domain',
    fields: [
      { key: 'mean_rr', label: 'Mean RR', unit: 'ms' },
      { key: 'sdnn', label: 'SDNN', unit: 'ms' },
      { key: 'rmssd', label: 'RMSSD', unit: 'ms' },
      { key: 'pnn50', label: 'pNN50', unit: '%' },
      { key: 'cv', label: 'CV', unit: '%' },
      { key: 'bpm_mean', label: 'BPM medio', unit: 'bpm' },
    ],
  },
  {
    title: 'Frequency Domain',
    fields: [
      { key: 'vlf', label: 'VLF', unit: 'ms²' },
      { key: 'lf', label: 'LF', unit: 'ms²' },
      { key: 'hf', label: 'HF', unit: 'ms²' },
      { key: 'lf_hf_ratio', label: 'LF/HF', digits: 2 },
      { key: 'total_power', label: 'Total Power', unit: 'ms²' },
      { key: 'lf_nu', label: 'LFnu', unit: 'n.u.' },
      { key: 'hf_nu', label: 'HFnu', unit: 'n.u.' },
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
      { key: 'approx_entropy', label: 'Approx Entropy', digits: 2 },
    ],
  },
  {
    title: 'Geometric',
    fields: [
      { key: 'hrv_triangular_index', label: 'HRV Tri. Index', digits: 2 },
      { key: 'tinn', label: 'TINN', unit: 'ms' },
    ],
  },
]

export function HrvParamsTable({ session }: { session: Session }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <h4 className="text-xs font-medium uppercase tracking-wide text-anthracite-lighter mb-3">{g.title}</h4>
          <dl className="divide-y divide-surface-border">
            {g.fields.map((f) => {
              const v = session[f.key] as number | null | undefined
              return (
                <div key={String(f.key)} className="flex items-center justify-between py-2 text-sm">
                  <dt className="text-anthracite-lighter">{f.label}</dt>
                  <dd className="font-medium text-anthracite tabular-nums">
                    {num(v as number | null | undefined, f.digits ?? 1)} {f.unit ? <span className="text-anthracite-lighter text-xs ml-0.5">{f.unit}</span> : null}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
      ))}
    </div>
  )
}
