'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { DataTable, type Column } from '@/components/dashboard/DataTable'
import { ScoreBar } from '@/components/dashboard/ScoreBar'
import { CountBadge } from '@/components/dashboard/AlertBadge'
import { age, fullName, initials, formatRelative } from '@/lib/format'
import type { ClientWithLastSession } from '@/lib/dashboard-data'
import { useRouter } from 'next/navigation'

type Props = { clients: ClientWithLastSession[] }

const FILTER_PERIODS = [
  { value: 'all', label: 'Tutti' },
  { value: 'today', label: 'Oggi' },
  { value: '7d', label: 'Ultimi 7 giorni' },
  { value: '30d', label: 'Ultimi 30 giorni' },
  { value: 'never', label: 'Mai' },
] as const

export function ClientsTable({ clients }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<string>('')
  const [periodFilter, setPeriodFilter] = useState<typeof FILTER_PERIODS[number]['value']>('all')

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const c of clients) for (const t of (c.settings?.tags ?? [])) set.add(t)
    return Array.from(set).sort()
  }, [clients])

  const filtered = useMemo(() => {
    const now = Date.now()
    const dayMs = 24 * 3600 * 1000
    return clients.filter((c) => {
      if (search) {
        const s = search.toLowerCase()
        const hay = `${c.nome ?? ''} ${c.cognome ?? ''} ${c.email ?? ''}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      if (tagFilter) {
        if (!(c.settings?.tags ?? []).includes(tagFilter)) return false
      }
      if (periodFilter !== 'all') {
        const last = c.last_measurement_at ? new Date(c.last_measurement_at).getTime() : null
        if (periodFilter === 'never') return last == null
        if (last == null) return false
        const ms = now - last
        if (periodFilter === 'today' && ms > dayMs) return false
        if (periodFilter === '7d' && ms > 7 * dayMs) return false
        if (periodFilter === '30d' && ms > 30 * dayMs) return false
      }
      return true
    })
  }, [clients, search, tagFilter, periodFilter])

  const columns: Column<ClientWithLastSession>[] = [
    {
      key: 'name',
      header: 'Cliente',
      accessor: (c) => fullName(c).toLowerCase(),
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-teal-light text-teal-dark flex items-center justify-center text-xs font-semibold flex-shrink-0">
            {initials(c)}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-anthracite truncate">{fullName(c) || 'Senza nome'}</div>
            <div className="text-xs text-anthracite-lighter truncate">{c.email ?? ''}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'age',
      header: 'Età',
      accessor: (c) => age(c.data_nascita) ?? 0,
      sortable: true,
      render: (c) => <span className="text-anthracite-lighter">{age(c.data_nascita) ?? '—'}</span>,
    },
    {
      key: 'tags',
      header: 'Tag',
      render: (c) => (
        <div className="flex flex-wrap gap-1">
          {(c.settings?.tags ?? []).slice(0, 3).map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full text-[11px] bg-teal-light text-teal-dark">{t}</span>
          ))}
        </div>
      ),
    },
    {
      key: 'last',
      header: 'Ultima misurazione',
      accessor: (c) => c.last_measurement_at ?? '',
      sortable: true,
      render: (c) => (
        <span className="text-anthracite-lighter text-sm">
          {c.last_measurement_at ? formatRelative(c.last_measurement_at) : 'Mai'}
        </span>
      ),
    },
    {
      key: 'stress',
      header: 'Stress',
      accessor: (c) => c.lastSession?.stress_score ?? -1,
      sortable: true,
      render: (c) => <ScoreBar value={c.lastSession?.stress_score} inverted />,
    },
    {
      key: 'alerts',
      header: 'Alert',
      accessor: (c) => c.activeAlerts ?? 0,
      sortable: true,
      render: (c) => (c.activeAlerts ? <CountBadge count={c.activeAlerts} /> : <span className="text-anthracite-lighter text-xs">—</span>),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-anthracite-lighter" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome, cognome, email…"
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
          />
        </div>
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="px-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30"
          >
            <option value="">Tutti i tag</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value as typeof periodFilter)}
          className="px-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30"
        >
          {FILTER_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.id}
        onRowClick={(c) => router.push(`/area-professionisti/clienti/${c.id}`)}
        initialSort={{ key: 'last', dir: 'desc' }}
      />
    </div>
  )
}
