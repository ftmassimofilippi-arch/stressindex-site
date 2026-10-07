import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { PrintShell, PrintSection, PrintKv } from '@/components/print/PrintShell'
import { GaugeScore } from '@/components/dashboard/GaugeScore'
import { gaugeZoneKey } from '@/lib/gauge-zones'
import { MeasurementTypeBadge } from '@/components/dashboard/MeasurementTypeBadge'
import { PoincareScatter, Rhythmogram, PsdPlaceholder, PsdPie } from '@/app/[locale]/area-professionisti/clienti/[id]/misurazione/[sessionId]/HrvCharts'
import { HrvParamsTable, ParamsSummaryCard } from '@/app/[locale]/area-professionisti/clienti/[id]/misurazione/[sessionId]/HrvParamsTable'
import { OrthostaticView } from '@/app/[locale]/area-professionisti/clienti/[id]/misurazione/[sessionId]/OrthostaticView'
import { CoherenceView } from '@/app/[locale]/area-professionisti/clienti/[id]/misurazione/[sessionId]/CoherenceView'
import { LongMeasurementView } from '@/app/[locale]/area-professionisti/clienti/[id]/misurazione/[sessionId]/LongMeasurementView'
import { resolvePrintAccess, assertOwnerOrSuperadmin } from '@/lib/print-access'
import { loadClient, loadMeasurementForPrint, loadOwnerProfile, loadPreviousMeasurement } from '@/lib/report-data'
import { age, formatMeasuredAt, fullName, measuredInstant, num, toNum, todayLong } from '@/lib/format'
import { formatDurationHuman, isLongMeasurement, measurementTypeLabel, normalizeTestType } from '@/lib/measurement-type'
import { tagLabel } from '@/lib/before-after'
import { professionalLine } from '@/components/print/PrintShell'
import { fixtureClient, fixtureMeasurement, fixturePrevious, fixtureProfessional, fixturesEnabled, isFixtureKind } from '@/lib/print-fixtures'
import type { Client, MeasurementAnalytics, ProfessionalProfile } from '@/lib/types'
import type { MeasurementWithNotes } from '@/lib/report-data'

export const dynamic = 'force-dynamic'

const SIGNAL_QUALITY = new Set(['good', 'fair', 'poor'])

function delta(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (cur == null || prev == null) return null
  return cur - prev
}

// Pagina di stampa della singola misurazione: riusa i componenti della
// dashboard in modalità `print` (dimensioni fisse, niente controlli). Aperta
// da Chrome headless dalla route /api/pdf/misurazione/[sessionId].
export default async function PrintMeasurementPage({
  params,
  searchParams,
}: {
  params: { locale: string; sessionId: string }
  searchParams?: { clientId?: string; token?: string; fixture?: string; variant?: string }
}) {
  const clientVariant = searchParams?.variant === 'client'
  let measurement: MeasurementWithNotes
  let client: Client
  let professional: ProfessionalProfile | null
  let previous: MeasurementAnalytics | null

  if (fixturesEnabled() && isFixtureKind(searchParams?.fixture)) {
    // Dati di simulazione (solo fuori produzione o con PDF_FIXTURES=true).
    measurement = fixtureMeasurement(searchParams!.fixture as never)
    client = fixtureClient()
    professional = fixtureProfessional()
    previous = fixturePrevious(searchParams!.fixture as never)
  } else {
    const access = await resolvePrintAccess(searchParams?.token, { kind: 'measurement', id: params.sessionId })
    if (!access.ok) notFound()
    const { supabase, userId } = access

    const loaded = await loadMeasurementForPrint(supabase, params.sessionId, searchParams?.clientId)
    if (!loaded) notFound()
    measurement = loaded
    const clientId = measurement.client_id ?? searchParams?.clientId
    const loadedClient = clientId ? await loadClient(supabase, clientId) : null
    if (!loadedClient) notFound()
    client = loadedClient
    // Anche con la sessione: la RLS da sola concede a un superadmin ogni scheda.
    if (!(await assertOwnerOrSuperadmin(supabase, userId, client.professionista_id))) notFound()
    ;[professional, previous] = await Promise.all([
      loadOwnerProfile(supabase, client.professionista_id),
      // Estremo del confronto: l'ISTANTE della misurazione, non la colonna
      // grezza (che è due ore avanti e pescava la misurazione sbagliata).
      loadPreviousMeasurement(
        supabase,
        client.id,
        // Titolare della scheda: serve a cercare la precedente anche fra le
        // misurazioni che il cliente ha fatto dalla propria app, dove
        // `client_id` è NULL e la sola query diretta non trovava niente.
        client.professionista_id,
        (measuredInstant(measurement) ?? new Date(measurement.created_at)).toISOString(),
        measurement.session_id,
      ),
    ])
  }

  const locale = await getLocale()
  const t = await getTranslations('print')
  const tScores = await getTranslations('scores.names')
  const tTypes = await getTranslations('measurement.types')
  const tParams = await getTranslations('measurement.params')
  const tTags = await getTranslations('common.tags')
  const tPdf = await getTranslations('pdf.common')

  const typeKey = normalizeTestType(measurement.test_type)
  const typeLabel = measurementTypeLabel(measurement.test_type, tTypes)
  const hasSegments = Array.isArray(measurement.segments) && measurement.segments.length > 1
  const hasRolling = Array.isArray(measurement.rolling_series) && measurement.rolling_series.length > 0
  const showLong = hasSegments || hasRolling || (isLongMeasurement(measurement) && (typeKey === 'standard' || typeKey === 'unknown'))
  const artifact = toNum(measurement.artifact_percentage)
  const sq = (measurement.signal_quality ?? '').toLowerCase()
  const signalQuality = sq && SIGNAL_QUALITY.has(sq) ? tParams(`quality.${sq}`) : measurement.signal_quality ?? null
  const clientAge = age(client.data_nascita)
  const sexKey = client.sesso === 'M' ? 'sexM' : client.sesso === 'F' ? 'sexF' : client.sesso === 'X' ? 'sexX' : null
  const pro = professionalLine(professional)
  const tags = (measurement.tags ?? []).filter(Boolean)

  const scores = [
    { scheme: 'stress' as const, value: measurement.score_stress, d: delta(measurement.score_stress, previous?.score_stress) },
    { scheme: 'recovery' as const, value: measurement.score_recupero, d: delta(measurement.score_recupero, previous?.score_recupero) },
    { scheme: 'balance' as const, value: measurement.score_equilibrio, d: delta(measurement.score_equilibrio, previous?.score_equilibrio) },
    { scheme: 'energy' as const, value: measurement.score_energia, d: delta(measurement.score_energia, previous?.score_energia) },
    { scheme: 'adaptation' as const, value: measurement.score_modulazione_infiammatoria, d: delta(measurement.score_modulazione_infiammatoria, previous?.score_modulazione_infiammatoria) },
  ]

  const tBands = await getTranslations('scores.bands')
  const tDesc = await getTranslations('scores.bandDescriptions')
  const dateLine = `${formatMeasuredAt(measurement, locale)} · ${typeLabel}`

  if (clientVariant) {
    // Versione per il cliente: solo i 5 score con i tachimetri, bilancio
    // sintetico, ritmogramma, indicazioni e disclaimer. Niente tabelle di
    // parametri né sigle tecniche.
    return (
      <PrintShell clientLine={fullName(client)} dateLine={dateLine} professional={professional}>
        <section className="print-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-[24px] leading-tight text-anthracite">{t('client.measurementTitle')}</h1>
              <p className="text-[11px] text-anthracite-lighter mt-1">{t('client.measurementSubtitle')}</p>
            </div>
            <MeasurementTypeBadge testType={measurement.test_type} />
          </div>
          <div className="grid grid-cols-4 gap-x-4 gap-y-3 mt-4">
            <PrintKv label={t('cover.client')} value={fullName(client) || tPdf('clientFallback')} />
            <PrintKv label={t('cover.dateTime')} value={formatMeasuredAt(measurement, locale)} />
            <PrintKv label={t('cover.duration')} value={formatDurationHuman(measurement.duration_seconds)} />
            <PrintKv label={t('cover.testType')} value={typeLabel} />
            {pro.length > 0 && (
              <div className="col-span-4">
                <PrintKv label={t('cover.professional')} value={pro.slice(0, 3).join(' · ')} />
              </div>
            )}
          </div>
        </section>

        <PrintSection title={t('client.scoresTitle')} subtitle={t('client.scoresSubtitle')} avoid>
          <div className="grid grid-cols-5 gap-2">
            {scores.map((s) => (
              <GaugeScore key={s.scheme} label={tScores(s.scheme)} value={s.value} colorScheme={s.scheme} delta={s.d} print />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="print-card p-4">
              <div className="font-serif text-[14px] text-anthracite">{t('measurement.compositeTitle')}</div>
              <div className="text-[10px] text-anthracite-lighter">{t('measurement.compositeSubtitle')}</div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="font-serif text-[34px] leading-none text-anthracite">{num(measurement.score_composito, 0, locale)}</span>
                <span className="text-[10px] text-anthracite-lighter">/ 100</span>
              </div>
            </div>
            <div className="print-card p-4">
              <div className="font-serif text-[14px] text-anthracite">{t('measurement.adaptationTitle')}</div>
              <div className="text-[10px] text-anthracite-lighter">{t('measurement.adaptationSubtitle')}</div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="font-serif text-[34px] leading-none text-anthracite">{num(measurement.score_modulazione_infiammatoria, 0, locale)}</span>
                <span className="text-[10px] text-anthracite-lighter">/ 100</span>
              </div>
            </div>
          </div>
        </PrintSection>

        <PrintSection title={t('client.readingTitle')} avoid>
          <div className="print-card p-4 divide-y divide-surface-border">
            {scores.map((s) => {
              const zone = s.value != null ? gaugeZoneKey(s.scheme, s.value) : null
              return (
                <div key={s.scheme} className="py-2 flex items-baseline gap-3 text-[10.5px]">
                  <span className="w-28 shrink-0 font-medium text-anthracite">{tScores(s.scheme)}</span>
                  {zone ? (
                    <span className="text-anthracite-light">
                      <span className="font-medium text-anthracite">{tBands(`${s.scheme}.${zone}`)}.</span> {tDesc(`${s.scheme}.${zone}`)}
                    </span>
                  ) : (
                    <span className="text-anthracite-lighter">—</span>
                  )}
                </div>
              )
            })}
          </div>
        </PrintSection>

        {typeKey !== 'orthostatic' && (
          <PrintSection title={t('client.rhythmTitle')} subtitle={t('client.rhythmSubtitle')} avoid>
            <div className="print-card p-4">
              <Rhythmogram rr={measurement.rr_intervals ?? null} print width={640} height={220} />
            </div>
          </PrintSection>
        )}

        {measurement.indicazioni && (
          <PrintSection title={t('client.indicationsTitle')} avoid>
            <div className="print-card p-4 text-[10.5px] whitespace-pre-wrap">{measurement.indicazioni}</div>
          </PrintSection>
        )}

        <PrintSection title={t('disclaimer.title')} avoid>
          <div className="print-card p-4 text-[10px] leading-relaxed text-anthracite-light space-y-2">
            <p>{tPdf('disclaimerPart1')}</p>
            <p>{tPdf('disclaimerPart2')}</p>
            <p className="text-anthracite-lighter">{t('disclaimer.generated', { site: 'stressindex.io', date: todayLong(locale) })}</p>
          </div>
        </PrintSection>
      </PrintShell>
    )
  }

  return (
    <PrintShell clientLine={fullName(client)} dateLine={dateLine} professional={professional}>
      {/* 1. Copertina compatta */}
      <section className="print-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[24px] leading-tight text-anthracite">{t('measurement.title')}</h1>
            <p className="text-[11px] text-anthracite-lighter mt-1">{t('measurement.subtitle')}</p>
          </div>
          <MeasurementTypeBadge testType={measurement.test_type} />
        </div>
        <div className="grid grid-cols-4 gap-x-4 gap-y-3 mt-4">
          <PrintKv label={t('cover.client')} value={fullName(client) || tPdf('clientFallback')} />
          <PrintKv label={t('cover.age')} value={clientAge != null ? t('cover.years', { count: clientAge }) : '—'} />
          <PrintKv label={t('cover.sex')} value={sexKey ? t(`cover.${sexKey}`) : '—'} />
          <PrintKv label={t('cover.testType')} value={typeLabel} />
          <PrintKv label={t('cover.dateTime')} value={formatMeasuredAt(measurement, locale)} />
          <PrintKv label={t('cover.duration')} value={formatDurationHuman(measurement.duration_seconds)} />
          <PrintKv label={t('cover.sensor')} value={measurement.sensor_name ?? measurement.sensor_type ?? 'Polar H10'} />
          <PrintKv
            label={t('cover.signalQuality')}
            value={[signalQuality, artifact != null ? t('cover.artifacts', { value: num(artifact, 1, locale) }) : null].filter(Boolean).join(' · ') || '—'}
          />
          {pro.length > 0 && (
            <div className="col-span-4">
              <PrintKv label={t('cover.professional')} value={pro.slice(0, 3).join(' · ')} />
            </div>
          )}
        </div>
      </section>

      {/* 2. Score con gli stessi tachimetri della dashboard */}
      <PrintSection title={t('measurement.scoresTitle')} subtitle={t('measurement.scoresSubtitle')}>
        <div className="grid grid-cols-5 gap-2">
          {scores.map((s) => (
            <GaugeScore key={s.scheme} label={tScores(s.scheme)} value={s.value} colorScheme={s.scheme} delta={s.d} print />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="print-card p-4">
            <div className="font-serif text-[14px] text-anthracite">{t('measurement.compositeTitle')}</div>
            <div className="text-[10px] text-anthracite-lighter">{t('measurement.compositeSubtitle')}</div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="font-serif text-[34px] leading-none text-anthracite">{num(measurement.score_composito, 1, locale)}</span>
              <span className="text-[10px] text-anthracite-lighter">/ 100</span>
              {previous?.score_composito != null && measurement.score_composito != null && (
                <span className="text-[10px] text-anthracite-lighter ml-2">
                  {measurement.score_composito - previous.score_composito >= 0 ? '▲' : '▼'} {num(Math.abs(measurement.score_composito - previous.score_composito), 1, locale)}
                </span>
              )}
            </div>
          </div>
          <div className="print-card p-4">
            <div className="font-serif text-[14px] text-anthracite">{t('measurement.adaptationTitle')}</div>
            <div className="text-[10px] text-anthracite-lighter">{t('measurement.adaptationSubtitle')}</div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="font-serif text-[34px] leading-none text-anthracite">{num(measurement.score_modulazione_infiammatoria, 1, locale)}</span>
              <span className="text-[10px] text-anthracite-lighter">/ 100</span>
            </div>
          </div>
        </div>
      </PrintSection>

      {/* 3. Sintesi parametri */}
      <PrintSection title={t('measurement.summaryTitle')} avoid>
        <ParamsSummaryCard measurement={measurement} />
      </PrintSection>

      {/* 6a. Sezioni specifiche per tipo */}
      {typeKey === 'orthostatic' && (
        <PrintSection title={t('measurement.orthostaticTitle')} className="print-break-before">
          <OrthostaticView data={measurement.orthostatic_data} print />
        </PrintSection>
      )}
      {typeKey === 'coherence' && (
        <PrintSection title={t('measurement.coherenceTitle')} className="print-break-before">
          <CoherenceView data={measurement.coherence_data} measurement={measurement} print />
        </PrintSection>
      )}

      {/* 4. Grafici HRV (per l'ortostatico sono già per fase nella vista dedicata) */}
      {typeKey !== 'orthostatic' && (
        <PrintSection title={t('measurement.chartsTitle')} className="print-break-before">
          <div className="grid grid-cols-2 gap-3">
            <div className="print-card p-4 print-avoid">
              <h3 className="font-serif text-[13px] text-anthracite">{t('measurement.poincareTitle')}</h3>
              <p className="text-[9.5px] text-anthracite-lighter mb-2">{t('measurement.poincareSubtitle')}</p>
              <PoincareScatter rr={measurement.rr_intervals ?? null} sd1={measurement.sd1} sd2={measurement.sd2} print width={300} />
            </div>
            <div className="print-card p-4 print-avoid">
              <h3 className="font-serif text-[13px] text-anthracite">{t('measurement.psdTitle')}</h3>
              <p className="text-[9.5px] text-anthracite-lighter mb-2">{t('measurement.psdSubtitle')}</p>
              <PsdPlaceholder vlf={measurement.vlf_power} lf={measurement.lf_power} hf={measurement.hf_power} lfHfRatio={measurement.lf_hf_ratio} print width={300} />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3 mt-3">
            <div className="print-card p-4 print-avoid col-span-3">
              <h3 className="font-serif text-[13px] text-anthracite">{t('measurement.rhythmTitle')}</h3>
              <p className="text-[9.5px] text-anthracite-lighter mb-2">{t('measurement.rhythmSubtitle')}</p>
              <Rhythmogram rr={measurement.rr_intervals ?? null} print width={380} height={230} />
            </div>
            <div className="print-card p-4 print-avoid col-span-2">
              <h3 className="font-serif text-[13px] text-anthracite">{t('measurement.pieTitle')}</h3>
              <p className="text-[9.5px] text-anthracite-lighter mb-2">{t('measurement.pieSubtitle')}</p>
              <PsdPie vlf={measurement.vlf_power} lf={measurement.lf_power} hf={measurement.hf_power} print size={150} />
            </div>
          </div>
        </PrintSection>
      )}

      {/* 5. Tabella parametri completa */}
      <PrintSection title={t('measurement.paramsTitle')} subtitle={t('measurement.paramsSubtitle')} className="print-break-before">
        <div className="print-card p-4">
          <HrvParamsTable measurement={measurement} print />
        </div>
      </PrintSection>

      {/* 6b. Misurazioni lunghe */}
      {showLong && (
        <PrintSection title={t('measurement.longTitle')} className="print-break-before">
          <LongMeasurementView measurement={measurement} print />
        </PrintSection>
      )}

      {/* 7. Tag e note */}
      <PrintSection title={t('measurement.notesTitle')} avoid>
        <div className="print-card p-4 text-[10.5px]">
          {tags.length > 0 && (
            <div className="mb-2">
              <div className="text-[9px] uppercase tracking-wide text-anthracite-lighter mb-1">{t('measurement.tags')}</div>
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-teal-light text-teal-dark text-[9.5px]">{tagLabel(tag, tTags)}</span>
                ))}
              </div>
            </div>
          )}
          {measurement.indicazioni && (
            <div className="mb-2">
              <div className="text-[9px] uppercase tracking-wide text-anthracite-lighter mb-1">{t('measurement.indications')}</div>
              <p className="whitespace-pre-wrap">{measurement.indicazioni}</p>
            </div>
          )}
          {measurement.notes_professionista && (
            <div>
              <div className="text-[9px] uppercase tracking-wide text-anthracite-lighter mb-1">{t('measurement.proNotes')}</div>
              <p className="whitespace-pre-wrap">{measurement.notes_professionista}</p>
            </div>
          )}
          {tags.length === 0 && !measurement.indicazioni && !measurement.notes_professionista && (
            <p className="text-anthracite-lighter">{t('measurement.noNotes')}</p>
          )}
        </div>
      </PrintSection>

      {/* 8. Disclaimer completo */}
      <PrintSection title={t('disclaimer.title')} avoid>
        <div className="print-card p-4 text-[10px] leading-relaxed text-anthracite-light space-y-2">
          <p>{tPdf('disclaimerPart1')}</p>
          <p>{tPdf('disclaimerPart2')}</p>
          <p className="text-anthracite-lighter">{t('disclaimer.generated', { site: 'stressindex.io', date: todayLong(locale) })}</p>
        </div>
      </PrintSection>
    </PrintShell>
  )
}
