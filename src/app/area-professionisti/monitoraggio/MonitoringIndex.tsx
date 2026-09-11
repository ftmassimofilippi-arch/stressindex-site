'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { DateRangePicker, defaultRange, type DateRange } from '@/components/dashboard/DateRangePicker'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { MonitoringTable } from '@/components/monitoring/MonitoringTable'
import type { MonitoringSession, RecordingProfile } from '@/lib/monitoring-types'
import { isSleepSession } from '@/lib/monitoring-types'
import { PROFILE_LABEL, PROFILE_ORDER, effectiveProfile, wallDate } from '@/lib/monitoring-format'

type Props = {
  sessions: MonitoringSession[]
  clients: Array<{ id: string; name: string }>
  baseQuery: string
}

const PAGE_SIZE = 25

export function MonitoringIndex({ sessions, clients, baseQuery }: Props) {
  const [client, setClient] = useState('')
  const [type, setType] = useState<'all' | '24h' | 'sleep'>('all')
  const [profile, setProfile] = useState<'all' | RecordingProfile>('all')
  const [range, setRange] = useState<DateRange>(defaultRange(365))
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const fromMs = new Date(range.from + 'T00:00:00Z').getTime()
    const toMs = new Date(range.to + 'T23:59:59Z').getTime()
    const q = search.trim().toLowerCase()
    return sessions.filter((s) => {
      if (client && s.client_id !== client) return false
      if (type === 'sleep' && !isSleepSession(s)) return false
      if (type === '24h' && isSleepSession(s)) return false
      if (profile !== 'all') {
        if (isSleepSession(s)) return false
        if (effectiveProfile(s).profile !== profile) return false
      }
      // Confronto sull'orologio del dispositivo (giorno di calendario visto dall'utente).
      const w = wallDate(s.start_time, s.tz_offset_minutes)?.getTime() ?? 0
      if (w < fromMs || w > toMs) return false
      if (q && !(s.client_name ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [sessions, client, type, profile, range, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const n24 = filtered.filter((s) => !isSleepSession(s)).length
  const nSleep = filtered.length - n24
  const activeClients = new Set(filtered.map((s) => s.client_id).filter(Boolean)).size

  const reset = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(0) }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Monitoraggi" value={filtered.length} hint="nel periodo" />
        <MetricCard label="24h" value={n24} />
        <MetricCard label="Sonno" value={nSleep} />
        <MetricCard label="Clienti" value={activeClients} hint="con monitoraggi" />
      </div>

      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-anthracite-lighter" />
          <input
            value={search}
            onChange={(e) => reset(setSearch)(e.target.value)}
            placeholder="Cerca per nome cliente…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
          />
        </div>
        <select className="select-field" value={client} onChange={(e) => reset(setClient)(e.target.value)}>
          <option value="">Tutti i clienti</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="select-field" value={type} onChange={(e) => reset(setType)(e.target.value as typeof type)}>
          <option value="all">Tutti i tipi</option>
          <option value="24h">24h</option>
          <option value="sleep">Sonno</option>
        </select>
        <select className="select-field" value={profile} onChange={(e) => reset(setProfile)(e.target.value as typeof profile)} disabled={type === 'sleep'}>
          <option value="all">Tutti i profili</option>
          {PROFILE_ORDER.map((p) => <option key={p} value={p}>{PROFILE_LABEL[p]}</option>)}
        </select>
        <DateRangePicker value={range} onChange={(v) => { setRange(v); setPage(0) }} />
      </div>

      <section className="card overflow-hidden">
        <MonitoringTable sessions={rows} baseQuery={baseQuery} emptyText="Nessun monitoraggio con questi filtri" />
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-border text-sm text-anthracite-lighter">
            <div>{filtered.length} monitoraggi · pagina {safePage + 1} di {pageCount}</div>
            <div className="flex gap-2">
              <button type="button" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="px-3 py-1.5 rounded-lg border border-surface-border disabled:opacity-50 hover:bg-surface">Precedente</button>
              <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} className="px-3 py-1.5 rounded-lg border border-surface-border disabled:opacity-50 hover:bg-surface">Successiva</button>
            </div>
          </div>
        )}
      </section>

      <p className="text-xs text-anthracite-lighter">
        I profili con asterisco sono stimati da durata e notte: la riga è stata analizzata con una versione precedente dell&apos;app.
        Il sito mostra quello che l&apos;app ha calcolato e salvato, senza rielaborare i dati.
      </p>
    </div>
  )
}
