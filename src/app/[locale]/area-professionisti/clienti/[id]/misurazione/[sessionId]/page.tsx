import type { ReactNode } from 'react'
import { Link } from '@/i18n/navigation'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
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

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('measurementDetail.title'), robots: { index: false, follow: false } }
}

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: { locale: string; id: string; sessionId: string }
  searchParams?: { professionista?: string }
}) {
  const locale = await getLocale()
  const t = await getTranslations('measurement.detail')
  const tScores = await getTranslations('scores.names')

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
  const artifact = toNum(measurement.artifact_percentage)

  const typeKey = normalizeTestType(measurement.test_type)
  const hasSegments = Array.isArray(measurement.segments) && measurement.segments.length > 1
  const hasRolling = Array.isArray(measurement.rolling_series) && measurement.rolling_series.length > 0
  // Blocco misurazioni lunghe: mostrato solo quando ci sono dati temporali reali
  // (serie continua o segmenti), oppure la sessione è lunga per durata/tipo.
  const showLong = hasSegments || hasRolling || (isLongMeasurement(measurement) && (typeKey === 'standard' || typeKey === 'unknown'))

  const em = (c: ReactNode) => <em className="italic">{c}</em>

  return (
    <DashboardLayout professional={professional} alertCount={alerts.length}>
      <div className="mb-6">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-anthracite-lighter hover:text-anthracite transition-colors">
          <ArrowLeft size={14} /> {t('backLink', { name: fullName(client) })}
        </Link>
      </div>

      <header className="card p-6 mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-serif text-2xl text-anthracite">{formatMeasuredAt(measurement, locale)}</h1>
              <MeasurementTypeBadge testType={measurement.test_type} />
            </div>
            <p className="text-sm text-anthracite-lighter mt-1">
              {[
                fullName(client),
                duration,
                t('sensor', { sensor: sensorLabel }),
                artifact != null ? t('artifacts', { value: num(artifact, 1, locale) }) : null,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <DownloadMeasurementPdfButton sessionId={measurement.session_id} clientId={client.id} />
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <GaugeScore label={tScores('stress')} value={measurement.score_stress} colorScheme="stress" />
        <GaugeScore label={tScores('recovery')} value={measurement.score_recupero} colorScheme="recovery" />
        <GaugeScore label={tScores('balance')} value={measurement.score_equilibrio} colorScheme="balance" />
        <GaugeScore label={tScores('energy')} value={measurement.score_energia} colorScheme="energy" />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card p-6">
          {/* Colonna DB: score_modulazione_infiammatoria (non rinominabile senza migration).
              Testo mostrato: "Adattamento", allineato all'app Flutter e ai PDF. */}
          <h2 className="font-serif text-lg text-anthracite mb-1"><em className="italic">{t('adaptationTitle')}</em></h2>
          <p className="text-sm text-anthracite-lighter mb-3">{t('adaptationSubtitle')}</p>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-5xl text-anthracite">{num(measurement.score_modulazione_infiammatoria, 1, locale)}</span>
            <span className="text-sm text-anthracite-lighter">{t('outOf100')}</span>
          </div>
        </div>
        <div className="card p-6">
          <h2 className="font-serif text-lg text-anthracite mb-1">{t.rich('compositeTitle', { em })}</h2>
          {/* Il composito è calcolato dall'app su 4 dei 5 score: Recupero 30%,
              Equilibrio 25%, Stress invertito 25%, Energia 20%. Adattamento NON
              entra nella formula, quindi il sottotitolo elenca le voci reali. */}
          <p className="text-sm text-anthracite-lighter mb-3">{t('compositeSubtitle')}</p>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-5xl text-anthracite">{num(measurement.score_composito, 1, locale)}</span>
            <span className="text-sm text-anthracite-lighter">{t('outOf100')}</span>
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
          <summary className="font-serif text-lg text-anthracite cursor-pointer">{t('fullParams')}</summary>
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
              <h3 className="font-serif text-base text-anthracite mb-1">{t('poincareTitle')}</h3>
              <p className="text-xs text-anthracite-lighter mb-3">{t('poincareSubtitle')}</p>
              <PoincareScatter rr={measurement.rr_intervals ?? null} sd1={measurement.sd1} sd2={measurement.sd2} />
            </div>
            <div className="card p-6">
              <h3 className="font-serif text-base text-anthracite mb-1">{t('psdTitle')}</h3>
              <p className="text-xs text-anthracite-lighter mb-3">{t('psdSubtitle')}</p>
              <PsdPlaceholder
                vlf={measurement.vlf_power}
                lf={measurement.lf_power}
                hf={measurement.hf_power}
                lfHfRatio={measurement.lf_hf_ratio}
              />
            </div>
          </section>

          <section className="card p-6 mb-6">
            <h3 className="font-serif text-base text-anthracite mb-1">{t('rhythmTitle')}</h3>
            <p className="text-xs text-anthracite-lighter mb-3">{t('rhythmSubtitle')}</p>
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
        <h3 className="font-serif text-base text-anthracite mb-3">{t('notesTitle')}</h3>
        {measurement.indicazioni && (
          <div className="mb-3">
            <div className="text-xs uppercase tracking-wide text-anthracite-lighter mb-1">{t('indications')}</div>
            <p className="text-sm text-anthracite whitespace-pre-wrap">{measurement.indicazioni}</p>
          </div>
        )}
        {measurement.notes_professionista ? (
          <div>
            <div className="text-xs uppercase tracking-wide text-anthracite-lighter mb-1">{t('proNotes')}</div>
            <p className="text-sm text-anthracite whitespace-pre-wrap">{measurement.notes_professionista}</p>
          </div>
        ) : !measurement.indicazioni ? (
          <p className="text-sm text-anthracite-lighter">{t('noNotes')}</p>
        ) : null}
      </section>
    </DashboardLayout>
  )
}
