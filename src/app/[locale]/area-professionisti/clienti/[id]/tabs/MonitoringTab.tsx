'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { DateRangePicker, defaultRange, type DateRange } from '@/components/dashboard/DateRangePicker'
import { MonitoringTable } from '@/components/monitoring/MonitoringTable'
import type { MonitoringSession, RecordingProfile } from '@/lib/monitoring-types'
import { isSleepSession } from '@/lib/monitoring-types'
import { PROFILE_LABEL, PROFILE_ORDER, effectiveProfile, wallDate } from '@/lib/monitoring-format'

// Tab "Monitoraggio" della scheda cliente: stessa lista della pagina indice,
// filtrata sul cliente (i dati arrivano già filtrati dal server).
export function MonitoringTab({ sessions, professionistaId }: { sessions: MonitoringSession[]; professionistaId?: string }) {
  const t = useTranslations('clients.monitoring')
  const baseQuery = professionistaId ? `?professionista=${professionistaId}` : ''
  const [type, setType] = useState<'all' | '24h' | 'sleep'>('all')
  const [profile, setProfile] = useState<'all' | RecordingProfile>('all')
  const [range, setRange] = useState<DateRange>(defaultRange(365))

  const filtered = useMemo(() => {
    const fromMs = new Date(range.from + 'T00:00:00Z').getTime()
    const toMs = new Date(range.to + 'T23:59:59Z').getTime()
    return sessions.filter((s) => {
      if (type === 'sleep' && !isSleepSession(s)) return false
      if (type === '24h' && isSleepSession(s)) return false
      if (profile !== 'all' && (isSleepSession(s) || effectiveProfile(s).profile !== profile)) return false
      const w = wallDate(s.start_time, s.tz_offset_minutes)?.getTime() ?? 0
      return w >= fromMs && w <= toMs
    })
  }, [sessions, type, profile, range])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={range} onChange={setRange} />
        <select className="select-field" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="all">{t('allTypes')}</option>
          <option value="24h">{t('type24h')}</option>
          <option value="sleep">{t('typeSleep')}</option>
        </select>
        <select className="select-field" value={profile} onChange={(e) => setProfile(e.target.value as typeof profile)} disabled={type === 'sleep'}>
          <option value="all">{t('allProfiles')}</option>
          {PROFILE_ORDER.map((p) => <option key={p} value={p}>{PROFILE_LABEL[p]}</option>)}
        </select>
        <div className="ml-auto text-sm text-anthracite-lighter">{t('count', { count: filtered.length })}</div>
      </div>
      <section className="card overflow-hidden">
        <MonitoringTable sessions={filtered} showClient={false} baseQuery={baseQuery} emptyText={t('empty')} />
      </section>
      <p className="text-xs text-anthracite-lighter">{t('footnote')}</p>
    </div>
  )
}
