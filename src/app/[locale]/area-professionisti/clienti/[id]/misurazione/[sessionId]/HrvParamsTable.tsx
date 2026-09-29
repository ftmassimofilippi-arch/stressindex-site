import { useLocale, useTranslations } from 'next-intl'
import { num, toStr } from '@/lib/format'
import type { MeasurementAnalytics } from '@/lib/types'

// signal_quality è un'etichetta testuale ("good"|"fair"|"poor"), non un numero:
// va mostrata come tale, non passata a un formatter numerico. Le etichette
// vivono in `measurement.params.quality.<valore>`.
const SIGNAL_QUALITY_KEYS = new Set(['excellent', 'good', 'fair', 'poor'])

type GroupKey = 'time' | 'welch' | 'lomb' | 'nonlinear' | 'geometric' | 'quality'

// Le etichette dei parametri sono in `charts.metrics.<colonna>` (una sola
// fonte per tabella e trend); i titoli dei gruppi in `measurement.params.groups`.
const GROUPS: { key: GroupKey; fields: Array<{ key: keyof MeasurementAnalytics; unit?: string; digits?: number }> }[] = [
  {
    key: 'time',
    fields: [
      { key: 'mean_rr', unit: 'ms' },
      { key: 'sdnn', unit: 'ms' },
      { key: 'rmssd', unit: 'ms' },
      { key: 'pnn50', unit: '%' },
      { key: 'pnn20', unit: '%' },
      { key: 'cv', unit: '%' },
      { key: 'mean_hr', unit: 'bpm' },
      { key: 'sdnn_index', unit: 'ms' },
      { key: 'rmssd_sdnn_ratio', digits: 2 },
    ],
  },
  {
    key: 'welch',
    fields: [
      { key: 'vlf_power', unit: 'ms²' },
      { key: 'lf_power', unit: 'ms²' },
      { key: 'hf_power', unit: 'ms²' },
      { key: 'lf_hf_ratio', digits: 2 },
      { key: 'total_power', unit: 'ms²' },
      { key: 'lf_nu', unit: 'n.u.' },
      { key: 'hf_nu', unit: 'n.u.' },
      { key: 'lf_vlf_ratio', digits: 2 },
    ],
  },
  {
    key: 'lomb',
    fields: [
      { key: 'vlf_power_ls', unit: 'ms²' },
      { key: 'lf_power_ls', unit: 'ms²' },
      { key: 'hf_power_ls', unit: 'ms²' },
      { key: 'lf_hf_ratio_ls', digits: 2 },
      { key: 'total_power_ls', unit: 'ms²' },
      { key: 'lf_nu_ls', unit: 'n.u.' },
      { key: 'hf_nu_ls', unit: 'n.u.' },
    ],
  },
  {
    key: 'nonlinear',
    fields: [
      { key: 'sd1', unit: 'ms' },
      { key: 'sd2', unit: 'ms' },
      { key: 'sd1_sd2_ratio', digits: 2 },
      { key: 'dfa_alpha1', digits: 2 },
      { key: 'dfa_alpha2', digits: 2 },
      { key: 'sample_entropy', digits: 2 },
      { key: 'approximate_entropy', digits: 2 },
    ],
  },
  {
    key: 'geometric',
    fields: [
      { key: 'triangular_index', digits: 2 },
      { key: 'tinn', unit: 'ms' },
      { key: 'stress_index_baevsky', digits: 1 },
    ],
  },
  {
    key: 'quality',
    fields: [
      { key: 'artifact_percentage', unit: '%' },
      { key: 'ectopic_count', digits: 0 },
      { key: 'rr_count', digits: 0 },
    ],
  },
]

export function HrvParamsTable({ measurement }: { measurement: MeasurementAnalytics }) {
  const locale = useLocale()
  const t = useTranslations('measurement.params')
  const tMetrics = useTranslations('charts.metrics')

  const signalQualityLabel = (value: unknown): string => {
    const raw = toStr(value)
    if (!raw) return '—'
    const k = raw.toLowerCase()
    return SIGNAL_QUALITY_KEYS.has(k) ? t(`quality.${k}`) : raw
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {GROUPS.map((g) => (
        <div key={g.key}>
          <h4 className="text-xs font-medium uppercase tracking-wide text-anthracite-lighter mb-3">{t(`groups.${g.key}`)}</h4>
          <dl className="divide-y divide-surface-border">
            {g.fields.map((f) => {
              const v = measurement[f.key] as number | null | undefined
              return (
                <div key={String(f.key)} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <dt className="text-anthracite-lighter min-w-0">{tMetrics(String(f.key))}</dt>
                  <dd className="font-medium text-anthracite tabular-nums whitespace-nowrap">
                    {num(v, f.digits ?? 1, locale)} {f.unit ? <span className="text-anthracite-lighter text-xs ml-0.5">{f.unit}</span> : null}
                  </dd>
                </div>
              )
            })}
            {g.key === 'quality' && (
              <div className="flex items-center justify-between gap-3 py-2 text-sm">
                <dt className="text-anthracite-lighter">{t('signalQuality')}</dt>
                <dd className="font-medium text-anthracite">{signalQualityLabel(measurement.signal_quality)}</dd>
              </div>
            )}
          </dl>
        </div>
      ))}
    </div>
  )
}
