'use client'

import Link from 'next/link'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { ScoreGauge } from '@/components/dashboard/ScoreGauge'
import { TrendChart } from '@/components/dashboard/TrendChart'
import { AlertBadge } from '@/components/dashboard/AlertBadge'
import type { Alert, Client, Session } from '@/lib/types'
import { ALERT_TYPE_LABEL } from '@/lib/types'
import { formatDateTime } from '@/lib/format'

export function OverviewTab({ client, sessions, alerts }: { client: Client; sessions: Session[]; alerts: Alert[] }) {
  const latest = sessions[0]

  const trendData = sessions.slice(0, 30).slice().reverse().map((s) => ({
    date: s.created_at.slice(0, 10),
    stress_score: s.stress_score,
    recovery_score: s.recovery_score,
    balance_score: s.balance_score,
    energy_score: s.energy_score,
  }))

  return (
    <div className="space-y-6">
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ScoreGauge label="Stress" value={latest?.stress_score} inverted />
          <ScoreGauge label="Recupero" value={latest?.recovery_score} />
          <ScoreGauge label="Equilibrio" value={latest?.balance_score} />
          <ScoreGauge label="Energia" value={latest?.energy_score} />
        </div>
        {latest && <p className="mt-3 text-xs text-anthracite-lighter">Ultimo aggiornamento: {formatDateTime(latest.created_at)}</p>}
      </section>

      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-1">Andamento <em className="italic">30 giorni</em></h2>
        <p className="text-sm text-anthracite-lighter mb-4">Trend dei 4 indici clinici</p>
        {trendData.length === 0 ? (
          <p className="text-sm text-anthracite-lighter">Nessun dato disponibile</p>
        ) : (
          <TrendChart data={trendData} height={260} />
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h3 className="font-serif text-base text-anthracite">Alert attivi</h3>
            <span className="text-sm text-anthracite-lighter">({alerts.length})</span>
          </div>
          {alerts.length === 0 ? (
            <div className="px-5 py-6 text-sm text-anthracite-lighter text-center">Nessun alert attivo</div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {alerts.map((a) => (
                <li key={a.id} className="px-5 py-3 flex items-center gap-3">
                  <AlertBadge severity={a.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-anthracite">{ALERT_TYPE_LABEL[a.type]}</div>
                    <div className="text-xs text-anthracite-lighter mt-0.5">{a.message ?? ''}</div>
                  </div>
                  <span className="text-xs text-anthracite-lighter">{formatDateTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
            <h3 className="font-serif text-base text-anthracite">Ultime 3 misurazioni</h3>
          </div>
          {sessions.length === 0 ? (
            <div className="px-5 py-6 text-sm text-anthracite-lighter text-center">Nessuna misurazione</div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {sessions.slice(0, 3).map((s) => (
                <li key={s.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-anthracite">{formatDateTime(s.created_at)}</div>
                    <div className="text-xs text-anthracite-lighter mt-0.5">
                      Stress {s.stress_score?.toFixed(0) ?? '—'} · Recupero {s.recovery_score?.toFixed(0) ?? '—'}
                    </div>
                  </div>
                  <Link href={`/area-professionisti/clienti/${client.id}/misurazione/${s.id}`} className="text-teal-dark text-sm hover:underline">
                    Apri →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-6 border-dashed border-2 border-surface-border bg-surface/50">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-light text-teal-dark flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-base text-anthracite">Insights AI</h3>
              <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-anthracite text-white">Coming soon</span>
            </div>
            <p className="text-sm text-anthracite-lighter mt-1 max-w-prose">
              A breve potrai ricevere insight clinici sintetici sull&apos;andamento del cliente, generati con Claude e revisionati dal nostro team.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
