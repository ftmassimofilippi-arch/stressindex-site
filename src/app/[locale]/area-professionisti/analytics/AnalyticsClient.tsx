'use client'

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLocale, useTranslations } from 'next-intl'
import { DateRangePicker, defaultRange, type DateRange } from '@/components/dashboard/DateRangePicker'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { fullName, num } from '@/lib/format'
import type { MeasurementAnalytics } from '@/lib/types'
import type { ClientWithLastMeasurement } from '@/lib/dashboard-data'
import type { Tr } from '@/i18n/types'
import { Link } from '@/i18n/navigation'
import { intervalloGiorniIta, measuredInstant } from '@/lib/format'
import type { MonitoringSession } from '@/lib/monitoring-types'
import { isSleepSession } from '@/lib/monitoring-types'
import { PROFILE_LABEL, PROFILE_ORDER, effectiveProfile, wallDate } from '@/lib/monitoring-format'

type Props = { clients: ClientWithLastMeasurement[]; measurements: MeasurementAnalytics[]; monitoring?: MonitoringSession[] }

type SegmentDim = 'tag' | 'sesso' | 'atleta' | 'fumatore'

function avgOf(values: number[]) {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function AnalyticsClient({ clients, measurements, monitoring = [] }: Props) {
  const locale = useLocale()
  const t = useTranslations('dashboard.analytics')
  const tScores = useTranslations('scores.names')
  const tSeg = useTranslations('dashboard.analytics.segments')

  const [range, setRange] = useState<DateRange>(defaultRange(30))
  const [segmentDim, setSegmentDim] = useState<SegmentDim>('sesso')

  const filtered = useMemo(() => {
    // Estremi a mezzanotte ITALIANA: con la mezzanotte UTC le misurazioni
    // serali cadevano nel giorno dopo e uscivano dal periodo selezionato.
    const { fromIso, toIso } = intervalloGiorniIta(range.from, range.to)
    const f = new Date(fromIso).getTime()
    const tt = new Date(toIso).getTime()
    return measurements.filter((m) => {
      const v = measuredInstant(m)?.getTime() ?? 0
      return v >= f && v <= tt
    })
  }, [measurements, range])

  const activeClientIds = new Set(filtered.map((m) => m.client_id))
  const activeClients = activeClientIds.size
  const totalMeasurements = filtered.length
  const alertCount = clients.reduce((acc, c) => acc + (c.activeAlerts ?? 0), 0)
  const adherence = clients.length === 0 ? 0 : (activeClients / clients.length) * 100

  // Per-client recovery average
  const recoveryByClient = new Map<string, number[]>()
  for (const m of filtered) {
    if (m.score_recupero == null) continue
    const arr = recoveryByClient.get(m.client_id) ?? []
    arr.push(m.score_recupero)
    recoveryByClient.set(m.client_id, arr)
  }
  const perClient = clients.map((c) => {
    const recs = recoveryByClient.get(c.id) ?? []
    const avg = avgOf(recs)
    return { client: c, recoveryAvg: avg, n: recs.length }
  }).filter((x) => x.recoveryAvg != null) as Array<{ client: ClientWithLastMeasurement; recoveryAvg: number; n: number }>

  const topPerformers = [...perClient].sort((a, b) => b.recoveryAvg - a.recoveryAvg).slice(0, 5)
  const toWatch = [...perClient].sort((a, b) => a.recoveryAvg - b.recoveryAvg).slice(0, 5)

  // Distribution histogram in 5 bins per score
  const bins = ['0-20', '21-40', '41-60', '61-80', '81-100']
  const distData = bins.map((label, i) => ({
    bin: label,
    stress: 0, recovery: 0, balance: 0, energy: 0,
    binStart: i * 20,
  }))
  function inc(key: 'stress' | 'recovery' | 'balance' | 'energy', value: number | null | undefined) {
    if (value == null) return
    const idx = Math.min(4, Math.floor(value / 20))
    distData[idx][key]++
  }
  for (const m of filtered) {
    inc('stress', m.score_stress)
    inc('recovery', m.score_recupero)
    inc('balance', m.score_equilibrio)
    inc('energy', m.score_energia)
  }

  const segments = useMemo(() => buildSegments(clients, filtered, segmentDim, tSeg), [clients, filtered, segmentDim, tSeg])

  // Monitoraggi nel periodo, per tipo e per profilo (conteggi, nessun ricalcolo).
  const monitoringStats = useMemo(() => {
    const f = new Date(range.from + 'T00:00:00Z').getTime()
    const tt = new Date(range.to + 'T23:59:59Z').getTime()
    const inRange = monitoring.filter((s) => {
      const w = wallDate(s.start_time, s.tz_offset_minutes)?.getTime() ?? 0
      return w >= f && w <= tt
    })
    const byProfile = new Map<string, number>()
    let sleep = 0
    for (const s of inRange) {
      if (isSleepSession(s)) { sleep++; continue }
      const p = effectiveProfile(s).profile
      byProfile.set(p, (byProfile.get(p) ?? 0) + 1)
    }
    return { total: inRange.length, h24: inRange.length - sleep, sleep, byProfile, clients: new Set(inRange.map((s) => s.client_id)).size }
  }, [monitoring, range])

  const tooltipStyle = { background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 12 }
  const fmtCount = (v: unknown) => num(v, 0, locale)

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label={t('activeClients')} value={activeClients} hint={t('ofTotal', { count: clients.length })} />
        <MetricCard label={t('measurements')} value={totalMeasurements} hint={t('inPeriod')} />
        <MetricCard label={t('activeAlerts')} value={alertCount} />
        <MetricCard label={t('adherence')} value={`${num(adherence, 0, locale)}%`} hint={t('adherenceHint')} />
      </section>

      <section className="card p-6">
        <h2 className="font-serif text-lg mb-1" style={{ color: '#2B4160' }}>{t('monitoringTitle')}</h2>
        <p className="text-sm text-anthracite-lighter mb-4">{t('monitoringSubtitle')}</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label={t('monitoring')} value={monitoringStats.total} hint={t('inPeriod')} />
          <MetricCard label={t('h24')} value={monitoringStats.h24} />
          <MetricCard label={t('sleep')} value={monitoringStats.sleep} />
          <MetricCard label={t('clients')} value={monitoringStats.clients} hint={t('withMonitoring')} />
        </div>
        {monitoringStats.h24 > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {PROFILE_ORDER.map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-surface-border bg-surface text-anthracite">
                {PROFILE_LABEL[p]} <span className="font-semibold tabular-nums">{monitoringStats.byProfile.get(p) ?? 0}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-1">{t('distributionTitle')}</h2>
        <p className="text-sm text-anthracite-lighter mb-4">{t('distributionSubtitle')}</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={distData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
            <XAxis dataKey="bin" stroke="#6B7280" fontSize={11} />
            <YAxis stroke="#6B7280" fontSize={11} tickFormatter={fmtCount} />
            <Tooltip contentStyle={tooltipStyle} formatter={fmtCount} />
            <Bar dataKey="stress" name={tScores('stress')} fill="#EF4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="recovery" name={tScores('recovery')} fill="#10B981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="balance" name={tScores('balance')} fill="#4FA39A" radius={[4, 4, 0, 0]} />
            <Bar dataKey="energy" name={tScores('energy')} fill="#F59E0B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <h3 className="font-serif text-base text-anthracite">{t('topTitle')}</h3>
            <p className="text-xs text-anthracite-lighter">{t('topSubtitle')}</p>
          </div>
          <ul className="divide-y divide-surface-border">
            {topPerformers.length === 0 && <li className="p-5 text-sm text-anthracite-lighter">{t('insufficientData')}</li>}
            {topPerformers.map((x) => (
              <li key={x.client.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <Link href={`/area-professionisti/clienti/${x.client.id}`} className="text-sm font-medium text-anthracite hover:text-teal-dark min-w-0 truncate">
                  {fullName(x.client)}
                </Link>
                <div className="text-right flex-shrink-0">
                  <div className="text-emerald-600 font-medium tabular-nums">{num(x.recoveryAvg, 0, locale)}</div>
                  <div className="text-[11px] text-anthracite-lighter">{t('measurementsCount', { count: x.n })}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <h3 className="font-serif text-base text-anthracite">{t('watchTitle')}</h3>
            <p className="text-xs text-anthracite-lighter">{t('watchSubtitle')}</p>
          </div>
          <ul className="divide-y divide-surface-border">
            {toWatch.length === 0 && <li className="p-5 text-sm text-anthracite-lighter">{t('insufficientData')}</li>}
            {toWatch.map((x) => (
              <li key={x.client.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <Link href={`/area-professionisti/clienti/${x.client.id}`} className="text-sm font-medium text-anthracite hover:text-teal-dark min-w-0 truncate">
                  {fullName(x.client)}
                </Link>
                <div className="text-right flex-shrink-0">
                  <div className="text-red-500 font-medium tabular-nums">{num(x.recoveryAvg, 0, locale)}</div>
                  <div className="text-[11px] text-anthracite-lighter">{t('measurementsCount', { count: x.n })}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="font-serif text-lg text-anthracite">{t('segmentsTitle')}</h2>
            <p className="text-sm text-anthracite-lighter">{t('segmentsSubtitle')}</p>
          </div>
          <select value={segmentDim} onChange={(e) => setSegmentDim(e.target.value as SegmentDim)} className="px-3 py-2 text-sm bg-white border border-surface-border rounded-xl max-w-full">
            <option value="sesso">{t('dims.sex')}</option>
            <option value="atleta">{t('dims.athlete')}</option>
            <option value="fumatore">{t('dims.smoker')}</option>
            <option value="tag">{t('dims.tag')}</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={segments}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
            <XAxis dataKey="label" stroke="#6B7280" fontSize={11} />
            <YAxis domain={[0, 100]} stroke="#6B7280" fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} formatter={fmtCount} />
            <Bar dataKey="stress" name={tScores('stress')} fill="#EF4444" radius={[4, 4, 0, 0]}>
              {segments.map((_, i) => <Cell key={i} fill="#EF4444" />)}
            </Bar>
            <Bar dataKey="recovery" name={tScores('recovery')} fill="#10B981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  )
}

// `tSeg` traduce le etichette dei segmenti (`dashboard.analytics.segments`);
// i tag liberi del cliente restano com'è stato scritto.
function buildSegments(clients: ClientWithLastMeasurement[], measurements: MeasurementAnalytics[], dim: SegmentDim, tSeg: Tr) {
  const groups = new Map<string, { stress: number[]; recovery: number[] }>()
  const clientMap = new Map(clients.map((c) => [c.id, c]))

  for (const m of measurements) {
    const c = clientMap.get(m.client_id)
    if (!c) continue
    let keys: string[] = []
    if (dim === 'tag') keys = (c.settings?.tags ?? [])
    else if (dim === 'sesso') keys = [c.sesso === 'M' ? tSeg('men') : c.sesso === 'F' ? tSeg('women') : tSeg('unspecified')]
    else if (dim === 'atleta') keys = [c.atleta ? tSeg('athletes') : tSeg('nonAthletes')]
    else if (dim === 'fumatore') keys = [c.fumatore ? tSeg('smokers') : tSeg('nonSmokers')]
    for (const k of keys.length ? keys : [tSeg('noTag')]) {
      const g = groups.get(k) ?? { stress: [], recovery: [] }
      if (m.score_stress != null) g.stress.push(m.score_stress)
      if (m.score_recupero != null) g.recovery.push(m.score_recupero)
      groups.set(k, g)
    }
  }

  const out: Array<{ label: string; stress: number; recovery: number }> = []
  Array.from(groups.entries()).forEach(([label, g]) => {
    out.push({
      label,
      stress: g.stress.length ? Math.round(g.stress.reduce((a, b) => a + b, 0) / g.stress.length) : 0,
      recovery: g.recovery.length ? Math.round(g.recovery.reduce((a, b) => a + b, 0) / g.recovery.length) : 0,
    })
  })
  return out
}
