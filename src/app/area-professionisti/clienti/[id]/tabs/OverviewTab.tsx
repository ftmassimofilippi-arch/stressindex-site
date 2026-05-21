'use client'

import Link from 'next/link'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { ScoreGauge } from '@/components/dashboard/ScoreGauge'
import { AdvancedTrendChart, TREND_METRICS } from '@/components/dashboard/AdvancedTrendChart'
import { AlertBadge } from '@/components/dashboard/AlertBadge'
import type { Alert, Client, MeasurementAnalytics } from '@/lib/types'
import { ALERT_TYPE_LABEL } from '@/lib/types'
import { formatDateTime } from '@/lib/format'

export function OverviewTab({ client, measurements, alerts, professionistaId }: { client: Client; measurements: MeasurementAnalytics[]; alerts: Alert[]; professionistaId?: string }) {
  const latest = measurements[0]
  const qs = professionistaId ? `?professionista=${professionistaId}` : ''

  // Trend completo: tutte le 24+ metriche disponibili; il chart filtra internamente per periodo e selezione.
  const trendData = measurements.slice().reverse().map((m) => {
    const point = { date: m.measured_at.slice(0, 10) } as { date: string } & Record<string, number | string | null>
    for (const def of TREND_METRICS) {
      point[def.key] = (m as unknown as Record<string, number | null>)[def.key] ?? null
    }
    return point
  })

  return (
    <div className="space-y-6">
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ScoreGauge label="Stress" value={latest?.score_stress} inverted />
          <ScoreGauge label="Recupero" value={latest?.score_recupero} />
          <ScoreGauge label="Equilibrio" value={latest?.score_equilibrio} />
          <ScoreGauge label="Energia" value={latest?.score_energia} />
        </div>
        {latest && <p className="mt-3 text-xs text-anthracite-lighter">Ultimo aggiornamento: {formatDateTime(latest.measured_at)}</p>}
      </section>

      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-1">Andamento <em className="italic">clinico</em></h2>
        <p className="text-sm text-anthracite-lighter mb-4">Multi-metrica con doppio asse Y · seleziona indicatori e periodo</p>
        {trendData.length === 0 ? (
          <p className="text-sm text-anthracite-lighter">Nessun dato disponibile</p>
        ) : (
          <AdvancedTrendChart
            data={trendData}
            defaultSelected={['score_stress', 'score_recupero']}
            defaultPreset="30"
            height={280}
            storageKey="sx-client-overview-trend"
          />
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
          {measurements.length === 0 ? (
            <div className="px-5 py-6 text-sm text-anthracite-lighter text-center">Nessuna misurazione</div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {measurements.slice(0, 3).map((m) => (
                <li key={m.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-anthracite">{formatDateTime(m.measured_at)}</div>
                    <div className="text-xs text-anthracite-lighter mt-0.5">
                      Stress {m.score_stress?.toFixed(0) ?? '—'} · Recupero {m.score_recupero?.toFixed(0) ?? '—'}
                    </div>
                  </div>
                  <Link href={`/area-professionisti/clienti/${client.id}/misurazione/${m.session_id}${qs}`} className="text-teal-dark text-sm hover:underline">
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
