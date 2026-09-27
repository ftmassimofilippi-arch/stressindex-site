'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { DataTable, type Column } from '@/components/dashboard/DataTable'
import { DateRangePicker, defaultRange, type DateRange } from '@/components/dashboard/DateRangePicker'
import { DownloadMeasurementPdfButton } from '@/components/dashboard/DownloadMeasurementPdfButton'
import { MeasurementTypeBadge } from '@/components/dashboard/MeasurementTypeBadge'
import { ScoreBar } from '@/components/dashboard/ScoreBar'
import { formatMeasuredAt, formatDate } from '@/lib/format'
import { normalizeTestType, measurementTypeMeta, ALL_MEASUREMENT_TYPE_META, type MeasurementTypeKey } from '@/lib/measurement-type'
import type { Client, MeasurementAnalytics } from '@/lib/types'
import { measuredInstant } from '@/lib/format'
import { rowHasTag, tagCounts, tagLabel } from '@/lib/before-after'
import { FilterChipRow } from '@/components/dashboard/SessionFilterChips'

const DURATION_FILTERS = [
  { value: 'all', label: 'Tutte le durate' },
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
] as const

export function MeasurementsTab({ client, measurements, professionistaId }: { client: Client; measurements: MeasurementAnalytics[]; professionistaId?: string }) {
  const qs = professionistaId ? `?professionista=${professionistaId}` : ''
  const [range, setRange] = useState<DateRange>(defaultRange(90))
  const [duration, setDuration] = useState<typeof DURATION_FILTERS[number]['value']>('all')
  const [typeFilter, setTypeFilter] = useState<MeasurementTypeKey | null>(null)
  // Filtro per etichetta (chiave neutra, vedi normalizeTagKey): combinabile
  // con il tipo, con i conteggi sui chip. Stessa logica dell'app.
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  // Misurazioni nel periodo e nella durata scelti: i chip contano su queste.
  const inPeriod = useMemo(() => {
    const fromMs = new Date(range.from).getTime()
    const toMs = new Date(range.to).getTime() + 24 * 3600 * 1000
    return measurements.filter((m) => {
      const t = measuredInstant(m)?.getTime() ?? 0
      if (t < fromMs || t > toMs) return false
      if (duration !== 'all') {
        const d = (m.duration_seconds ?? 0) / 60
        const target = Number(duration)
        if (Math.abs(d - target) > 1.5) return false
      }
      return true
    })
  }, [measurements, range, duration])

  const tagOptions = useMemo(
    () => Array.from(tagCounts(inPeriod).entries()).map(([value, count]) => ({ value, label: tagLabel(value), count })),
    [inPeriod],
  )
  const typeOptions = useMemo(() => {
    const counts = new Map<MeasurementTypeKey, number>()
    for (const m of inPeriod) {
      const k = normalizeTestType(m.test_type)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return ALL_MEASUREMENT_TYPE_META.map((meta) => ({
      value: meta.key,
      label: meta.label,
      count: counts.get(meta.key) ?? 0,
      color: meta.dotColor,
    }))
  }, [inPeriod])

  const filtered = useMemo(
    () =>
      inPeriod.filter((m) => {
        if (typeFilter && normalizeTestType(m.test_type) !== typeFilter) return false
        if (tagFilter && !rowHasTag(m, tagFilter)) return false
        return true
      }),
    [inPeriod, typeFilter, tagFilter],
  )

  function exportCsv() {
    const headers = ['Data','Tipo','Durata (s)','Stress','Recupero','Equilibrio','Energia','Adattamento','BPM','SDNN','RMSSD','Artifact %']
    const rows = filtered.map((m) => [
      formatMeasuredAt(m),
      measurementTypeMeta(m.test_type).label,
      m.duration_seconds ?? '',
      m.score_stress ?? '',
      m.score_recupero ?? '',
      m.score_equilibrio ?? '',
      m.score_energia ?? '',
      m.score_modulazione_infiammatoria ?? '',
      m.mean_hr ?? '',
      m.sdnn ?? '',
      m.rmssd ?? '',
      m.artifact_percentage ?? '',
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `misurazioni-${client.cognome ?? client.id}-${formatDate(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const columns: Column<MeasurementAnalytics>[] = [
    { key: 'measured_at', header: 'Data', accessor: (m) => m.measured_at, sortable: true, render: (m) => formatMeasuredAt(m) },
    { key: 'type', header: 'Tipo', accessor: (m) => measurementTypeMeta(m.test_type).label, sortable: true, render: (m) => <MeasurementTypeBadge testType={m.test_type} size="sm" /> },
    { key: 'duration', header: 'Durata', accessor: (m) => m.duration_seconds ?? 0, sortable: true, render: (m) => m.duration_seconds ? `${Math.round(m.duration_seconds / 60)} min` : '—' },
    { key: 'stress', header: 'Stress', accessor: (m) => m.score_stress ?? -1, sortable: true, render: (m) => <ScoreBar value={m.score_stress} inverted /> },
    { key: 'recupero', header: 'Recupero', accessor: (m) => m.score_recupero ?? -1, sortable: true, render: (m) => <ScoreBar value={m.score_recupero} /> },
    { key: 'equilibrio', header: 'Equilibrio', accessor: (m) => m.score_equilibrio ?? -1, sortable: true, render: (m) => <ScoreBar value={m.score_equilibrio} /> },
    { key: 'energia', header: 'Energia', accessor: (m) => m.score_energia ?? -1, sortable: true, render: (m) => <ScoreBar value={m.score_energia} /> },
    // Colonna DB score_modulazione_infiammatoria, mostrata come "Adattamento".
    { key: 'adattamento', header: 'Adattamento', accessor: (m) => m.score_modulazione_infiammatoria ?? -1, sortable: true, render: (m) => m.score_modulazione_infiammatoria != null ? m.score_modulazione_infiammatoria.toFixed(1) : '—' },
    { key: 'quality', header: 'Artifact', accessor: (m) => m.artifact_percentage ?? -1, sortable: true, render: (m) => m.artifact_percentage != null ? `${m.artifact_percentage.toFixed(1)}%` : '—' },
    {
      key: 'actions', header: '', render: (m) => (
        <div className="flex items-center gap-1 justify-end">
          <DownloadMeasurementPdfButton sessionId={m.session_id} clientId={client.id} variant="icon" />
          <Link href={`/area-professionisti/clienti/${client.id}/misurazione/${m.session_id}${qs}`} className="text-teal-dark text-sm hover:underline">Apri →</Link>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker value={range} onChange={setRange} />
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value as typeof duration)}
            className="px-3 py-2 text-sm bg-white border border-surface-border rounded-xl"
          >
            {DURATION_FILTERS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <button type="button" onClick={exportCsv} className="btn-secondary text-sm inline-flex items-center gap-1.5">
          <Download size={15} /> Esporta CSV
        </button>
      </div>
      <div className="space-y-2">
        <FilterChipRow allLabel="Tutte le etichette" total={inPeriod.length} options={tagOptions} selected={tagFilter} onChange={setTagFilter} />
        <FilterChipRow allLabel="Tutti i test" total={inPeriod.length} options={typeOptions} selected={typeFilter} onChange={(v) => setTypeFilter(v as MeasurementTypeKey | null)} />
      </div>
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(m) => m.id}
        initialSort={{ key: 'measured_at', dir: 'desc' }}
        emptyState={<div className="card p-10 text-center text-sm text-anthracite-lighter">{tagFilter || typeFilter ? 'Nessuna misurazione con questi filtri' : 'Nessuna misurazione nel periodo selezionato'}</div>}
      />
    </div>
  )
}
