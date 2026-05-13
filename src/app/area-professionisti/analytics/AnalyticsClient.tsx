'use client'

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DateRangePicker, defaultRange, type DateRange } from '@/components/dashboard/DateRangePicker'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { fullName } from '@/lib/format'
import type { Session } from '@/lib/types'
import type { ClientWithLastSession } from '@/lib/dashboard-data'
import Link from 'next/link'

type Props = { clients: ClientWithLastSession[]; sessions: Session[] }

function avgOf(values: number[]) {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function AnalyticsClient({ clients, sessions }: Props) {
  const [range, setRange] = useState<DateRange>(defaultRange(30))
  const [segmentDim, setSegmentDim] = useState<'tag' | 'sesso' | 'atleta' | 'fumatore'>('sesso')

  const filteredSessions = useMemo(() => {
    const f = new Date(range.from).getTime()
    const t = new Date(range.to).getTime() + 24 * 3600 * 1000
    return sessions.filter((s) => {
      const v = new Date(s.created_at).getTime()
      return v >= f && v <= t
    })
  }, [sessions, range])

  const activeClientIds = new Set(filteredSessions.map((s) => s.client_id))
  const activeClients = activeClientIds.size
  const totalMeasurements = filteredSessions.length
  const alertCount = clients.reduce((acc, c) => acc + (c.activeAlerts ?? 0), 0)
  const adherence = clients.length === 0 ? 0 : (activeClients / clients.length) * 100

  // Top performers by recovery
  const recoveryByClient = new Map<string, number[]>()
  for (const s of filteredSessions) {
    if (s.recovery_score == null) continue
    const arr = recoveryByClient.get(s.client_id) ?? []
    arr.push(s.recovery_score)
    recoveryByClient.set(s.client_id, arr)
  }
  const perClient = clients.map((c) => {
    const recs = recoveryByClient.get(c.id) ?? []
    const avg = avgOf(recs)
    return { client: c, recoveryAvg: avg, n: recs.length }
  }).filter((x) => x.recoveryAvg != null) as Array<{ client: ClientWithLastSession; recoveryAvg: number; n: number }>

  const topPerformers = [...perClient].sort((a, b) => b.recoveryAvg - a.recoveryAvg).slice(0, 5)
  const critical = [...perClient].sort((a, b) => a.recoveryAvg - b.recoveryAvg).slice(0, 5)

  // Distribuzione score: istogramma in 5 bin per ogni metrica
  const bins = ['0-20', '21-40', '41-60', '61-80', '81-100']
  const distData = bins.map((label, i) => ({
    bin: label,
    Stress: 0, Recupero: 0, Equilibrio: 0, Energia: 0,
    binStart: i * 20,
  }))
  function inc(s: Session, key: 'Stress' | 'Recupero' | 'Equilibrio' | 'Energia', value: number | null | undefined) {
    if (value == null) return
    const idx = Math.min(4, Math.floor(value / 20))
    distData[idx][key]++
  }
  for (const s of filteredSessions) {
    inc(s, 'Stress', s.stress_score)
    inc(s, 'Recupero', s.recovery_score)
    inc(s, 'Equilibrio', s.balance_score)
    inc(s, 'Energia', s.energy_score)
  }

  // Segment comparison
  const segments = useMemo(() => buildSegments(clients, filteredSessions, segmentDim), [clients, filteredSessions, segmentDim])

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Clienti attivi" value={activeClients} hint={`/ ${clients.length} totali`} />
        <MetricCard label="Misurazioni" value={totalMeasurements} hint="nel periodo" />
        <MetricCard label="Alert attivi" value={alertCount} />
        <MetricCard label="% aderenza" value={`${adherence.toFixed(0)}%`} hint="hanno misurato" />
      </section>

      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-1">Distribuzione score clienti</h2>
        <p className="text-sm text-anthracite-lighter mb-4">Quante misurazioni cadono in ogni fascia di valore</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={distData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
            <XAxis dataKey="bin" stroke="#6B7280" fontSize={11} />
            <YAxis stroke="#6B7280" fontSize={11} />
            <Tooltip contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 12 }} />
            <Bar dataKey="Stress" fill="#EF4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Recupero" fill="#10B981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Equilibrio" fill="#4FA39A" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Energia" fill="#F59E0B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <h3 className="font-serif text-base text-anthracite">Top performers</h3>
            <p className="text-xs text-anthracite-lighter">Migliore recupero medio nel periodo</p>
          </div>
          <ul className="divide-y divide-surface-border">
            {topPerformers.length === 0 && <li className="p-5 text-sm text-anthracite-lighter">Dati insufficienti</li>}
            {topPerformers.map((t) => (
              <li key={t.client.id} className="px-5 py-3 flex items-center justify-between">
                <Link href={`/area-professionisti/clienti/${t.client.id}`} className="text-sm font-medium text-anthracite hover:text-teal-dark">
                  {fullName(t.client)}
                </Link>
                <div className="text-right">
                  <div className="text-emerald-600 font-medium tabular-nums">{t.recoveryAvg.toFixed(0)}</div>
                  <div className="text-[11px] text-anthracite-lighter">{t.n} misurazioni</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <h3 className="font-serif text-base text-anthracite">Clienti critici</h3>
            <p className="text-xs text-anthracite-lighter">Recupero più basso nel periodo</p>
          </div>
          <ul className="divide-y divide-surface-border">
            {critical.length === 0 && <li className="p-5 text-sm text-anthracite-lighter">Dati insufficienti</li>}
            {critical.map((t) => (
              <li key={t.client.id} className="px-5 py-3 flex items-center justify-between">
                <Link href={`/area-professionisti/clienti/${t.client.id}`} className="text-sm font-medium text-anthracite hover:text-teal-dark">
                  {fullName(t.client)}
                </Link>
                <div className="text-right">
                  <div className="text-red-500 font-medium tabular-nums">{t.recoveryAvg.toFixed(0)}</div>
                  <div className="text-[11px] text-anthracite-lighter">{t.n} misurazioni</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-serif text-lg text-anthracite">Confronto segmenti</h2>
            <p className="text-sm text-anthracite-lighter">Differenze medie per dimensione cliente</p>
          </div>
          <select value={segmentDim} onChange={(e) => setSegmentDim(e.target.value as typeof segmentDim)} className="px-3 py-2 text-sm bg-white border border-surface-border rounded-xl">
            <option value="sesso">Sesso</option>
            <option value="atleta">Atleta vs non</option>
            <option value="fumatore">Fumatore vs non</option>
            <option value="tag">Per tag</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={segments}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
            <XAxis dataKey="label" stroke="#6B7280" fontSize={11} />
            <YAxis domain={[0, 100]} stroke="#6B7280" fontSize={11} />
            <Tooltip contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 12 }} />
            <Bar dataKey="stress" name="Stress" fill="#EF4444" radius={[4, 4, 0, 0]}>
              {segments.map((_, i) => <Cell key={i} fill="#EF4444" />)}
            </Bar>
            <Bar dataKey="recupero" name="Recupero" fill="#10B981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  )
}

function buildSegments(clients: ClientWithLastSession[], sessions: Session[], dim: 'tag' | 'sesso' | 'atleta' | 'fumatore') {
  const groups = new Map<string, { stress: number[]; recupero: number[] }>()
  const clientMap = new Map(clients.map((c) => [c.id, c]))

  for (const s of sessions) {
    const c = clientMap.get(s.client_id)
    if (!c) continue
    let keys: string[] = []
    if (dim === 'tag') keys = (c.settings?.tags ?? [])
    else if (dim === 'sesso') keys = [c.sesso === 'M' ? 'Uomini' : c.sesso === 'F' ? 'Donne' : 'Non specificato']
    else if (dim === 'atleta') keys = [c.atleta ? 'Atleti' : 'Non atleti']
    else if (dim === 'fumatore') keys = [c.fumatore ? 'Fumatori' : 'Non fumatori']
    for (const k of keys.length ? keys : ['—']) {
      const g = groups.get(k) ?? { stress: [], recupero: [] }
      if (s.stress_score != null) g.stress.push(s.stress_score)
      if (s.recovery_score != null) g.recupero.push(s.recovery_score)
      groups.set(k, g)
    }
  }

  const out: Array<{ label: string; stress: number; recupero: number }> = []
  Array.from(groups.entries()).forEach(([label, g]) => {
    out.push({
      label,
      stress: g.stress.length ? Math.round(g.stress.reduce((a, b) => a + b, 0) / g.stress.length) : 0,
      recupero: g.recupero.length ? Math.round(g.recupero.reduce((a, b) => a + b, 0) / g.recupero.length) : 0,
    })
  })
  return out
}
