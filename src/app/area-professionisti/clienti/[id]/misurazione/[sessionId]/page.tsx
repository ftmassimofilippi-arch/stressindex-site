import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { DownloadMeasurementPdfButton } from '@/components/dashboard/DownloadMeasurementPdfButton'
import { GaugeScore } from '@/components/dashboard/GaugeScore'
import { getClient, getMeasurementBySessionId, getProfessionalProfile, listAlerts } from '@/lib/dashboard-data'
import { fullName, formatMeasuredAt, num, toNum } from '@/lib/format'
import { MeasurementTypeBadge } from '@/components/dashboard/MeasurementTypeBadge'
import { normalizeTestType, isLongMeasurement, formatDurationHuman } from '@/lib/measurement-type'
import { PoincareScatter, Rhythmogram, PsdPlaceholder } from './HrvCharts'
import { HrvParamsTable } from './HrvParamsTable'
import { OrthostaticView } from './OrthostaticView'
import { CoherenceView } from './CoherenceView'
import { LongMeasurementView } from './LongMeasurementView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dettaglio misurazione' }

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: { id: string; sessionId: string }
  searchParams?: { professionista?: string }
}) {
  const [measurement, client, professional, alerts] = await Promise.all([
    getMeasurementBySessionId(params.sessionId, params.id),
    getClient(params.id),
    getProfessionalProfile(),
    listAlerts({ status: ['new'] }),
  ])

  if (!measurement || !client) notFound()

  const qs = searchParams?.professionista ? `?professionista=${searchParams.professionista}` : ''
  const backHref = `/area-professionisti/clienti/${client.id}${qs}${qs ? '&' : '?'}tab=misurazioni`

  const duration = formatDurationHuman(measurement.duration_seconds)
  const sensorLabel = measurement.sensor_name ?? measurement.sensor_type ?? 'Polar H10'

  const typeKey = normalizeTestType(measurement.test_type)
  const hasSegments = Array.isArray(measurement.segments) && measurement.segments.length > 1
  const hasRolling = Array.isArray(measurement.rolling_series) && measurement.rolling_series.length > 0
  // Blocco misurazioni lunghe: mostrato solo quando ci sono dati temporali reali
  // (serie continua o segmenti), oppure la sessione è lunga per durata/tipo.
  const showLong = hasSegments || hasRolling || (isLongMeasurement(measurement) && (typeKey === 'standard' || typeKey === 'unknown'))

  return (
    <DashboardLayout professional={professional} alertCount={alerts.length}>
      <div className="mb-6">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-anthracite-lighter hover:text-anthracite transition-colors">
          <ArrowLeft size={14} /> {fullName(client)} · Misurazioni
        </Link>
      </div>

      <header className="card p-6 mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-serif text-2xl text-anthracite">{formatMeasuredAt(measurement)}</h1>
              <MeasurementTypeBadge testType={measurement.test_type} />
            </div>
            <p className="text-sm text-anthracite-lighter mt-1">
              {fullName(client)} · {duration} · Sensore: {sensorLabel}
              {toNum(measurement.artifact_percentage) != null ? ` · Artifact: ${num(measurement.artifact_percentage, 1)}%` : ''}
            </p>
          </div>
          <DownloadMeasurementPdfButton sessionId={measurement.session_id} clientId={client.id} />
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <GaugeScore label="STRESS" value={measurement.score_stress} colorScheme="stress" />
        <GaugeScore label="RECUPERO" value={measurement.score_recupero} colorScheme="recovery" />
        <GaugeScore label="EQUILIBRIO" value={measurement.score_equilibrio} colorScheme="balance" />
        <GaugeScore label="ENERGIA" value={measurement.score_energia} colorScheme="energy" />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card p-6">
          {/* Colonna DB: score_modulazione_infiammatoria (non rinominabile senza migration).
              Testo mostrato: "Adattamento", allineato all'app Flutter e ai PDF. */}
          <h2 className="font-serif text-lg text-anthracite mb-1"><em className="italic">Adattamento</em></h2>
          <p className="text-sm text-anthracite-lighter mb-3">Capacità di recupero e adattamento</p>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-5xl text-anthracite">{num(measurement.score_modulazione_infiammatoria, 1)}</span>
            <span className="text-sm text-anthracite-lighter">/ 100</span>
          </div>
        </div>
        <div className="card p-6">
          <h2 className="font-serif text-lg text-anthracite mb-1">Indice <em className="italic">composito</em></h2>
          {/* Il composito è calcolato dall'app su 4 dei 5 score: Recupero 30%,
              Equilibrio 25%, Stress invertito 25%, Energia 20%. Adattamento NON
              entra nella formula, quindi il sottotitolo elenca le voci reali. */}
          <p className="text-sm text-anthracite-lighter mb-3">Sintesi di Stress, Recupero, Equilibrio ed Energia</p>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-5xl text-anthracite">{num(measurement.score_composito, 1)}</span>
            <span className="text-sm text-anthracite-lighter">/ 100</span>
          </div>
        </div>
      </section>

      {/* Analisi specifica per tipo di misurazione */}
      {typeKey === 'orthostatic' && (
        <section className="mb-6">
          <OrthostaticView data={measurement.orthostatic_data} />
        </section>
      )}
      {typeKey === 'coherence' && (
        <section className="mb-6">
          <CoherenceView data={measurement.coherence_data} measurement={measurement} />
        </section>
      )}

      <section className="card p-6 mb-6">
        <details>
          <summary className="font-serif text-lg text-anthracite cursor-pointer">Parametri HRV completi</summary>
          <div className="mt-4">
            <HrvParamsTable measurement={measurement} />
          </div>
        </details>
      </section>

      {/* Grafici HRV base: per ortostatica sono già mostrati per fase nella vista dedicata */}
      {typeKey !== 'orthostatic' && (
        <>
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
        </>
      )}

      {/* Analisi misurazioni lunghe */}
      {showLong && (
        <section className="mb-6">
          <LongMeasurementView measurement={measurement} />
        </section>
      )}

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
