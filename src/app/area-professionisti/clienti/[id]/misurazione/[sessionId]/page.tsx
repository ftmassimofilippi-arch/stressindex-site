import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { ScoreGauge } from '@/components/dashboard/ScoreGauge'
import { getClient, getMeasurementBySessionId, getProfessionalProfile, listAlerts } from '@/lib/dashboard-data'
import { fullName, formatDateTime, num } from '@/lib/format'
import { PoincareScatter, Rhythmogram, PsdPlaceholder } from './HrvCharts'
import { HrvParamsTable } from './HrvParamsTable'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dettaglio misurazione' }

export default async function SessionDetailPage({ params }: { params: { id: string; sessionId: string } }) {
  const [measurement, client, professional, alerts] = await Promise.all([
    getMeasurementBySessionId(params.sessionId),
    getClient(params.id),
    getProfessionalProfile(),
    listAlerts({ status: ['new'] }),
  ])

  if (!measurement || !client) notFound()

  const duration = measurement.duration_seconds ? `${Math.round(measurement.duration_seconds / 60)} min` : '—'
  const sensorLabel = measurement.sensor_name ?? measurement.sensor_type ?? 'Polar H10'

  return (
    <DashboardLayout professional={professional} alertCount={alerts.length}>
      <div className="mb-6">
        <Link href={`/area-professionisti/clienti/${client.id}?tab=misurazioni`} className="inline-flex items-center gap-1.5 text-sm text-anthracite-lighter hover:text-anthracite transition-colors">
          <ArrowLeft size={14} /> {fullName(client)} · Misurazioni
        </Link>
      </div>

      <header className="card p-6 mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl text-anthracite">{formatDateTime(measurement.measured_at)}</h1>
            <p className="text-sm text-anthracite-lighter mt-1">
              {fullName(client)} · {duration} · Sensore: {sensorLabel}
              {measurement.artifact_percentage != null ? ` · Artifact: ${measurement.artifact_percentage.toFixed(1)}%` : ''}
            </p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ScoreGauge label="Stress" value={measurement.score_stress} inverted />
        <ScoreGauge label="Recupero" value={measurement.score_recupero} />
        <ScoreGauge label="Equilibrio" value={measurement.score_equilibrio} />
        <ScoreGauge label="Energia" value={measurement.score_energia} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card p-6">
          <h2 className="font-serif text-lg text-anthracite mb-1">Modulazione <em className="italic">infiammatoria</em></h2>
          <p className="text-sm text-anthracite-lighter mb-3">Indice proprietario derivato dall&apos;analisi spettrale</p>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-5xl text-anthracite">{num(measurement.score_modulazione_infiammatoria, 1)}</span>
            <span className="text-sm text-anthracite-lighter">/ 100</span>
          </div>
        </div>
        <div className="card p-6">
          <h2 className="font-serif text-lg text-anthracite mb-1">Indice <em className="italic">composito</em></h2>
          <p className="text-sm text-anthracite-lighter mb-3">Sintesi dei 4 score proprietari</p>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-5xl text-anthracite">{num(measurement.score_composito, 1)}</span>
            <span className="text-sm text-anthracite-lighter">/ 100</span>
          </div>
        </div>
      </section>

      <section className="card p-6 mb-6">
        <details>
          <summary className="font-serif text-lg text-anthracite cursor-pointer">Parametri HRV completi</summary>
          <div className="mt-4">
            <HrvParamsTable measurement={measurement} />
          </div>
        </details>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <h3 className="font-serif text-base text-anthracite mb-1">Diagramma di Poincaré</h3>
          <p className="text-xs text-anthracite-lighter mb-3">SD1 vs SD2 — variabilità a breve / lungo termine</p>
          <PoincareScatter rr={measurement.rr_intervals ?? null} sd1={measurement.sd1} sd2={measurement.sd2} />
        </div>
        <div className="card p-6">
          <h3 className="font-serif text-base text-anthracite mb-1">Spettro frequenze (PSD)</h3>
          <p className="text-xs text-anthracite-lighter mb-3">Densità spettrale di potenza — bande VLF / LF / HF</p>
          <PsdPlaceholder
            vlf={measurement.vlf_power}
            lf={measurement.lf_power}
            hf={measurement.hf_power}
            lfHfRatio={measurement.lf_hf_ratio}
          />
        </div>
      </section>

      <section className="card p-6 mb-6">
        <h3 className="font-serif text-base text-anthracite mb-1">Ritmogramma RR</h3>
        <p className="text-xs text-anthracite-lighter mb-3">Intervalli RR nel tempo · usa il selettore inferiore per zoom temporale</p>
        <Rhythmogram rr={measurement.rr_intervals ?? null} />
      </section>

      <section className="card p-6">
        <h3 className="font-serif text-base text-anthracite mb-3">Note legate alla misurazione</h3>
        {measurement.indicazioni && (
          <div className="mb-3">
            <div className="text-xs uppercase tracking-wide text-anthracite-lighter mb-1">Indicazioni</div>
            <p className="text-sm text-anthracite whitespace-pre-wrap">{measurement.indicazioni}</p>
          </div>
        )}
        {measurement.notes_professionista ? (
          <div>
            <div className="text-xs uppercase tracking-wide text-anthracite-lighter mb-1">Note professionista</div>
            <p className="text-sm text-anthracite whitespace-pre-wrap">{measurement.notes_professionista}</p>
          </div>
        ) : !measurement.indicazioni ? (
          <p className="text-sm text-anthracite-lighter">Nessuna nota</p>
        ) : null}
      </section>
    </DashboardLayout>
  )
}
