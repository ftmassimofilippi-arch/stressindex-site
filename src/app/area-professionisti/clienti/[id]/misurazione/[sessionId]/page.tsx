import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { ScoreGauge } from '@/components/dashboard/ScoreGauge'
import { getClient, getProfessionalProfile, getSession, listAlerts } from '@/lib/dashboard-data'
import { fullName, formatDateTime, num } from '@/lib/format'
import { PoincareScatter, Rhythmogram, PsdPlaceholder } from './HrvCharts'
import { HrvParamsTable } from './HrvParamsTable'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dettaglio misurazione' }

export default async function SessionDetailPage({ params }: { params: { id: string; sessionId: string } }) {
  const [session, client, professional, alerts] = await Promise.all([
    getSession(params.sessionId),
    getClient(params.id),
    getProfessionalProfile(),
    listAlerts({ status: ['new'] }),
  ])

  if (!session || !client) notFound()

  const duration = session.duration_seconds ? `${Math.round(session.duration_seconds / 60)} min` : '—'

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
            <h1 className="font-serif text-2xl text-anthracite">{formatDateTime(session.created_at)}</h1>
            <p className="text-sm text-anthracite-lighter mt-1">
              {fullName(client)} · {duration} · Sensore: {session.sensor_used ?? 'Polar H10'} · Qualità segnale: {session.signal_quality != null ? `${Math.round(session.signal_quality)}%` : '—'}
            </p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ScoreGauge label="Stress" value={session.stress_score} inverted />
        <ScoreGauge label="Recupero" value={session.recovery_score} />
        <ScoreGauge label="Equilibrio" value={session.balance_score} />
        <ScoreGauge label="Energia" value={session.energy_score} />
      </section>

      <section className="card p-6 mb-6">
        <h2 className="font-serif text-lg text-anthracite mb-1">Modulazione <em className="italic">infiammatoria</em></h2>
        <p className="text-sm text-anthracite-lighter mb-4">Indice proprietario derivato dall&apos;analisi spettrale</p>
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-5xl text-anthracite">{num(session.inflammatory_modulation, 1)}</span>
          <span className="text-sm text-anthracite-lighter">unità relative</span>
        </div>
      </section>

      <section className="card p-6 mb-6">
        <details>
          <summary className="font-serif text-lg text-anthracite cursor-pointer">Parametri HRV completi</summary>
          <div className="mt-4">
            <HrvParamsTable session={session} />
          </div>
        </details>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <h3 className="font-serif text-base text-anthracite mb-1">Diagramma di Poincaré</h3>
          <p className="text-xs text-anthracite-lighter mb-3">SD1 vs SD2 — variabilità a breve / lungo termine</p>
          <PoincareScatter rr={session.rr_intervals ?? null} sd1={session.sd1 ?? null} sd2={session.sd2 ?? null} />
        </div>
        <div className="card p-6">
          <h3 className="font-serif text-base text-anthracite mb-1">Ritmogramma RR</h3>
          <p className="text-xs text-anthracite-lighter mb-3">Intervalli RR nel tempo</p>
          <Rhythmogram rr={session.rr_intervals ?? null} />
        </div>
      </section>

      <section className="card p-6 mb-6">
        <h3 className="font-serif text-base text-anthracite mb-1">Spettro frequenze (PSD)</h3>
        <p className="text-xs text-anthracite-lighter mb-3">Densità spettrale di potenza — bande VLF / LF / HF</p>
        <PsdPlaceholder vlf={session.vlf ?? null} lf={session.lf ?? null} hf={session.hf ?? null} />
      </section>

      <section className="card p-6">
        <h3 className="font-serif text-base text-anthracite mb-1">Note legate alla misurazione</h3>
        <p className="text-sm text-anthracite-lighter">{session.notes ?? 'Nessuna nota'}</p>
      </section>
    </DashboardLayout>
  )
}
