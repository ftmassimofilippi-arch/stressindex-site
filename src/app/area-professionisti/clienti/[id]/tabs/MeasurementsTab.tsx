'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { DataTable, type Column } from '@/components/dashboard/DataTable'
import { DateRangePicker, defaultRange, type DateRange } from '@/components/dashboard/DateRangePicker'
import { ScoreBar } from '@/components/dashboard/ScoreBar'
import { formatDateTime, formatDate } from '@/lib/format'
import type { Client, Session } from '@/lib/types'

const DURATION_FILTERS = [
  { value: 'all', label: 'Tutte le durate' },
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
] as const

export function MeasurementsTab({ client, sessions }: { client: Client; sessions: Session[] }) {
  const [range, setRange] = useState<DateRange>(defaultRange(90))
  const [duration, setDuration] = useState<typeof DURATION_FILTERS[number]['value']>('all')

  const filtered = useMemo(() => {
    const fromMs = new Date(range.from).getTime()
    const toMs = new Date(range.to).getTime() + 24 * 3600 * 1000
    return sessions.filter((s) => {
      const t = new Date(s.created_at).getTime()
      if (t < fromMs || t > toMs) return false
      if (duration !== 'all') {
        const d = (s.duration_seconds ?? 0) / 60
        const target = Number(duration)
        if (Math.abs(d - target) > 1.5) return false
      }
      return true
    })
  }, [sessions, range, duration])

  function exportCsv() {
    const headers = ['Data','Durata (s)','Stress','Recupero','Equilibrio','Energia','Mod. Infiamm.','BPM','SDNN','RMSSD','Quality']
    const rows = filtered.map((s) => [
      formatDateTime(s.created_at),
      s.duration_seconds ?? '',
      s.stress_score ?? '',
      s.recovery_score ?? '',
      s.balance_score ?? '',
      s.energy_score ?? '',
      s.inflammatory_modulation ?? '',
      s.bpm_mean ?? '',
      s.sdnn ?? '',
      s.rmssd ?? '',
      s.signal_quality ?? '',
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

  const columns: Column<Session>[] = [
    { key: 'created_at', header: 'Data', accessor: (s) => s.created_at, sortable: true, render: (s) => formatDateTime(s.created_at) },
    { key: 'duration', header: 'Durata', accessor: (s) => s.duration_seconds ?? 0, sortable: true, render: (s) => s.duration_seconds ? `${Math.round(s.duration_seconds / 60)} min` : '—' },
    { key: 'stress', header: 'Stress', accessor: (s) => s.stress_score ?? -1, sortable: true, render: (s) => <ScoreBar value={s.stress_score} inverted /> },
    { key: 'recovery', header: 'Recupero', accessor: (s) => s.recovery_score ?? -1, sortable: true, render: (s) => <ScoreBar value={s.recovery_score} /> },
    { key: 'balance', header: 'Equilibrio', accessor: (s) => s.balance_score ?? -1, sortable: true, render: (s) => <ScoreBar value={s.balance_score} /> },
    { key: 'energy', header: 'Energia', accessor: (s) => s.energy_score ?? -1, sortable: true, render: (s) => <ScoreBar value={s.energy_score} /> },
    { key: 'infl', header: 'Infiamm.', accessor: (s) => s.inflammatory_modulation ?? -1, sortable: true, render: (s) => s.inflammatory_modulation != null ? s.inflammatory_modulation.toFixed(1) : '—' },
    { key: 'quality', header: 'Qualità', accessor: (s) => s.signal_quality ?? -1, sortable: true, render: (s) => s.signal_quality != null ? `${Math.round(s.signal_quality)}%` : '—' },
    {
      key: 'actions', header: '', render: (s) => (
        <Link href={`/area-professionisti/clienti/${client.id}/misurazione/${s.id}`} className="text-teal-dark text-sm hover:underline">Apri →</Link>
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
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(s) => s.id}
        initialSort={{ key: 'created_at', dir: 'desc' }}
        emptyState={<div className="card p-10 text-center text-sm text-anthracite-lighter">Nessuna misurazione nel periodo selezionato</div>}
      />
    </div>
  )
}
