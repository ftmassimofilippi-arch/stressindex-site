'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, ArrowLeftRight, Loader2, Maximize2, Minimize2, RefreshCw, ShieldCheck } from 'lucide-react'
import { AdvancedTrendChart, type TrendMeasurement } from '@/components/dashboard/AdvancedTrendChart'
import { GaugeScore } from '@/components/dashboard/GaugeScore'
import { MeasurementTypeBadge } from '@/components/dashboard/MeasurementTypeBadge'
import { ScoreBar } from '@/components/dashboard/ScoreBar'
import { PoincareScatter, PsdPie, PsdPlaceholder, Rhythmogram } from '@/app/[locale]/area-professionisti/clienti/[id]/misurazione/[sessionId]/HrvCharts'
import { HrvParamsTable, ParamsSummaryCard } from '@/app/[locale]/area-professionisti/clienti/[id]/misurazione/[sessionId]/HrvParamsTable'
import { OrthostaticView } from '@/app/[locale]/area-professionisti/clienti/[id]/misurazione/[sessionId]/OrthostaticView'
import { CoherenceView } from '@/app/[locale]/area-professionisti/clienti/[id]/misurazione/[sessionId]/CoherenceView'
import { LongMeasurementView } from '@/app/[locale]/area-professionisti/clienti/[id]/misurazione/[sessionId]/LongMeasurementView'
import { ComparisonTable } from '@/app/[locale]/area-professionisti/clienti/[id]/confronto/ComparisonTable'
import { apiErrorMessage } from '@/lib/api-error'
import { formatDate, formatMeasuredAt, measuredInstant, num } from '@/lib/format'
import { formatDurationHuman, isLongMeasurement, normalizeTestType } from '@/lib/measurement-type'
import { trainerPayloadHasForbiddenKeys, type TrainerSharedRow } from '@/lib/trainer-share'
import type { MeasurementAnalytics } from '@/lib/types'

// =============================================================================
// Vista del formatore: professionista → caso → misurazioni, con gli stessi
// componenti della scheda cliente (andamento, confronto, gauge, Poincaré,
// spettro, ritmogramma, tabella dei parametri) alimentati dai dati
// pseudonimizzati. Pensata per lo schermo grande dell'aula: nessun nome oltre a
// quello del professionista che ha condiviso, nessun dato oltre al codice caso.
// =============================================================================

type Caso = {
  key: string
  code: string
  isSelf: boolean
  expiresAt: string
  measurements: MeasurementAnalytics[]
}
type Gruppo = { professionalId: string; name: string; casi: Caso[] }

// Le righe della funzione portano `measurement` senza user_id/client_id: per i
// componenti esistenti bastano valori vuoti in quelle due chiavi.
function toMeasurement(r: TrainerSharedRow): MeasurementAnalytics {
  return { ...(r.measurement as Partial<MeasurementAnalytics>), user_id: '', client_id: r.case_key } as MeasurementAnalytics
}

function raggruppa(rows: TrainerSharedRow[]): Gruppo[] {
  const byPro = new Map<string, Gruppo>()
  for (const r of rows) {
    const g = byPro.get(r.professional_id) ?? { professionalId: r.professional_id, name: r.professional_name ?? '', casi: [] }
    let caso = g.casi.find((c) => c.key === r.case_key)
    if (!caso) {
      caso = { key: r.case_key, code: r.case_code ?? '', isSelf: r.is_self, expiresAt: r.expires_at, measurements: [] }
      g.casi.push(caso)
    }
    caso.measurements.push(toMeasurement(r))
    byPro.set(r.professional_id, g)
  }
  for (const g of byPro.values()) {
    for (const c of g.casi) {
      c.measurements.sort((a, b) => (measuredInstant(b)?.getTime() ?? 0) - (measuredInstant(a)?.getTime() ?? 0))
    }
  }
  return Array.from(byPro.values())
}

export function CasiDidatticiView() {
  const t = useTranslations('admin.casi')
  const tAdmin = useTranslations('admin')
  const tErr = useTranslations('errors.api')
  const tScores = useTranslations('scores.names')
  const tDetail = useTranslations('measurement.detail')
  const locale = useLocale()
  const [rows, setRows] = useState<TrainerSharedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [casoKey, setCasoKey] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [compare, setCompare] = useState<{ a: string | null; b: string | null }>({ a: null, b: null })
  const [aula, setAula] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/admin/casi-didattici', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(apiErrorMessage(json, tErr, t('loadError')))
      setRows([])
    } else {
      const data = (json.rows ?? []) as TrainerSharedRow[]
      // Difesa in profondità anche qui: se arrivasse un campo vietato, la
      // pagina non lo mostra e lo dice.
      const leaked = trainerPayloadHasForbiddenKeys(data)
      if (leaked) {
        setError(t('leakedField', { field: leaked }))
        setRows([])
      } else {
        setRows(data)
      }
    }
    setLoading(false)
  }, [t, tErr])

  useEffect(() => {
    load()
  }, [load])

  const gruppi = useMemo(() => raggruppa(rows), [rows])
  const casi = useMemo(() => gruppi.flatMap((g) => g.casi.map((c) => ({ ...c, professional: g.name }))), [gruppi])
  const caso = casi.find((c) => c.key === casoKey) ?? casi[0] ?? null
  const measurements = caso?.measurements ?? []
  const detail = measurements.find((m) => m.id === detailId) ?? measurements[0] ?? null
  const cmpA = measurements.find((m) => m.id === compare.a) ?? null
  const cmpB = measurements.find((m) => m.id === compare.b) ?? null

  // Cambio caso: il dettaglio e il confronto ripartono da zero.
  function openCaso(key: string) {
    setCasoKey(key)
    setDetailId(null)
    setCompare({ a: null, b: null })
  }

  // "Sé stesso" arriva in italiano dal database: nelle altre lingue si traduce.
  const codeLabel = (c: { code: string; isSelf: boolean }) =>
    c.isSelf ? c.code.replace(/^Sé stesso/, t('self')) || t('self') : c.code || t('noCode')

  const totalMeasurements = casi.reduce((n, c) => n + c.measurements.length, 0)
  const big = aula
  const textBase = big ? 'text-base' : 'text-sm'

  if (loading) {
    return (
      <div className="card p-12 flex items-center justify-center text-anthracite-lighter">
        <Loader2 className="animate-spin mr-2" size={18} /> {tAdmin('loading')}
      </div>
    )
  }

  return (
    <div className={big ? 'text-[17px]' : ''}>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-anthracite-lighter flex-wrap">
          <ShieldCheck size={15} className="text-teal-dark" />
          <span>{t('privacyNote')}</span>
          <span>·</span>
          <span>{t('professionals', { count: gruppi.length })}, {t('cases', { count: casi.length })}, {t('measurements', { count: totalMeasurements })}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAula((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-surface-border hover:bg-surface text-anthracite-lighter"
          >
            {big ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            {big ? t('classroomOff') : t('classroom')}
          </button>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-surface-border hover:bg-surface text-anthracite-lighter"
          >
            <RefreshCw size={15} />
            {tAdmin('refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="callout-amber mb-4 text-sm">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && casi.length === 0 && (
        <div className="card p-10 text-center text-sm text-anthracite-lighter">{t('empty')}</div>
      )}

      {casi.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Colonna sinistra: professionisti e casi */}
          <aside className="xl:col-span-3 space-y-4">
            {gruppi.map((g) => (
              <section key={g.professionalId} className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-border">
                  <div className={`font-medium text-anthracite truncate ${textBase}`}>{g.name || t('unnamedProfessional')}</div>
                  <div className="text-xs text-anthracite-lighter">{t('cases', { count: g.casi.length })}</div>
                </div>
                <ul className="divide-y divide-surface-border">
                  {g.casi.map((c) => {
                    const activeCaso = caso?.key === c.key
                    return (
                      <li key={c.key}>
                        <button
                          type="button"
                          onClick={() => openCaso(c.key)}
                          className={`w-full text-left px-4 py-3 transition-colors ${activeCaso ? 'bg-teal-light/70' : 'hover:bg-surface'}`}
                        >
                          <div className={`font-semibold tabular-nums ${activeCaso ? 'text-teal-dark' : 'text-anthracite'} ${big ? 'text-xl' : 'text-base'}`}>{codeLabel(c)}</div>
                          <div className="text-xs text-anthracite-lighter mt-0.5">
                            {t('measurements', { count: c.measurements.length })} · {t('expires', { date: formatDate(c.expiresAt, undefined, locale) })}
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </aside>

          {/* Colonna destra: il caso scelto */}
          {caso && (
            <div className="xl:col-span-9 space-y-6">
              <header className="card p-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-anthracite-lighter">{t('caseLabel')}</div>
                  <h2 className={`font-serif text-anthracite ${big ? 'text-5xl' : 'text-3xl'}`}>{codeLabel(caso)}</h2>
                  <p className={`mt-1 text-anthracite-lighter ${textBase}`}>
                    {t('sharedBy', { name: (caso as { professional?: string }).professional || t('unnamedProfessional') })} · {t('measurements', { count: measurements.length })}
                  </p>
                </div>
              </header>

              <section className="card p-5">
                <h3 className={`font-serif text-anthracite mb-3 ${big ? 'text-2xl' : 'text-lg'}`}>{t('trendTitle')}</h3>
                <AdvancedTrendChart
                  key={caso.key}
                  measurements={measurements as unknown as TrendMeasurement[]}
                  defaultSelected={['score_stress', 'score_recupero', 'rmssd']}
                  defaultPreset="all"
                  height={big ? 320 : 220}
                  storageKey={`sx-casi-trend`}
                />
              </section>

              <section className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between gap-3 flex-wrap">
                  <h3 className={`font-serif text-anthracite ${big ? 'text-2xl' : 'text-lg'}`}>{t('measurementsTitle')}</h3>
                  <span className="text-xs text-anthracite-lighter">{t('tableHint')}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className={`w-full ${textBase}`}>
                    <thead className="bg-surface text-anthracite-lighter">
                      <tr>
                        <th className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('colDate')}</th>
                        <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('colType')}</th>
                        <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('colDuration')}</th>
                        <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{tScores('stress')}</th>
                        <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{tScores('recovery')}</th>
                        <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">RMSSD</th>
                        <th className="text-right px-5 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('colCompare')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {measurements.map((m) => {
                        const isDetail = detail?.id === m.id
                        return (
                          <tr
                            key={m.id}
                            onClick={() => setDetailId(m.id)}
                            className={`border-t border-surface-border cursor-pointer transition-colors ${isDetail ? 'bg-teal-light/50' : 'hover:bg-surface'}`}
                          >
                            <td className="px-5 py-3 font-medium text-anthracite whitespace-nowrap">{formatMeasuredAt(m, locale)}</td>
                            <td className="px-3 py-3"><MeasurementTypeBadge testType={m.test_type} /></td>
                            <td className="px-3 py-3 text-anthracite-lighter whitespace-nowrap">{formatDurationHuman(m.duration_seconds)}</td>
                            <td className="px-3 py-3 w-40"><ScoreBar value={m.score_stress} inverted /></td>
                            <td className="px-3 py-3 w-40"><ScoreBar value={m.score_recupero} /></td>
                            <td className="px-3 py-3 tabular-nums text-anthracite">{num(m.rmssd, 1, locale)} <span className="text-[10px] text-anthracite-lighter">ms</span></td>
                            <td className="px-5 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setCompare((c) => ({ ...c, a: c.a === m.id ? null : m.id }))}
                                className={`text-[11px] font-medium px-2 py-1 rounded-md border mr-1 ${compare.a === m.id ? 'bg-teal text-white border-teal' : 'border-surface-border text-anthracite-lighter hover:bg-surface'}`}
                              >
                                {t('pickA')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setCompare((c) => ({ ...c, b: c.b === m.id ? null : m.id }))}
                                className={`text-[11px] font-medium px-2 py-1 rounded-md border ${compare.b === m.id ? 'bg-teal text-white border-teal' : 'border-surface-border text-anthracite-lighter hover:bg-surface'}`}
                              >
                                {t('pickB')}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {cmpA && cmpB ? (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowLeftRight size={16} className="text-teal" />
                    <h3 className={`font-serif text-anthracite ${big ? 'text-2xl' : 'text-lg'}`}>{t('compareTitle')}</h3>
                    <span className="text-xs text-anthracite-lighter">{formatMeasuredAt(cmpA, locale)} → {formatMeasuredAt(cmpB, locale)}</span>
                  </div>
                  <ComparisonTable a={cmpA} b={cmpB} />
                </section>
              ) : (
                <p className="text-xs text-anthracite-lighter px-1">{t('compareHint')}</p>
              )}

              {detail && <DettaglioMisurazione m={detail} big={big} tDetail={tDetail} tScores={tScores} locale={locale} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DettaglioMisurazione({
  m,
  big,
  tDetail,
  tScores,
  locale,
}: {
  m: MeasurementAnalytics
  big: boolean
  tDetail: ReturnType<typeof useTranslations>
  tScores: ReturnType<typeof useTranslations>
  locale: string
}) {
  const t = useTranslations('admin.casi')
  const typeKey = normalizeTestType(m.test_type)
  const hasSegments = Array.isArray(m.segments) && m.segments.length > 1
  const hasRolling = Array.isArray(m.rolling_series) && m.rolling_series.length > 0
  const showLong = hasSegments || hasRolling || (isLongMeasurement(m) && (typeKey === 'standard' || typeKey === 'unknown'))
  const titleCls = `font-serif text-anthracite ${big ? 'text-2xl' : 'text-lg'}`

  return (
    <div className="space-y-6" key={m.id}>
      <header className="flex items-center gap-3 flex-wrap">
        <h3 className={titleCls}>{t('detailTitle')}</h3>
        <span className="font-medium text-anthracite">{formatMeasuredAt(m, locale)}</span>
        <MeasurementTypeBadge testType={m.test_type} />
        <span className="text-xs text-anthracite-lighter">{formatDurationHuman(m.duration_seconds)}</span>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GaugeScore label={tScores('stress')} value={m.score_stress} colorScheme="stress" />
        <GaugeScore label={tScores('recovery')} value={m.score_recupero} colorScheme="recovery" />
        <GaugeScore label={tScores('balance')} value={m.score_equilibrio} colorScheme="balance" />
        <GaugeScore label={tScores('energy')} value={m.score_energia} colorScheme="energy" />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6">
          <h4 className="font-serif text-lg text-anthracite mb-1"><em className="italic">{tDetail('adaptationTitle')}</em></h4>
          <p className="text-sm text-anthracite-lighter mb-3">{tDetail('adaptationSubtitle')}</p>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-5xl text-anthracite">{num(m.score_modulazione_infiammatoria, 1, locale)}</span>
            <span className="text-sm text-anthracite-lighter">{tDetail('outOf100')}</span>
          </div>
        </div>
        <div className="card p-6">
          <h4 className="font-serif text-lg text-anthracite mb-1">{tDetail.rich('compositeTitle', { em: (c) => <em className="italic">{c}</em> })}</h4>
          <p className="text-sm text-anthracite-lighter mb-3">{tDetail('compositeSubtitle')}</p>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-5xl text-anthracite">{num(m.score_composito, 1, locale)}</span>
            <span className="text-sm text-anthracite-lighter">{tDetail('outOf100')}</span>
          </div>
        </div>
      </section>

      {typeKey === 'orthostatic' && <OrthostaticView data={m.orthostatic_data} />}
      {typeKey === 'coherence' && <CoherenceView data={m.coherence_data} measurement={m} />}

      <section className="card p-6">
        <div className="mb-4">
          <ParamsSummaryCard measurement={m} />
        </div>
        <details open={big}>
          <summary className="font-serif text-lg text-anthracite cursor-pointer">{tDetail('fullParams')}</summary>
          <div className="mt-4">
            <HrvParamsTable measurement={m} />
          </div>
        </details>
      </section>

      {typeKey !== 'orthostatic' && (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h4 className="font-serif text-base text-anthracite mb-1">{tDetail('poincareTitle')}</h4>
              <p className="text-xs text-anthracite-lighter mb-3">{tDetail('poincareSubtitle')}</p>
              <PoincareScatter rr={m.rr_intervals ?? null} sd1={m.sd1} sd2={m.sd2} />
            </div>
            <div className="card p-6">
              <h4 className="font-serif text-base text-anthracite mb-1">{tDetail('psdTitle')}</h4>
              <p className="text-xs text-anthracite-lighter mb-3">{tDetail('psdSubtitle')}</p>
              <PsdPlaceholder vlf={m.vlf_power} lf={m.lf_power} hf={m.hf_power} lfHfRatio={m.lf_hf_ratio} />
              <div className="mt-6 pt-5 border-t border-surface-border">
                <h4 className="font-serif text-base text-anthracite mb-1">{tDetail('psdPieTitle')}</h4>
                <p className="text-xs text-anthracite-lighter mb-3">{tDetail('psdPieSubtitle')}</p>
                <PsdPie vlf={m.vlf_power} lf={m.lf_power} hf={m.hf_power} />
              </div>
            </div>
          </section>
          <section className="card p-6">
            <h4 className="font-serif text-base text-anthracite mb-1">{tDetail('rhythmTitle')}</h4>
            <p className="text-xs text-anthracite-lighter mb-3">{tDetail('rhythmSubtitle')}</p>
            <Rhythmogram rr={m.rr_intervals ?? null} />
          </section>
        </>
      )}

      {showLong && <LongMeasurementView measurement={m} />}
    </div>
  )
}
