'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { DataTable, type Column } from '@/components/dashboard/DataTable'
import { ScoreBar } from '@/components/dashboard/ScoreBar'
import { CountBadge } from '@/components/dashboard/AlertBadge'
import { age, fullName, initials, formatRelative } from '@/lib/format'
import type { ClientWithLastMeasurement } from '@/lib/dashboard-data'

type Props = { clients: ClientWithLastMeasurement[]; professionistaId?: string }

// I valori sono stabili (stato del filtro); le etichette vengono da
// clients.list.periods.<labelKey>.
const FILTER_PERIODS = [
  { value: 'all', labelKey: 'all' },
  { value: 'today', labelKey: 'today' },
  { value: '7d', labelKey: 'last7' },
  { value: '30d', labelKey: 'last30' },
  { value: 'never', labelKey: 'never' },
] as const

export function ClientsTable({ clients, professionistaId }: Props) {
  const t = useTranslations('clients.list')
  const tScores = useTranslations('scores')
  const locale = useLocale()
  const qs = professionistaId ? `?professionista=${professionistaId}` : ''
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

  const columns: Column<ClientWithLastMeasurement>[] = [
    {
      key: 'name',
      header: t('columns.client'),
      accessor: (c) => fullName(c).toLowerCase(),
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-teal-light text-teal-dark flex items-center justify-center text-xs font-semibold flex-shrink-0">
            {initials(c)}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-anthracite truncate">{fullName(c) || t('noName')}</div>
            <div className="text-xs text-anthracite-lighter truncate">{c.email ?? ''}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'age',
      header: t('columns.age'),
      accessor: (c) => age(c.data_nascita) ?? 0,
      sortable: true,
      render: (c) => <span className="text-anthracite-lighter">{age(c.data_nascita) ?? '—'}</span>,
    },
    {
      key: 'tags',
      header: t('columns.tags'),
      render: (c) => (
        <div className="flex flex-wrap gap-1">
          {(c.settings?.tags ?? []).slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-full text-[11px] bg-teal-light text-teal-dark">{tag}</span>
          ))}
        </div>
      ),
    },
    {
      key: 'last',
      header: t('columns.lastMeasurement'),
      accessor: (c) => c.last_measurement_at ?? '',
      sortable: true,
      render: (c) => (
        <span className="text-anthracite-lighter text-sm whitespace-nowrap">
          {c.last_measurement_at ? formatRelative(c.last_measurement_at, locale) : t('never')}
        </span>
      ),
    },
    {
      key: 'stress',
      header: tScores('names.stress'),
      accessor: (c) => c.lastMeasurement?.score_stress ?? -1,
      sortable: true,
      render: (c) => <ScoreBar value={c.lastMeasurement?.score_stress} inverted />,
    },
    {
      key: 'alerts',
      header: t('columns.alerts'),
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
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
          />
        </div>
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            aria-label={t('columns.tags')}
            className="px-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 max-w-full"
          >
            <option value="">{t('allTags')}</option>
            {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        )}
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value as typeof periodFilter)}
          aria-label={t('columns.lastMeasurement')}
          className="px-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 max-w-full"
        >
          {FILTER_PERIODS.map((p) => <option key={p.value} value={p.value}>{t(`periods.${p.labelKey}`)}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.id}
        rowHref={(c) => `/area-professionisti/clienti/${c.id}${qs}`}
        initialSort={{ key: 'last', dir: 'desc' }}
      />
    </div>
  )
}
