'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Download } from 'lucide-react'
import { DataTable, type Column } from '@/components/dashboard/DataTable'
import { DateRangePicker, defaultRange, type DateRange } from '@/components/dashboard/DateRangePicker'
import { DownloadMeasurementPdfButton } from '@/components/dashboard/DownloadMeasurementPdfButton'
import { MeasurementTypeBadge } from '@/components/dashboard/MeasurementTypeBadge'
import { ScoreBar } from '@/components/dashboard/ScoreBar'
import { formatMeasuredAt, formatDate, num } from '@/lib/format'
import { normalizeTestType, measurementTypeLabel, ALL_MEASUREMENT_TYPE_META, type MeasurementTypeKey } from '@/lib/measurement-type'
import type { Client, MeasurementAnalytics } from '@/lib/types'
import { intervalloGiorniIta, measuredDayKey, measuredInstant, oggiIta } from '@/lib/format'
import { tagCounts, tagLabel } from '@/lib/before-after'
import { isFilterActive, matchesMeasurementFilter, type MeasurementFilter } from '@/lib/measurement-filter'
import { FilterChipRow } from '@/components/dashboard/SessionFilterChips'

const DURATION_FILTERS = ['all', '5', '10'] as const
type DurationFilter = typeof DURATION_FILTERS[number]

// Dal giorno della misurazione più vecchia a oggi (giorni italiani).
function fullRange(measurements: MeasurementAnalytics[]): DateRange {
  const giorni = measurements.map((m) => measuredDayKey(m)).filter((d): d is string => !!d).sort()
  const oggi = oggiIta()
  return { from: giorni[0] ?? oggi, to: oggi }
}

// Campo CSV: virgolette quando contiene separatori (le date formattate hanno
// la virgola in tutte le lingue).
function csvField(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Filtro per etichetta e tipo: arriva da ClientProfile, che lo tiene
// nell'URL, perché valga anche per il grafico della panoramica. Periodo e
// durata restano di questa scheda.
export function MeasurementsTab({ client, measurements, filter, onFilterChange, detailQs }: {
  client: Client
  measurements: MeasurementAnalytics[]
  filter: MeasurementFilter
  onFilterChange: (next: Partial<MeasurementFilter>) => void
  /** Query per i link al dettaglio (professionista, scheda, filtro). */
  detailQs: string
}) {
  const t = useTranslations('clients.measurements')
  const tScores = useTranslations('scores')
  const tTags = useTranslations('common.tags')
  const tTypes = useTranslations('measurement.types')
  const locale = useLocale()
  // Periodo di default: tutto lo storico finché le misurazioni sono poche
  // (sotto 50), altrimenti gli ultimi 90 giorni. Prima partiva sempre da 90
  // giorni e l'intestazione "Misurazioni 2" non tornava con la riga sola in tabella.
  const [range, setRange] = useState<DateRange>(() => (measurements.length < 50 ? fullRange(measurements) : defaultRange(90)))
  const [duration, setDuration] = useState<DurationFilter>('all')

  // Misurazioni nel periodo e nella durata scelti: i chip contano su queste.
  const inPeriod = useMemo(() => {
    // Estremi a mezzanotte ITALIANA: con la mezzanotte UTC le misurazioni
    // serali cadevano nel giorno dopo e uscivano dal periodo selezionato.
    const { fromIso, toIso } = intervalloGiorniIta(range.from, range.to)
    const fromMs = new Date(fromIso).getTime()
    const toMs = new Date(toIso).getTime()
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
    () => Array.from(tagCounts(inPeriod).entries()).map(([value, count]) => ({ value, label: tagLabel(value, tTags), count })),
    [inPeriod, tTags],
  )
  const typeOptions = useMemo(() => {
    const counts = new Map<MeasurementTypeKey, number>()
    for (const m of inPeriod) {
      const k = normalizeTestType(m.test_type)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return ALL_MEASUREMENT_TYPE_META.map((meta) => ({
      value: meta.key,
      label: measurementTypeLabel(meta.key, tTypes),
      count: counts.get(meta.key) ?? 0,
      color: meta.dotColor,
    }))
  }, [inPeriod, tTypes])

  const filtered = useMemo(
    () => inPeriod.filter((m) => matchesMeasurementFilter(m, filter)),
    [inPeriod, filter],
  )

  function exportCsv() {
    // Intestazioni tradotte; i valori numerici restano grezzi (punto decimale).
    const headers = [
      t('colDate'), t('colType'), t('colDurationSeconds'),
      tScores('names.stress'), tScores('names.recovery'), tScores('names.balance'), tScores('names.energy'), tScores('names.adaptation'),
      t('colBpm'), 'SDNN', 'RMSSD', t('colArtifactPct'),
    ]
    const rows = filtered.map((m) => [
      formatMeasuredAt(m, locale),
      measurementTypeLabel(m.test_type, tTypes),
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
    ].map(csvField).join(','))
    const csv = [headers.map(csvField).join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${t('csvFilePrefix')}-${client.cognome ?? client.id}-${formatDate(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const columns: Column<MeasurementAnalytics>[] = [
    // Si ordina sull'ISTANTE, non sulla colonna grezza: quella è la forma
    // legacy e il confronto fra stringhe mescolava le due convenzioni.
    { key: 'measured_at', header: t('colDate'), accessor: (m) => measuredInstant(m)?.getTime() ?? 0, sortable: true, render: (m) => formatMeasuredAt(m, locale) },
    { key: 'type', header: t('colType'), accessor: (m) => measurementTypeLabel(m.test_type, tTypes), sortable: true, render: (m) => <MeasurementTypeBadge testType={m.test_type} size="sm" /> },
    { key: 'duration', header: t('colDuration'), accessor: (m) => m.duration_seconds ?? 0, sortable: true, render: (m) => m.duration_seconds ? t('durationMin', { n: Math.round(m.duration_seconds / 60) }) : '—' },
    { key: 'stress', header: tScores('names.stress'), accessor: (m) => m.score_stress ?? -1, sortable: true, render: (m) => <ScoreBar value={m.score_stress} inverted /> },
    { key: 'recupero', header: tScores('names.recovery'), accessor: (m) => m.score_recupero ?? -1, sortable: true, render: (m) => <ScoreBar value={m.score_recupero} /> },
    { key: 'equilibrio', header: tScores('names.balance'), accessor: (m) => m.score_equilibrio ?? -1, sortable: true, render: (m) => <ScoreBar value={m.score_equilibrio} /> },
    { key: 'energia', header: tScores('names.energy'), accessor: (m) => m.score_energia ?? -1, sortable: true, render: (m) => <ScoreBar value={m.score_energia} /> },
    // Colonna DB score_modulazione_infiammatoria, mostrata come "Adattamento".
    { key: 'adattamento', header: tScores('names.adaptation'), accessor: (m) => m.score_modulazione_infiammatoria ?? -1, sortable: true, render: (m) => num(m.score_modulazione_infiammatoria, 0, locale) },
    { key: 'quality', header: t('colArtifact'), accessor: (m) => m.artifact_percentage ?? -1, sortable: true, render: (m) => m.artifact_percentage != null ? `${num(m.artifact_percentage, 1, locale)}%` : '—' },
    {
      key: 'actions', header: '', noLink: true, sticky: true, render: (m) => (
        <div className="flex items-center gap-1 justify-end">
          <DownloadMeasurementPdfButton sessionId={m.session_id} clientId={client.id} variant="icon" />
          <Link href={`/area-professionisti/clienti/${client.id}/misurazione/${m.session_id}${detailQs}`} className="text-teal-dark text-sm hover:underline whitespace-nowrap">{t('open')}</Link>
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
            onChange={(e) => setDuration(e.target.value as DurationFilter)}
            className="px-3 py-2 text-sm bg-white border border-surface-border rounded-xl"
          >
            {DURATION_FILTERS.map((d) => (
              <option key={d} value={d}>{d === 'all' ? t('allDurations') : t('durationMin', { n: Number(d) })}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={exportCsv} className="btn-secondary text-sm inline-flex items-center gap-1.5">
          <Download size={15} /> {t('exportCsv')}
        </button>
      </div>
      {inPeriod.length < measurements.length && (
        <p className="text-xs text-anthracite-lighter flex flex-wrap items-center gap-x-2" aria-live="polite">
          <span>{t('showingOf', { shown: inPeriod.length, total: measurements.length, from: formatDate(range.from, undefined, locale), to: formatDate(range.to, undefined, locale) })}</span>
          <button type="button" onClick={() => setRange(fullRange(measurements))} className="text-teal-dark font-medium hover:underline">
            {t('showAll')}
          </button>
        </p>
      )}
      <div className="space-y-2">
        <FilterChipRow allLabel={t('allTags')} total={inPeriod.length} options={tagOptions} selected={filter.tag} onChange={(v) => onFilterChange({ tag: v })} />
        <FilterChipRow allLabel={t('allTests')} total={inPeriod.length} options={typeOptions} selected={filter.tipo} onChange={(v) => onFilterChange({ tipo: v as MeasurementTypeKey | null })} />
      </div>
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(m) => m.id}
        rowHref={(m) => `/area-professionisti/clienti/${client.id}/misurazione/${m.session_id}${detailQs}`}
        initialSort={{ key: 'measured_at', dir: 'desc' }}
        emptyState={<div className="card p-10 text-center text-sm text-anthracite-lighter">{isFilterActive(filter) ? t('emptyFiltered') : t('emptyPeriod')}</div>}
      />
    </div>
  )
}
