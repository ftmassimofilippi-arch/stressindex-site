import { useLocale, useTranslations } from 'next-intl'
import { intlTag, num, toStr } from '@/lib/format'
import { NORMATIVE_RANGES, paramsSummary, rangeStatus, type RangeStatus, type ReferenceRange } from '@/lib/hrv-reference-ranges'
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

// Colori del semaforo (stessa palette di GaugeScore / AppColors dell'app).
const STATUS_COLOR: Record<RangeStatus, string> = {
  in: '#2F8F6B',
  edge: '#C78A2C',
  out: '#C44E4E',
  none: '#E2E6EA',
}

// Estremi dell'intervallo senza decimali forzati ("20", "0,5", "0,85").
function rangeBounds(range: ReferenceRange, locale: string): { from: string; to: string } {
  const f = new Intl.NumberFormat(intlTag(locale), { maximumFractionDigits: 2 })
  return { from: f.format(range[0]), to: f.format(range[1]) }
}

function StatusDot({ status, title, print = false }: { status: RangeStatus; title: string; print?: boolean }) {
  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={`inline-block rounded-full flex-shrink-0 ${print ? 'w-2 h-2' : 'w-2.5 h-2.5'}`}
      style={{ backgroundColor: STATUS_COLOR[status] }}
    />
  )
}

export function HrvParamsTable({ measurement, print = false }: { measurement: MeasurementAnalytics; print?: boolean }) {
  const locale = useLocale()
  const t = useTranslations('measurement.params')
  const tMetrics = useTranslations('charts.metrics')

  const signalQualityLabel = (value: unknown): string => {
    const raw = toStr(value)
    if (!raw) return '—'
    const k = raw.toLowerCase()
    return SIGNAL_QUALITY_KEYS.has(k) ? t(`quality.${k}`) : raw
  }

  const rowCls = print
    ? 'flex items-center justify-between gap-2 py-1 text-[11px] break-inside-avoid'
    : 'flex items-center justify-between gap-3 py-2 text-sm'

  return (
    <div>
      <div className={`grid ${print ? 'grid-cols-2 gap-x-6 gap-y-3' : 'grid-cols-1 md:grid-cols-2 gap-6'}`}>
        {GROUPS.map((g) => (
          <div key={g.key} className={print ? 'break-inside-avoid' : undefined}>
            <h4 className={`text-xs font-medium uppercase tracking-wide text-anthracite-lighter ${print ? 'mb-1.5 text-[10px]' : 'mb-3'}`}>{t(`groups.${g.key}`)}</h4>
            <dl className="divide-y divide-surface-border">
              {g.fields.map((f) => {
                const key = String(f.key)
                const v = measurement[f.key] as number | null | undefined
                const range = NORMATIVE_RANGES[key] ?? null
                const status = rangeStatus(v, range)
                const bounds = range ? rangeBounds(range, locale) : null
                const statusLabel = t(`reference.status.${status}`)
                const title = bounds ? `${statusLabel} · ${t('reference.title', bounds)}` : statusLabel
                return (
                  <div key={key} className={rowCls}>
                    <dt className="text-anthracite-lighter min-w-0 truncate">{tMetrics(key)}</dt>
                    <dd className="flex items-center gap-2 whitespace-nowrap">
                      {bounds && (
                        <span
                          className={`text-anthracite-lighter tabular-nums ${print ? 'text-[9px]' : 'text-[10px]'}`}
                          title={t('reference.title', bounds)}
                        >
                          {bounds.from}–{bounds.to}
                        </span>
                      )}
                      <span className="font-medium text-anthracite tabular-nums">
                        {num(v, f.digits ?? 1, locale)} {f.unit ? <span className={`text-anthracite-lighter ml-0.5 ${print ? 'text-[9px]' : 'text-xs'}`}>{f.unit}</span> : null}
                      </span>
                      <StatusDot status={status} title={title} print={print} />
                    </dd>
                  </div>
                )
              })}
              {g.key === 'quality' && (
                <div className={rowCls}>
                  <dt className="text-anthracite-lighter">{t('signalQuality')}</dt>
                  <dd className="flex items-center gap-2 font-medium text-anthracite">
                    {signalQualityLabel(measurement.signal_quality)}
                    <StatusDot status="none" title={t('reference.status.none')} print={print} />
                  </dd>
                </div>
              )}
            </dl>
          </div>
        ))}
      </div>
      <p className={`text-anthracite-lighter ${print ? 'mt-2 text-[9px]' : 'mt-4 text-[11px]'}`}>{t('reference.legend')}</p>
    </div>
  )
}

// Card di riepilogo: quanti parametri (fra quelli con un intervallo di
// riferimento) sono nella norma, al limite o fuori range.
export function ParamsSummaryCard({ measurement, print = false }: { measurement: MeasurementAnalytics; print?: boolean }) {
  const t = useTranslations('measurement.params.summary')
  const s = paramsSummary(measurement)
  const tiles: Array<{ key: RangeStatus; count: number; label: string }> = [
    { key: 'in', count: s.inRange, label: t('inRange') },
    { key: 'edge', count: s.edge, label: t('edge') },
    { key: 'out', count: s.outOfRange, label: t('outOfRange') },
  ]
  const sentence = t('sentence', { inRange: s.inRange, edge: s.edge, outOfRange: s.outOfRange })

  return (
    <div className={`rounded-xl border border-surface-border bg-surface ${print ? 'p-3 break-inside-avoid' : 'p-4'}`}>
      <div className={`flex flex-wrap items-start justify-between gap-3 ${print ? 'gap-y-2' : ''}`}>
        <div className="min-w-0">
          <div className={`font-medium text-anthracite ${print ? 'text-xs' : 'text-sm'}`}>{t('title')}</div>
          <p className={`text-anthracite-lighter mt-0.5 ${print ? 'text-[10px]' : 'text-xs'}`}>{t('subtitle', { total: s.total })}</p>
          <p className="sr-only">{sentence}</p>
        </div>
        <div className="flex gap-2" aria-hidden>
          {tiles.map((tile) => (
            <div key={tile.key} className={`rounded-lg border border-surface-border bg-white text-center min-w-0 ${print ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
              <div className={`flex items-center justify-center gap-1.5 font-semibold text-anthracite tabular-nums ${print ? 'text-base' : 'text-xl'}`}>
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[tile.key] }} />
                {tile.count}
              </div>
              <div className={`text-anthracite-lighter whitespace-nowrap ${print ? 'text-[9px]' : 'text-[10px]'}`}>{tile.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
