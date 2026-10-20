'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Calendar, ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDate, formatIstante, intlTag, measuredDayKey, num, oggiIta } from '@/lib/format'
import { FUSO } from '@/lib/measured-time'
import type { Tr } from '@/i18n/types'
import { GROUP_ORDER, METRIC_MAP, PANEL_NAMES, TREND_METRICS, type MetricDef, type MetricGroup } from '@/lib/trend-metrics.ts'
import { COMPARE_KINDS, type ChartView, type CompareKind } from '@/lib/chart-view.ts'
import { PRESETS, PRESET_KEYS, periodoDaPreset, type Periodo, type PresetKey } from '@/lib/trend-period.ts'
import {
  changeSummary,
  courseBaseline,
  dailyReferenceValues,
  hasLongHistory,
  last60Reference,
  nonReferenceReason,
  periodStartReference,
  previousPeriodReference,
  rollingBand60,
  rollingMean7,
  toCalc,
  toDisplay,
  type ChangeSummary,
  type DailyValue,
  type Reference,
  type ReferenceRow,
} from '@/lib/reference-trend.ts'
import {
  dayNoonMs,
  niceDomain,
  pointRows,
  pointsVisible,
  rollingSegments,
  xDomain,
  xTicks,
  type TrendDayRow,
  type TrendPointRow,
  type TrendRow,
} from '@/lib/trend-panel.ts'

// ============================================================================
// METRICHE
// ============================================================================
// L'elenco vive in `src/lib/trend-metrics.ts` (modulo puro, lo leggono anche
// le pagine server); qui si riesporta per i chiamanti storici.

export { TREND_METRICS, type MetricDef } from '@/lib/trend-metrics.ts'

type Group = MetricGroup

/** Etichetta tradotta di una metrica del trend (`t = useTranslations('charts.metrics')`). */
export function metricLabel(m: MetricDef | string, t: Tr): string {
  return t(typeof m === 'string' ? m : m.key)
}

/** Nome del pannello: parlante dove c'è, altrimenti l'etichetta della metrica. */
export function panelName(key: string, tCharts: Tr, tMetrics: Tr): string {
  return PANEL_NAMES.has(key) ? tCharts(`panel.names.${key}`) : metricLabel(key, tMetrics)
}

function formatValue(value: number | null | undefined, m: MetricDef | undefined, locale: string, withUnit = true): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const formatted = num(value, m?.decimals ?? 1, locale)
  if (!withUnit || !m?.unit) return formatted
  if (m.unit === '/100') return formatted
  if (m.unit === '%') return `${formatted}%`
  return `${formatted} ${m.unit}`
}

// ============================================================================
// CONFRONTI
// ============================================================================
// Con che cosa si confronta la media mobile di oggi. "course" (partenza del
// percorso) è il default e l'unico che non dipende dal periodo scelto.

export type { CompareKind } from '@/lib/chart-view.ts'

/** Una misurazione come arriva dalla scheda (measurement_analytics o sessione sintetizzata). */
export type TrendMeasurement = ReferenceRow & { id?: string }

/** Una riga per giorno già aggregata (home): niente puntini, niente partenza. */
export type DailyTrendRow = { date: string } & Record<string, number | string | null | undefined>

export type TrendAnnotation = { day: string; text: string }

export type PanelSummary = { metric: MetricDef; summary: ChangeSummary; reference: Reference | null }

type Props = {
  /** Misurazioni del cliente, tutta la storia (il periodo si sceglie qui dentro). */
  measurements?: TrendMeasurement[]
  /** In alternativa: serie già aggregata per giorno (home). */
  daily?: DailyTrendRow[]
  defaultSelected?: string[]
  defaultPreset?: PresetKey
  /** Altezza di ogni pannello, in px. */
  height?: number
  /** Base key per localStorage: periodo, metriche, scala, punti. */
  storageKey?: string
  /**
   * Pagina di stampa: nessun comando, nessun localStorage, pannelli a
   * dimensioni fisse, niente tooltip. Periodo = `range`, metriche = `metrics`.
   */
  print?: boolean
  /** Larghezza in px, solo in stampa (default 680). */
  width?: number
  /** Periodo esplicito (yyyy-mm-dd, estremi inclusi), solo in stampa. */
  range?: { from: string; to: string }
  /** Metriche da tracciare, solo in stampa. */
  metrics?: string[]
  /** Preset offerti (la home passa dati tagliati a 365 giorni: "Tutto" non si mostra). */
  presets?: PresetKey[]
  /** `clients.data_inizio_percorso`: la partenza riparte da qui. */
  courseStart?: string | null
  /** `session_id` esclusi dai conti dal professionista. */
  excluded?: Iterable<string> | null
  annotations?: TrendAnnotation[]
  /** Confronto iniziale; il professionista lo cambia dal selettore (salvato in localStorage). */
  compare?: CompareKind
  /** Puntini delle singole misurazioni (default sì). */
  showPoints?: boolean
  /** Modalità cliente: parole semplici, nessun comando. */
  clientMode?: boolean
  /** Contenuto sopra ogni pannello (fase 3: frase di sintesi e i quattro numeri). */
  renderHeader?: (p: PanelSummary) => ReactNode
  /** Chiamata quando cambia il periodo (per chi mostra la regolarità fuori dal grafico). */
  onPeriodChange?: (periodo: Periodo) => void
  /**
   * Vista del cliente (salvata o in bozza): quando c'è vince sul localStorage e
   * ogni cambio fatto dalla barra dei comandi torna su con `onViewChange`.
   */
  view?: ChartView | null
  onViewChange?: (v: ChartView) => void
}

// Larghezza di default del grafico in stampa (px, area utile di un A4).
export const TREND_PRINT_WIDTH = 680
/** Oltre questo numero di pannelli compare l'avviso. */
const MANY_PANELS = 6

export function AdvancedTrendChart({
  measurements,
  daily,
  defaultSelected = ['score_stress', 'score_recupero', 'rmssd'],
  defaultPreset = '30',
  height = 220,
  storageKey,
  print = false,
  width,
  range,
  metrics,
  presets,
  courseStart = null,
  excluded = null,
  annotations = [],
  compare: compareProp = 'course',
  showPoints: showPointsProp,
  clientMode = false,
  renderHeader,
  onPeriodChange,
  view = null,
  onViewChange,
}: Props) {
  const locale = useLocale()
  const t = useTranslations('charts')
  const tMetrics = useTranslations('charts.metrics')
  const presetList = useMemo(() => (presets ? PRESETS.filter((p) => presets.includes(p.key)) : PRESETS), [presets])
  const excludedSet = useMemo(() => new Set(excluded ?? []), [excluded])

  // periodo
  const [activeKey, setActiveKey] = useState<PresetKey>(view?.preset ?? defaultPreset)
  const [customFrom, setCustomFrom] = useState(() => view?.customFrom ?? giornoFa(30))
  const [customTo, setCustomTo] = useState(() => view?.customTo ?? oggiIta())

  // selezione metriche, scala, punti
  const [selected, setSelected] = useState<string[]>(() => (view?.metrics ?? defaultSelected).filter((k) => METRIC_MAP[k]))
  const [fullScale, setFullScale] = useState(view?.scale === 'full')
  const [compare, setCompare] = useState<CompareKind>(view?.compare ?? compareProp)
  const [showPoints, setShowPoints] = useState(showPointsProp ?? view?.points ?? !clientMode)

  // La vista arriva dal padre (salvata o bozza): ogni cambio si riflette qui...
  useEffect(() => {
    if (!view) return
    setActiveKey(view.preset)
    if (view.customFrom) setCustomFrom(view.customFrom)
    if (view.customTo) setCustomTo(view.customTo)
    setSelected(view.metrics.filter((k) => METRIC_MAP[k]))
    setFullScale(view.scale === 'full')
    setCompare(view.compare)
    if (showPointsProp == null) setShowPoints(view.points)
  }, [view, showPointsProp])
  // ...e ogni cambio fatto dai comandi torna su, così la bozza resta in pari.
  const currentView = useMemo<ChartView>(() => ({
    metrics: selected,
    preset: activeKey,
    customFrom: activeKey === 'custom' ? customFrom : null,
    customTo: activeKey === 'custom' ? customTo : null,
    compare,
    points: showPoints,
    scale: fullScale ? 'full' : 'fit',
  }), [selected, activeKey, customFrom, customTo, compare, showPoints, fullScale])
  useEffect(() => { onViewChange?.(currentView) }, [currentView, onViewChange])
  const [panelOpen, setPanelOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<Group>>(() => new Set(['score']))

  useEffect(() => {
    if (showPointsProp != null) setShowPoints(showPointsProp)
  }, [showPointsProp])
  useEffect(() => { setCompare(compareProp) }, [compareProp])

  // hydration da localStorage (mai in stampa né con una vista del cliente: contano solo le prop)
  useEffect(() => {
    if (print || view || typeof window === 'undefined' || !storageKey) return
    const savedPreset = window.localStorage.getItem(`${storageKey}:range`)
    const savedMetrics = window.localStorage.getItem(`${storageKey}:metrics`)
    const savedScale = window.localStorage.getItem(`${storageKey}:scale`)
    const savedPoints = window.localStorage.getItem(`${storageKey}:points`)
    const savedCompare = window.localStorage.getItem(`${storageKey}:compare`)
    if (savedCompare && (COMPARE_KINDS as string[]).includes(savedCompare)) setCompare(savedCompare as CompareKind)
    if (savedPreset && PRESET_KEYS.has(savedPreset) && (!presets || presets.includes(savedPreset as PresetKey) || savedPreset === 'custom')) {
      setActiveKey(savedPreset as PresetKey)
    }
    if (savedScale === 'full') setFullScale(true)
    if (savedPoints === '0' && showPointsProp == null) setShowPoints(false)
    if (savedMetrics) {
      try {
        const arr = JSON.parse(savedMetrics) as string[]
        if (Array.isArray(arr) && arr.length) setSelected(arr.filter((k) => METRIC_MAP[k]))
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function persist(suffix: string, value: string) {
    if (typeof window !== 'undefined' && storageKey) window.localStorage.setItem(`${storageKey}:${suffix}`, value)
  }
  function setRange(k: PresetKey) {
    setActiveKey(k)
    persist('range', k)
  }
  function toggleScale() {
    setFullScale((v) => { persist('scale', v ? 'fit' : 'full'); return !v })
  }
  function togglePoints() {
    setShowPoints((v) => { persist('points', v ? '0' : '1'); return !v })
  }
  function chooseCompare(k: CompareKind) {
    setCompare(k)
    persist('compare', k)
  }
  function toggleMetric(key: string) {
    setSelected((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      persist('metrics', JSON.stringify(next))
      return next
    })
  }
  function bulkSelectGroup(g: Group) {
    setSelected((prev) => {
      const next = [...prev]
      for (const m of TREND_METRICS) if (m.group === g && !next.includes(m.key)) next.push(m.key)
      persist('metrics', JSON.stringify(next))
      return next
    })
  }
  function resetSelection() {
    const next = defaultSelected.filter((k) => METRIC_MAP[k])
    setSelected(next)
    persist('metrics', JSON.stringify(next))
  }
  function toggleGroupExpanded(g: Group) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  // In stampa periodo e metriche vengono solo dalle prop.
  const effectiveKey: PresetKey = print ? (range ? 'custom' : defaultPreset) : activeKey
  const effectiveFrom = print && range ? range.from : customFrom
  const effectiveTo = print && range ? range.to : customTo

  // Periodo (giorni italiani, estremi inclusi; null = tutto).
  const periodo = useMemo(
    () => periodoDaPreset(effectiveKey, { from: effectiveFrom, to: effectiveTo }),
    [effectiveKey, effectiveFrom, effectiveTo],
  )
  useEffect(() => { onPeriodChange?.(periodo) }, [periodo, onPeriodChange])

  const renderedKeys = useMemo(
    () => (print ? (metrics ?? defaultSelected) : selected).filter((k) => METRIC_MAP[k]),
    [print, metrics, defaultSelected, selected],
  )

  // "Ultimi 60 giorni" solo con 60 giorni di storia di riferimento (su una
  // metrica qualsiasi: la storia è la stessa per tutte).
  const longHistory = useMemo(
    () => !!measurements && hasLongHistory(dailyReferenceValues(measurements, 'score_stress', { excluded: excludedSet })),
    [measurements, excludedSet],
  )

  // Quante misurazioni cadono nel periodo e quante sono di riferimento (didascalia).
  const counts = useMemo(() => {
    if (!measurements) return null
    const rows = measurements
      .map((m) => ({ m, day: measuredDayKey(m) }))
      .filter((r): r is { m: TrendMeasurement; day: string } => !!r.day && inPeriodo(r.day, periodo))
    const reference = rows.filter((r) => nonReferenceReason(r.m, excludedSet) == null).length
    const days = rows.map((r) => r.day).sort()
    return { total: rows.length, reference, from: days[0] ?? null, to: days[days.length - 1] ?? null }
  }, [measurements, periodo, excludedSet])

  const presetBtn = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
      active
        ? 'bg-teal-dark text-white border-teal-dark'
        : 'bg-white border-surface-border text-anthracite-lighter hover:bg-surface hover:text-anthracite'
    }`

  const chartW = width ?? TREND_PRINT_WIDTH
  const panels = renderedKeys.map((k) => (
    <MetricPanel
      key={k}
      metric={METRIC_MAP[k]}
      measurements={measurements}
      daily={daily}
      periodo={periodo}
      courseStart={courseStart}
      excluded={excludedSet}
      annotations={annotations}
      compare={compare}
      fullScale={fullScale}
      showPoints={showPoints}
      clientMode={clientMode}
      print={print}
      width={print ? chartW : undefined}
      height={height}
      renderHeader={renderHeader}
    />
  ))

  if (print) {
    return (
      <div className="space-y-4">
        {renderedKeys.length === 0 ? (
          <div className="py-6 text-center text-sm text-anthracite-lighter">
            {t.rich('trend.noMetricSelected', { em: (c) => <em>{c}</em> })}
          </div>
        ) : panels}
      </div>
    )
  }

  return (
    <div>
      {!clientMode && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {presetList.map((p) => (
            <button key={p.key} type="button" onClick={() => setRange(p.key)} className={presetBtn(activeKey === p.key)}>
              {t(`presets.${p.labelKey}`)}
            </button>
          ))}
          <button type="button" onClick={() => setRange('custom')} className={`flex items-center gap-1.5 ${presetBtn(activeKey === 'custom')}`}>
            <Calendar size={12} /> {t('presets.custom')}
          </button>
          {activeKey === 'custom' && (
            <div className="flex flex-wrap items-center gap-1.5 ml-2">
              <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className="text-xs px-2 py-1 border border-surface-border rounded-lg bg-white text-anthracite" />
              <span className="text-xs text-anthracite-lighter">→</span>
              <input type="date" value={customTo} min={customFrom} max={oggiIta()} onChange={(e) => setCustomTo(e.target.value)} className="text-xs px-2 py-1 border border-surface-border rounded-lg bg-white text-anthracite" />
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {measurements && (
              <button type="button" onClick={togglePoints} aria-pressed={showPoints} className={presetBtn(showPoints)} title={t('panel.showPointsTitle')}>
                {t('panel.showPoints')}
              </button>
            )}
            <button type="button" onClick={toggleScale} aria-pressed={fullScale} className={presetBtn(fullScale)} title={fullScale ? t('panel.fitScale') : t('panel.fullScale')}>
              {t('panel.fullScale')}
            </button>
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-anthracite text-white hover:bg-anthracite-lighter whitespace-nowrap transition-colors"
            >
              <SlidersHorizontal size={13} /> {t('trend.selectMetrics')}
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/15 text-[10px]">{selected.length}</span>
            </button>
          </div>
        </div>
      )}

      {/* Didascalia (quante misurazioni di riferimento su quante nel periodo) e confronto. */}
      {counts && !clientMode && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 text-xs text-anthracite-lighter">
          {counts.from && counts.to && (
            <span aria-live="polite">
              {t(periodo ? 'panel.countsCaption' : 'panel.countsCaptionAll', {
                reference: counts.reference,
                total: counts.total,
                from: formatDate(counts.from, undefined, locale),
                to: formatDate(counts.to, undefined, locale),
              })}
            </span>
          )}
          {!clientMode && (
            <label className="inline-flex items-center gap-1.5">
              {t('panel.compare.label')}
              <select
                value={compare}
                onChange={(e) => chooseCompare(e.target.value as CompareKind)}
                className="text-xs px-2 py-1 border border-surface-border rounded-lg bg-white text-anthracite"
              >
                <option value="course">{t('panel.compare.course')}</option>
                <option value="periodStart" disabled={!periodo} title={!periodo ? t('panel.compare.needsPeriod') : undefined}>{t('panel.compare.periodStart')}</option>
                <option value="previous" disabled={!periodo} title={!periodo ? t('panel.compare.needsPeriod') : undefined}>{t('panel.compare.previous')}</option>
                <option value="last60" disabled={!longHistory} title={!longHistory ? t('panel.compare.last60Hint') : undefined}>{t('panel.compare.last60')}</option>
              </select>
            </label>
          )}
        </div>
      )}
      {daily && !clientMode && <p className="text-xs text-anthracite-lighter mb-3">{t('panel.homeCaption')}</p>}
      {renderedKeys.length > MANY_PANELS && (
        <p className="text-xs text-amber-700 mb-3">{t('panel.manyPanels', { count: renderedKeys.length })}</p>
      )}

      {renderedKeys.length === 0 ? (
        <div className="py-10 text-center text-sm text-anthracite-lighter">
          {t.rich('trend.noMetricSelected', { em: (c) => <em>{c}</em> })}
        </div>
      ) : (
        <div className="space-y-5">{panels}</div>
      )}

      {panelOpen && (
        <MetricsPanel
          onClose={() => setPanelOpen(false)}
          search={search}
          setSearch={setSearch}
          selected={selected}
          toggleMetric={toggleMetric}
          expandedGroups={expandedGroups}
          toggleGroupExpanded={toggleGroupExpanded}
          bulkSelectGroup={bulkSelectGroup}
          resetSelection={resetSelection}
        />
      )}
    </div>
  )
}

function giornoFa(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000)
  return oggiIta(d)
}

function inPeriodo(day: string, periodo: Periodo): boolean {
  return !periodo || (day >= periodo.from && day <= periodo.to)
}

// ============================================================================
// PANNELLO DI UNA METRICA
// ============================================================================

const BAND_FILL = '#CBD5E1'
const BAND_STROKE = '#94A3B8'

function MetricPanel({
  metric,
  measurements,
  daily,
  periodo,
  courseStart,
  excluded,
  annotations,
  compare,
  fullScale,
  showPoints,
  clientMode,
  print,
  width,
  height,
  renderHeader,
}: {
  metric: MetricDef
  measurements?: TrendMeasurement[]
  daily?: DailyTrendRow[]
  periodo: Periodo
  courseStart: string | null
  excluded: ReadonlySet<string>
  annotations: TrendAnnotation[]
  compare: CompareKind
  fullScale: boolean
  showPoints: boolean
  clientMode: boolean
  print: boolean
  width?: number
  height: number
  renderHeader?: (p: PanelSummary) => ReactNode
}) {
  const locale = useLocale()
  const t = useTranslations('charts')
  const tMetrics = useTranslations('charts.metrics')
  const tTypes = useTranslations('measurement.types')
  const isScore = metric.group === 'score'
  const today = oggiIta()

  // Valori giornalieri di riferimento su tutta la storia (i conti non seguono il periodo).
  const dailyValues: DailyValue[] = useMemo(() => {
    if (measurements) return dailyReferenceValues(measurements, metric.key, { excluded })
    if (daily) {
      return daily
        .map((r) => {
          const raw = r[metric.key]
          const v = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
          return Number.isFinite(v) ? { day: r.date, value: toCalc(metric.key, v), n: 1 } : null
        })
        .filter((d): d is DailyValue => d != null && Number.isFinite(d.value))
        .sort((a, b) => (a.day < b.day ? -1 : 1))
    }
    return []
  }, [measurements, daily, metric.key, excluded])

  // Senza giorni di riferimento i puntini restano accesi anche se spenti dal
  // professionista, in "Mostra al cliente" e nel report versione cliente:
  // una misurazione che esiste non deve sparire dal grafico.
  const pointsOn = pointsVisible(showPoints, dailyValues.length)
  const allPoints = useMemo(
    () => (measurements && pointsOn ? pointRows(measurements, metric.key, excluded) : []),
    [measurements, pointsOn, metric.key, excluded],
  )
  const rolling = useMemo(() => rollingMean7(dailyValues), [dailyValues])
  const { rows: dayRows, segments } = useMemo(() => rollingSegments(rolling, metric.key), [rolling, metric.key])

  // Confronto: solo con le misurazioni (sulla home non c'è un percorso).
  const asOf = periodo?.to ?? null
  const lastDayShown = useMemo(() => {
    let last: string | null = null
    for (const d of dailyValues) { if (!asOf || d.day <= asOf) last = d.day }
    return last
  }, [dailyValues, asOf])
  const longHistory = hasLongHistory(dailyValues)
  const effectiveCompare: CompareKind = !measurements ? 'course'
    : compare === 'last60' && !longHistory ? 'course'
    : (compare === 'periodStart' || compare === 'previous') && !periodo ? 'course'
    : compare
  const reference: Reference | null = useMemo(() => {
    if (!measurements) return null
    switch (effectiveCompare) {
      case 'periodStart': return periodo ? periodStartReference(dailyValues, periodo.from) : null
      case 'previous': return periodo ? previousPeriodReference(dailyValues, periodo.from, periodo.to) : null
      case 'last60': return lastDayShown ? last60Reference(dailyValues, lastDayShown) : null
      default: return courseBaseline(dailyValues, courseStart)
    }
  }, [measurements, effectiveCompare, dailyValues, periodo, courseStart, lastDayShown])
  const summary = useMemo(
    () => changeSummary(metric.key, dailyValues, reference, { asOf, period: periodo ?? undefined }),
    [metric.key, dailyValues, reference, asOf, periodo],
  )
  // Fascia dinamica: una fascia per giorno, sui 60 giorni precedenti.
  const dynamicBand = useMemo(() => {
    if (effectiveCompare !== 'last60') return null
    const byDay = new Map(rollingBand60(dailyValues).map((b) => [b.day, b.reference]))
    return byDay
  }, [effectiveCompare, dailyValues])

  // Righe del grafico dentro il periodo: puntini + giorni della media mobile.
  const rows: TrendRow[] = useMemo(() => {
    const pts = allPoints.filter((p) => inPeriodo(p.day, periodo))
    const days = dayRows
      .filter((d) => inPeriodo(d.day, periodo))
      .map((d) => {
        if (!dynamicBand) return d
        const r = dynamicBand.get(d.day)
        return r?.band ? { ...d, band: [toDisplay(metric.key, r.band.low), toDisplay(metric.key, r.band.high)] } : d
      })
    return [...pts, ...days].sort((a, b) => a.x - b.x)
  }, [allPoints, dayRows, periodo, dynamicBand, metric.key])

  const band = effectiveCompare === 'last60' ? null : summary.band
  const yDomain = useMemo(() => niceDomain([
    ...rows.map((r) => (r.kind === 'point' ? r.value : r.rolling)),
    ...rows.flatMap((r) => ('band' in r && Array.isArray(r.band) ? (r.band as number[]) : [])),
    band?.low, band?.high,
  ], { score: isScore, full: fullScale }), [rows, band, isScore, fullScale])
  const xdom = useMemo(() => xDomain(periodo, rows, today), [periodo, rows, today])
  const ticks = useMemo(() => xTicks(xdom), [xdom])

  const tickDate = useMemo(() => new Intl.DateTimeFormat(intlTag(locale), { day: 'numeric', month: 'short', timeZone: FUSO }), [locale])
  const fmtTick = (v: unknown) => tickDate.format(new Date(Number(v)))
  const fmtY = (v: unknown) => num(Number(v), metric.decimals && metric.decimals > 1 ? metric.decimals : 0, locale)

  const lastDayRow = [...rows].reverse().find((r): r is TrendDayRow => r.kind === 'day') ?? null
  const referenceInPeriod = dailyValues.some((d) => inPeriodo(d.day, periodo))
  const baselineOutside = !!reference && !!periodo && effectiveCompare === 'course' && reference.lastDay < periodo.from
  const bandLabelKey = effectiveCompare === 'course' ? (clientMode ? 'panel.bandCourseClient' : 'panel.bandCourse')
    : effectiveCompare === 'periodStart' ? 'panel.bandPeriodStart'
    : effectiveCompare === 'previous' ? 'panel.bandPrevious' : 'panel.band60'
  const better = summary.higherIsBetter ? t('panel.betterHigher') : t('panel.betterLower')
  const name = panelName(metric.key, t, tMetrics)
  const pctText = summary.pct == null ? null : `${summary.pct > 0 ? '+' : ''}${num(summary.pct, 0, locale)}%`

  const chart = (
    <ComposedChart data={rows} {...(print && width ? { width, height } : {})} margin={{ top: 10, right: 64, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
      <XAxis type="number" dataKey="x" domain={xdom} ticks={ticks} tickFormatter={fmtTick} stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} allowDataOverflow />
      <YAxis domain={yDomain} tickFormatter={fmtY} stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} width={40} allowDataOverflow />
      {!print && (
        <Tooltip
          content={<PanelTooltip locale={locale} metric={metric} t={t} tTypes={tTypes} />}
          cursor={{ stroke: '#94A3B8', strokeDasharray: '3 3' }}
          isAnimationActive={false}
        />
      )}
      {band && (
        <ReferenceArea
          y1={band.low}
          y2={band.high}
          fill={BAND_FILL}
          fillOpacity={0.35}
          stroke={band.provisional ? BAND_STROKE : 'none'}
          strokeDasharray="4 3"
          ifOverflow="visible"
          label={{ value: t(bandLabelKey), position: 'insideTopLeft', fill: '#64748B', fontSize: 10 }}
        />
      )}
      {dynamicBand && (
        <Area dataKey="band" stroke="none" fill={BAND_FILL} fillOpacity={0.35} connectNulls isAnimationActive={false} activeDot={false} />
      )}
      {annotations.filter((a) => inPeriodo(a.day, periodo)).map((a) => (
        <ReferenceLine key={`${a.day}-${a.text}`} x={dayNoonMs(a.day)} stroke="#64748B" strokeDasharray="3 3" label={{ value: a.text, position: 'top', fill: '#475569', fontSize: 10 }} />
      ))}
      {pointsOn && measurements && (
        <Line dataKey="value" stroke="none" dot={<PointDot color={metric.color} />} activeDot={{ r: 5, fill: metric.color }} isAnimationActive={false} connectNulls={false} legendType="none" />
      )}
      {daily && (
        <Line dataKey="rolling" stroke={metric.color} strokeOpacity={0.25} strokeWidth={1} dot={false} activeDot={false} connectNulls isAnimationActive={false} />
      )}
      {segments.map((s) => (
        <Line
          key={s.key}
          dataKey={s.key}
          stroke={metric.color}
          strokeWidth={2.5}
          strokeDasharray={s.dashed ? '6 4' : undefined}
          dot={false}
          activeDot={{ r: 4, fill: metric.color }}
          connectNulls
          isAnimationActive={false}
        />
      ))}
      {lastDayRow && (
        <ReferenceDot
          x={lastDayRow.x}
          y={lastDayRow.rolling}
          r={4}
          fill={metric.color}
          stroke="#fff"
          ifOverflow="visible"
          label={<EndLabel text={formatValue(lastDayRow.rolling, metric, locale, false)} sub={measurements ? pctText : null} color={metric.color} />}
        />
      )}
    </ComposedChart>
  )

  return (
    // In stampa ogni pannello è una card a sé: un'unica card con tre pannelli
    // non entrava in una pagina e saltava tutta alla successiva.
    <section className={print ? 'print-card p-4 break-inside-avoid' : ''} aria-label={name}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1">
        <span className="inline-flex items-center gap-1.5 font-medium text-anthracite text-sm">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: metric.color }} />
          {name}
          {metric.unit && metric.unit !== '/100' && <span className="text-anthracite-lighter font-normal">({metric.unit})</span>}
        </span>
        <span className="text-xs text-anthracite-lighter">{summary.higherIsBetter ? '↑' : '↓'} {better}</span>
      </div>
      {measurements && (renderHeader
        ? renderHeader({ metric, summary, reference })
        : <PanelHeader metric={metric} name={name} summary={summary} reference={reference} compare={effectiveCompare} clientMode={clientMode} print={print} />)}

      {measurements && dailyValues.length === 0 && (
        <p className="text-xs text-amber-700 mb-2">{t('panel.noReference', { count: allPoints.length || measurements.length })}</p>
      )}
      {measurements && dailyValues.length > 0 && !referenceInPeriod && (
        <p className="text-xs text-amber-700 mb-2">{t('panel.noReferenceInPeriod')}</p>
      )}

      {rows.length === 0 ? (
        // Con misurazioni fuori dal periodo si dice che esistono: "nessun dato"
        // da solo faceva pensare a una scheda vuota.
        <div className="py-8 text-center text-sm text-anthracite-lighter">
          {measurements && measurements.length > 0 ? t('trend.noDataInPeriodOutside', { count: measurements.length }) : t('trend.noDataInPeriod')}
        </div>
      ) : print && width ? (
        <div style={{ width, height }}>{chart}</div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>{chart}</ResponsiveContainer>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-anthracite-lighter">
        {measurements && pointsOn && (
          <>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: metric.color }} /> {t('panel.referencePoint')}</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full border bg-white" style={{ borderColor: metric.color }} /> {t('panel.otherPoint')}</span>
          </>
        )}
        <span className="inline-flex items-center gap-1"><span className="w-4 h-0.5" style={{ backgroundColor: metric.color }} /> {t('panel.rolling')}</span>
        {band && (
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: BAND_FILL }} /> {t(bandLabelKey)}
            {band.provisional && <span>· {t('panel.bandProvisional', { n: summary.startN })}</span>}
          </span>
        )}
        {measurements && reference && !band && effectiveCompare !== 'last60' && <span>{t('panel.bandNone')}</span>}
        {baselineOutside && reference && (
          <span>{t('panel.baselineOutside', { from: formatDate(reference.firstDay, undefined, locale), to: formatDate(reference.lastDay, undefined, locale) })}</span>
        )}
      </div>
    </section>
  )
}

// ── Frase di sintesi e i quattro numeri ──────────────────────────────────────

const VERDICT_CLASS: Record<ChangeSummary['verdict'], string> = {
  improved: 'text-emerald-700',
  declined: 'text-rose-700',
  stable: 'text-anthracite',
  unknown: 'text-anthracite-lighter',
}

/** Valore "umano": score senza decimali, il resto con i decimali della metrica. */
function fmtHuman(v: number | null | undefined, metric: MetricDef, locale: string): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (metric.group === 'score') return num(v, 0, locale)
  return formatValue(v, metric, locale)
}

/**
 * Sopra ogni pannello: la frase generata dai numeri e i quattro numeri
 * (partenza, adesso, variazione, regolarità). La freccia segue il verso del
 * numero, il colore il significato: per lo Stress un calo è verde.
 */
export function PanelHeader({ metric, name, summary, reference, compare, clientMode, print }: {
  metric: MetricDef
  name: string
  summary: ChangeSummary
  reference: Reference | null
  compare: CompareKind
  clientMode: boolean
  print: boolean
}) {
  const t = useTranslations('charts')
  const locale = useLocale()
  const s = summary
  const bandOf = t(`panel.bandOf.${compare}`)
  const pctAbs = s.pct == null ? null : num(Math.abs(s.pct), 0, locale)

  let main: string | null = null
  let detail: string | null = null
  if (s.start != null && s.now != null && pctAbs != null) {
    const start = fmtHuman(s.start, metric, locale)
    const now = fmtHuman(s.now, metric, locale)
    main = Math.abs(s.pct!) < 0.5
      ? t('panel.summary.flat', { name, now })
      : t(s.pct! > 0 ? 'panel.summary.up' : 'panel.summary.down', { name, pct: pctAbs, start, now })
    if (s.provisional) {
      detail = t('panel.summary.provisional', { n: s.startProvisional || s.band == null ? s.startN : s.nowN })
    } else if (s.verdict === 'stable') detail = t('panel.summary.stable', { band: bandOf })
    else if (s.verdict === 'improved') detail = t('panel.summary.realGood', { band: bandOf })
    else if (s.verdict === 'declined') detail = t('panel.summary.realBad', { band: bandOf })
  }

  const changeText = s.pct == null || pctAbs == null ? t('panel.numbers.unknown')
    : s.verdict === 'stable' ? t('panel.numbers.stable')
    : s.verdict === 'improved' ? t('panel.numbers.improved', { pct: pctAbs })
    : s.verdict === 'declined' ? t('panel.numbers.declined', { pct: pctAbs })
    : `${s.pct > 0 ? '+' : ''}${num(s.pct, 0, locale)}%`
  const arrow = s.pct == null ? '' : Math.abs(s.pct) < 0.5 ? '→' : s.pct > 0 ? '↑' : '↓'
  const big = clientMode
  const cell = `rounded-xl border border-surface-border bg-surface/60 px-3 ${big ? 'py-3' : 'py-2'} min-w-0`
  const label = `text-[10px] uppercase tracking-wide text-anthracite-lighter truncate`
  const value = `font-serif ${big ? 'text-3xl' : 'text-xl'} text-anthracite mt-0.5 tabular-nums`
  const sub = 'text-[10px] text-anthracite-lighter truncate'

  return (
    <div className={print ? 'mb-2' : 'mb-3'}>
      {main ? (
        <p className={`${big ? 'text-lg' : 'text-sm'} text-anthracite leading-snug`}>
          <b>{main}</b>{' '}
          {detail && <span className={s.provisional ? 'text-amber-700' : VERDICT_CLASS[s.verdict]}>{detail}</span>}
        </p>
      ) : (
        <p className="text-sm text-anthracite-lighter">{t('panel.summary.none')}</p>
      )}
      {s.start != null && s.now != null && (
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${big ? 'mt-3' : 'mt-2'}`}>
          <div className={cell}>
            <div className={label}>{t(clientMode ? 'panel.numbers.startClient' : 'panel.numbers.start')}</div>
            <div className={value}>{fmtHuman(s.start, metric, locale)}</div>
            <div className={sub}>
              {s.startProvisional
                ? t('panel.numbers.startProvisional', { n: s.startN })
                : reference ? t('panel.numbers.startRange', { from: formatDate(reference.firstDay, undefined, locale), to: formatDate(reference.lastDay, undefined, locale) }) : ''}
            </div>
          </div>
          <div className={cell}>
            <div className={label}>{t('panel.numbers.now')}</div>
            <div className={value}>{fmtHuman(s.now, metric, locale)}</div>
            <div className={sub}>{s.nowDay ? t('panel.numbers.nowDay', { date: formatDate(s.nowDay, undefined, locale) }) : ''}</div>
          </div>
          <div className={cell}>
            <div className={label}>{t('panel.numbers.change')}</div>
            <div className={`${value} ${VERDICT_CLASS[s.verdict]} flex items-baseline gap-1`}>
              <span className={big ? 'text-4xl leading-none' : ''}>{arrow}</span>
              <span className={big ? 'text-xl font-sans' : 'text-base font-sans'}>{changeText}</span>
            </div>
          </div>
          {!clientMode && (
            <div className={cell}>
              <div className={label}>{t('panel.numbers.regularity')}</div>
              <div className={value}>{s.regularity ? num(s.regularity.days, 0, locale) : '—'}</div>
              <div className={sub}>{s.regularity ? t('panel.numbers.regularityValue', { days: s.regularity.days, total: s.regularity.total }) : ''}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Puntino di una misurazione: pieno se di riferimento, vuoto se fuori dai conti, barrato se esclusa. */
function PointDot(props: { cx?: number; cy?: number; payload?: TrendRow; color: string }) {
  const { cx, cy, payload, color } = props
  if (cx == null || cy == null || !payload || payload.kind !== 'point') return null
  if (payload.reason === 'excluded') {
    return (
      <g>
        <circle cx={cx} cy={cy} r={3.5} fill="#fff" stroke={color} strokeWidth={1.5} />
        <line x1={cx - 5} y1={cy + 5} x2={cx + 5} y2={cy - 5} stroke={color} strokeWidth={1.5} />
      </g>
    )
  }
  if (payload.reason) return <circle cx={cx} cy={cy} r={3} fill="#fff" stroke={color} strokeWidth={1.5} />
  return <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#fff" strokeWidth={1} />
}

/** Etichetta a destra dell'ultimo punto della media mobile: valore e variazione. */
function EndLabel(props: { viewBox?: { x?: number; y?: number }; text: string; sub: string | null; color: string }) {
  const x = (props.viewBox?.x ?? 0) + 8
  const y = props.viewBox?.y ?? 0
  return (
    <g>
      <text x={x} y={y + 4} fill={props.color} fontSize={12} fontWeight={600}>{props.text}</text>
      {props.sub && <text x={x} y={y + 17} fill="#64748B" fontSize={10}>{props.sub}</text>}
    </g>
  )
}

type TooltipEntry = { payload?: TrendRow }

function PanelTooltip(props: { active?: boolean; payload?: TooltipEntry[]; locale: string; metric: MetricDef; t: Tr; tTypes: Tr }) {
  const { active, payload, locale, metric, t, tTypes } = props
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  if (row.kind === 'point') {
    const p = row as TrendPointRow
    const reason = p.reason === 'type'
      ? t('panel.outType', { type: tTypes(`${p.typeKey}.short`) })
      : p.reason === 'hour' ? t('panel.outHour')
      : p.reason === 'excluded' ? t('panel.outExcluded') : null
    return (
      <div className="bg-white rounded-xl border border-surface-border shadow-elevated px-3 py-2 text-[11px] max-w-[260px]">
        <div className="font-medium text-anthracite">{formatIstante(new Date(p.x), undefined, locale)}</div>
        <div className="text-anthracite-lighter">{tTypes(`${p.typeKey}.short`)}</div>
        <div className="mt-1"><b className="text-anthracite">{formatValue(p.value, metric, locale)}</b></div>
        {reason ? <div className="mt-1 text-amber-700">{reason}</div> : <div className="mt-1 text-anthracite-lighter">{t('panel.referencePoint')}</div>}
      </div>
    )
  }
  const d = row as TrendDayRow
  return (
    <div className="bg-white rounded-xl border border-surface-border shadow-elevated px-3 py-2 text-[11px] max-w-[260px]">
      <div className="font-medium text-anthracite">{formatDate(d.day, undefined, locale)}</div>
      <div className="mt-1"><b className="text-anthracite">{t('panel.rollingValue', { value: formatValue(d.rolling, metric, locale) })}</b></div>
      <div className={d.provisional ? 'text-amber-700' : 'text-anthracite-lighter'}>
        {d.provisional ? t('panel.rollingProvisional', { n: d.n }) : t('panel.rollingN', { n: d.n })}
      </div>
    </div>
  )
}

// ============================================================================
// PANNELLO DI SELEZIONE DELLE METRICHE (drawer destro / schermo intero su mobile)
// ============================================================================

function MetricsPanel({
  onClose,
  search,
  setSearch,
  selected,
  toggleMetric,
  expandedGroups,
  toggleGroupExpanded,
  bulkSelectGroup,
  resetSelection,
}: {
  onClose: () => void
  search: string
  setSearch: (s: string) => void
  selected: string[]
  toggleMetric: (k: string) => void
  expandedGroups: Set<Group>
  toggleGroupExpanded: (g: Group) => void
  bulkSelectGroup: (g: Group) => void
  resetSelection: () => void
}) {
  const t = useTranslations('charts')
  const tMetrics = useTranslations('charts.metrics')
  const tCommon = useTranslations('common')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filteredMetrics = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return TREND_METRICS
    return TREND_METRICS.filter((m) => metricLabel(m, tMetrics).toLowerCase().includes(q) || m.key.toLowerCase().includes(q))
  }, [search, tMetrics])
  const isSearching = search.trim().length > 0
  const grouped = useMemo(() => {
    const map = new Map<Group, MetricDef[]>()
    for (const m of filteredMetrics) {
      const arr = map.get(m.group) ?? []
      arr.push(m)
      map.set(m.group, arr)
    }
    return map
  }, [filteredMetrics])

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-anthracite/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative ml-auto h-full w-full md:w-[400px] bg-white shadow-elevated flex flex-col">
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-serif text-base text-anthracite">{t('trend.panelTitle')}</h3>
            <p className="text-xs text-anthracite-lighter mt-0.5">{t('trend.panelCount', { selected: selected.length, total: TREND_METRICS.length })}</p>
          </div>
          <button type="button" aria-label={tCommon('close')} onClick={onClose} className="w-8 h-8 flex-shrink-0 rounded-lg hover:bg-surface flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-surface-border space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-anthracite-lighter" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('trend.searchPlaceholder')}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-surface-border rounded-lg bg-white focus:outline-none focus:border-teal-dark"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => bulkSelectGroup('score')} className="px-2 py-1 text-[11px] rounded-md border border-surface-border bg-white hover:bg-surface text-anthracite">{t('trend.allScores')}</button>
            <button type="button" onClick={() => bulkSelectGroup('time')} className="px-2 py-1 text-[11px] rounded-md border border-surface-border bg-white hover:bg-surface text-anthracite">{t('trend.allTimeDomain')}</button>
            <button type="button" onClick={resetSelection} className="px-2 py-1 text-[11px] rounded-md border border-surface-border bg-white hover:bg-surface text-anthracite-lighter ml-auto">{tCommon('reset')}</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {GROUP_ORDER.map((g) => {
            const list = grouped.get(g) ?? []
            if (!list.length) return null
            const isOpen = isSearching || expandedGroups.has(g)
            const selectedInGroup = list.filter((m) => selected.includes(m.key)).length
            return (
              <div key={g} className="mb-1">
                <button type="button" onClick={() => toggleGroupExpanded(g)} className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-surface text-left">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-anthracite truncate">{t(`groups.${g}`)}</span>
                    <span className="text-[10px] text-anthracite-lighter px-1.5 py-0.5 rounded bg-surface flex-shrink-0">{selectedInGroup}/{list.length}</span>
                  </div>
                  {isOpen ? <ChevronUp size={14} className="text-anthracite-lighter flex-shrink-0" /> : <ChevronDown size={14} className="text-anthracite-lighter flex-shrink-0" />}
                </button>
                {isOpen && (
                  <ul className="px-1 pb-1">
                    {list.map((m) => (
                      <li key={m.key}>
                        <label className="flex items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-surface cursor-pointer">
                          <input type="checkbox" checked={selected.includes(m.key)} onChange={() => toggleMetric(m.key)} className="w-4 h-4 rounded border-surface-border accent-teal-dark" />
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                          <span className="text-sm text-anthracite flex-1 min-w-0 truncate">{metricLabel(m, tMetrics)}</span>
                          {m.unit && <span className="text-[10px] text-anthracite-lighter flex-shrink-0">{m.unit}</span>}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
          {filteredMetrics.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-anthracite-lighter">{t('trend.noMatch', { query: search })}</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-surface-border bg-surface/50">
          <button type="button" onClick={onClose} className="w-full px-3 py-2 rounded-lg bg-teal-dark text-white text-sm font-medium hover:bg-teal transition-colors">
            {t('trend.apply', { count: selected.length })}
          </button>
        </div>
      </div>
    </div>
  )
}
