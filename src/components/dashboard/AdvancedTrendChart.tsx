'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronDown, ChevronUp, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import { format as fmtDate, parseISO, subDays } from 'date-fns'
import { useLocale, useTranslations } from 'next-intl'
import { intlTag, num, toNum } from '@/lib/format'
import type { Tr } from '@/i18n/types'
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// ============================================================================
// METRIC REGISTRY
// ============================================================================
// L'etichetta di ogni metrica è in `charts.metrics.<key>` (chiave = colonna
// di measurement_analytics): si legge con `metricLabel(m, t)`, dove
// `t = useTranslations('charts.metrics')`. I nomi dei gruppi sono in
// `charts.groups.<group>`.

type Group = 'score' | 'time' | 'welch' | 'lomb' | 'nonlinear' | 'geometric'

export type MetricDef = {
  key: string
  color: string
  group: Group
  unit?: string
  axis: 'left' | 'right'
  decimals?: number
}

export const TREND_METRICS: MetricDef[] = [
  // Score proprietari (0-100, asse sinistro)
  { key: 'score_stress', color: '#E85D4A', group: 'score', unit: '/100', axis: 'left', decimals: 1 },
  { key: 'score_recupero', color: '#4FA39A', group: 'score', unit: '/100', axis: 'left', decimals: 1 },
  { key: 'score_equilibrio', color: '#F59E0B', group: 'score', unit: '/100', axis: 'left', decimals: 1 },
  { key: 'score_energia', color: '#6366F1', group: 'score', unit: '/100', axis: 'left', decimals: 1 },
  { key: 'score_modulazione_infiammatoria', color: '#8B5CF6', group: 'score', unit: '/100', axis: 'left', decimals: 1 },
  { key: 'score_composito', color: '#2E746C', group: 'score', unit: '/100', axis: 'left', decimals: 1 },

  // Time domain (blu)
  { key: 'sdnn', color: '#0EA5E9', group: 'time', unit: 'ms', axis: 'right', decimals: 1 },
  { key: 'rmssd', color: '#38BDF8', group: 'time', unit: 'ms', axis: 'right', decimals: 1 },
  { key: 'pnn50', color: '#7DD3FC', group: 'time', unit: '%', axis: 'right', decimals: 1 },
  { key: 'pnn20', color: '#BAE6FD', group: 'time', unit: '%', axis: 'right', decimals: 1 },
  { key: 'mean_hr', color: '#0284C7', group: 'time', unit: 'bpm', axis: 'right', decimals: 1 },
  { key: 'cv', color: '#0369A1', group: 'time', unit: '', axis: 'right', decimals: 2 },
  { key: 'rmssd_sdnn_ratio', color: '#075985', group: 'time', unit: '', axis: 'right', decimals: 2 },

  // Frequency Welch (viola)
  { key: 'vlf_power', color: '#A855F7', group: 'welch', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'lf_power', color: '#C084FC', group: 'welch', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'hf_power', color: '#D8B4FE', group: 'welch', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'total_power', color: '#7C3AED', group: 'welch', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'lf_hf_ratio', color: '#6D28D9', group: 'welch', unit: '', axis: 'right', decimals: 2 },
  { key: 'lf_nu', color: '#5B21B6', group: 'welch', unit: 'n.u.', axis: 'right', decimals: 1 },
  { key: 'hf_nu', color: '#4C1D95', group: 'welch', unit: 'n.u.', axis: 'right', decimals: 1 },

  // Frequency Lomb-Scargle (rosa)
  { key: 'vlf_power_ls', color: '#EC4899', group: 'lomb', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'lf_power_ls', color: '#F472B6', group: 'lomb', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'hf_power_ls', color: '#F9A8D4', group: 'lomb', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'total_power_ls', color: '#DB2777', group: 'lomb', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'lf_hf_ratio_ls', color: '#BE185D', group: 'lomb', unit: '', axis: 'right', decimals: 2 },

  // Non-lineari (arancio)
  { key: 'sd1', color: '#F97316', group: 'nonlinear', unit: 'ms', axis: 'right', decimals: 1 },
  { key: 'sd2', color: '#FB923C', group: 'nonlinear', unit: 'ms', axis: 'right', decimals: 1 },
  { key: 'sd1_sd2_ratio', color: '#FDBA74', group: 'nonlinear', unit: '', axis: 'right', decimals: 2 },
  { key: 'dfa_alpha1', color: '#FED7AA', group: 'nonlinear', unit: '', axis: 'right', decimals: 2 },
  { key: 'dfa_alpha2', color: '#EA580C', group: 'nonlinear', unit: '', axis: 'right', decimals: 2 },
  { key: 'sample_entropy', color: '#C2410C', group: 'nonlinear', unit: '', axis: 'right', decimals: 2 },
  { key: 'approximate_entropy', color: '#9A3412', group: 'nonlinear', unit: '', axis: 'right', decimals: 2 },

  // Geometrici (lime)
  { key: 'triangular_index', color: '#84CC16', group: 'geometric', unit: '', axis: 'right', decimals: 1 },
  { key: 'tinn', color: '#A3E635', group: 'geometric', unit: 'ms', axis: 'right', decimals: 1 },
  { key: 'stress_index_baevsky', color: '#65A30D', group: 'geometric', unit: '', axis: 'right', decimals: 1 },
]

const METRIC_MAP: Record<string, MetricDef> = Object.fromEntries(TREND_METRICS.map((m) => [m.key, m]))

/** Etichetta tradotta di una metrica del trend (`t = useTranslations('charts.metrics')`). */
export function metricLabel(m: MetricDef | string, t: Tr): string {
  return t(typeof m === 'string' ? m : m.key)
}

const GROUP_ORDER: Group[] = ['score', 'time', 'welch', 'lomb', 'nonlinear', 'geometric']

function formatMetricValue(value: unknown, m: MetricDef | undefined, locale: string): string {
  const decimals = m?.decimals ?? 1
  // I punti del grafico arrivano dal database: coercizione prima di formattare.
  const n = toNum(value)
  if (n == null) return '—'
  const formatted = num(n, decimals, locale)
  if (!m?.unit) return formatted
  if (m.unit === '/100') return `${formatted} / 100`
  if (m.unit === '%') return `${formatted}%`
  return `${formatted} ${m.unit}`
}

// ============================================================================
// DATE PRESETS
// ============================================================================
// Le chiavi ('7', '30', ...) sono anche il valore salvato in localStorage:
// non cambiano. L'etichetta è in `charts.presets.<labelKey>`.

type PresetKey = '7' | '30' | '90' | '180' | '365' | 'all' | 'custom'

const PRESETS: Array<{ key: PresetKey; labelKey: string; days: number | null }> = [
  { key: '7', labelKey: 'd7', days: 7 },
  { key: '30', labelKey: 'd30', days: 30 },
  { key: '90', labelKey: 'd90', days: 90 },
  { key: '180', labelKey: 'm6', days: 180 },
  { key: '365', labelKey: 'y1', days: 365 },
  { key: 'all', labelKey: 'all', days: null },
]

const PRESET_KEYS: ReadonlySet<string> = new Set<string>([...PRESETS.map((p) => p.key), 'custom'])

// Chiave "macchina" del giorno (yyyy-MM-dd): serve per confronti e input date,
// non è testo visibile, quindi resta senza locale.
function isoDay(d: Date) { return fmtDate(d, 'yyyy-MM-dd') }

// ============================================================================
// COMPONENT
// ============================================================================

type Point = Record<string, number | string | null | undefined> & { date: string }

type Props = {
  data: Point[]
  defaultSelected?: string[]
  defaultPreset?: PresetKey
  height?: number
  /** Base key per localStorage. Salva range + metriche + visibilità. */
  storageKey?: string
  /** mostra il brush sotto al grafico (nascosto su mobile per scelta UX) */
  showBrush?: boolean
}

export function AdvancedTrendChart({
  data,
  defaultSelected = ['score_stress', 'score_recupero'],
  defaultPreset = '30',
  height = 300,
  storageKey,
  showBrush = true,
}: Props) {
  const locale = useLocale()
  const t = useTranslations('charts')
  const tMetrics = useTranslations('charts.metrics')

  // Formati data per assi e tooltip nella lingua della pagina.
  const tickDate = useMemo(() => new Intl.DateTimeFormat(intlTag(locale), { day: 'numeric', month: 'short' }), [locale])
  const fullDate = useMemo(
    () => new Intl.DateTimeFormat(intlTag(locale), { day: 'numeric', month: 'short', year: 'numeric' }),
    [locale],
  )
  const fmtTick = (v: unknown) => { try { return tickDate.format(parseISO(String(v))) } catch { return String(v) } }

  // periodo
  const [activeKey, setActiveKey] = useState<PresetKey>(defaultPreset)
  const [customFrom, setCustomFrom] = useState(() => isoDay(subDays(new Date(), 30)))
  const [customTo, setCustomTo] = useState(() => isoDay(new Date()))

  // selezione metriche e visibilità
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelected))
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())

  // UI state
  const [panelOpen, setPanelOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<Group>>(() => new Set(['score']))
  const [brushKey, setBrushKey] = useState(0)

  // hydration da localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !storageKey) return
    const savedPreset = window.localStorage.getItem(`${storageKey}:range`)
    const savedMetrics = window.localStorage.getItem(`${storageKey}:metrics`)
    const savedHidden = window.localStorage.getItem(`${storageKey}:hidden`)
    if (savedPreset && PRESET_KEYS.has(savedPreset)) setActiveKey(savedPreset as PresetKey)
    if (savedMetrics) {
      try {
        const arr = JSON.parse(savedMetrics) as string[]
        if (Array.isArray(arr) && arr.length) setSelected(new Set(arr.filter((k) => METRIC_MAP[k])))
      } catch {}
    }
    if (savedHidden) {
      try {
        const arr = JSON.parse(savedHidden) as string[]
        if (Array.isArray(arr)) setHidden(new Set(arr))
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function persistRange(k: PresetKey) {
    if (typeof window !== 'undefined' && storageKey) {
      window.localStorage.setItem(`${storageKey}:range`, k)
    }
  }
  function persistMetrics(s: Set<string>) {
    if (typeof window !== 'undefined' && storageKey) {
      window.localStorage.setItem(`${storageKey}:metrics`, JSON.stringify(Array.from(s)))
    }
  }
  function persistHidden(s: Set<string>) {
    if (typeof window !== 'undefined' && storageKey) {
      window.localStorage.setItem(`${storageKey}:hidden`, JSON.stringify(Array.from(s)))
    }
  }

  function setRange(k: PresetKey) {
    setActiveKey(k)
    persistRange(k)
    setBrushKey((x) => x + 1)
  }

  function toggleMetric(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      persistMetrics(next)
      return next
    })
    // se aggiungo metrica precedentemente nascosta, rendila visibile
    setHidden((prev) => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      persistHidden(next)
      return next
    })
  }

  function toggleHidden(key: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      persistHidden(next)
      return next
    })
  }

  function bulkSelectGroup(g: Group) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const m of TREND_METRICS) if (m.group === g) next.add(m.key)
      persistMetrics(next)
      return next
    })
  }
  function resetSelection() {
    const next = new Set(defaultSelected)
    setSelected(next)
    persistMetrics(next)
    const cleared = new Set<string>()
    setHidden(cleared)
    persistHidden(cleared)
  }

  function toggleGroupExpanded(g: Group) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  // filtra dati per periodo
  const filtered = useMemo(() => {
    if (!data.length) return []
    if (activeKey === 'all') return data
    let fromDate: string
    let toDate: string
    if (activeKey === 'custom') {
      fromDate = customFrom
      toDate = customTo
    } else {
      const p = PRESETS.find((x) => x.key === activeKey)
      const days = p?.days ?? 30
      fromDate = isoDay(subDays(new Date(), days))
      toDate = isoDay(new Date())
    }
    return data.filter((p) => {
      const d = String(p.date)
      return d >= fromDate && d <= toDate
    })
  }, [data, activeKey, customFrom, customTo])

  // serie da renderizzare (selezionate ∧ non nascoste)
  const renderedKeys = useMemo(
    () => Array.from(selected).filter((k) => METRIC_MAP[k] && !hidden.has(k)),
    [selected, hidden],
  )
  const renderedMetrics = useMemo(() => renderedKeys.map((k) => METRIC_MAP[k]).filter(Boolean), [renderedKeys])

  const hasLeftAxis = renderedMetrics.some((m) => m.axis === 'left')
  const hasRightAxis = renderedMetrics.some((m) => m.axis === 'right')

  // ricerca metriche (sull'etichetta tradotta e sulla chiave)
  const filteredMetrics = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return TREND_METRICS
    return TREND_METRICS.filter((m) => metricLabel(m, tMetrics).toLowerCase().includes(q) || m.key.toLowerCase().includes(q))
  }, [search, tMetrics])

  const presetBtn = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
      active
        ? 'bg-teal-dark text-white border-teal-dark'
        : 'bg-white border-surface-border text-anthracite-lighter hover:bg-surface hover:text-anthracite'
    }`

  return (
    <div>
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {PRESETS.map((p) => (
          <button key={p.key} type="button" onClick={() => setRange(p.key)} className={presetBtn(activeKey === p.key)}>
            {t(`presets.${p.labelKey}`)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setRange('custom')}
          className={`flex items-center gap-1.5 ${presetBtn(activeKey === 'custom')}`}
        >
          <Calendar size={12} /> {t('presets.custom')}
        </button>
        {activeKey === 'custom' && (
          <div className="flex flex-wrap items-center gap-1.5 ml-2">
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="text-xs px-2 py-1 border border-surface-border rounded-lg bg-white text-anthracite"
            />
            <span className="text-xs text-anthracite-lighter">→</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={isoDay(new Date())}
              onChange={(e) => setCustomTo(e.target.value)}
              className="text-xs px-2 py-1 border border-surface-border rounded-lg bg-white text-anthracite"
            />
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setBrushKey((x) => x + 1)}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-white border-surface-border text-anthracite-lighter hover:bg-surface hover:text-anthracite whitespace-nowrap transition-colors"
            title={t('trend.resetZoom')}
          >
            <RotateCcw size={12} /> {t('trend.resetZoom')}
          </button>
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-anthracite text-white hover:bg-anthracite-lighter whitespace-nowrap transition-colors"
          >
            <SlidersHorizontal size={13} /> {t('trend.selectMetrics')}
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/15 text-[10px]">{selected.size}</span>
          </button>
        </div>
      </div>

      {/* CHART */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-anthracite-lighter">{t('trend.noDataInPeriod')}</div>
      ) : renderedMetrics.length === 0 ? (
        <div className="py-10 text-center text-sm text-anthracite-lighter">
          {t.rich('trend.noMetricSelected', { em: (c) => <em>{c}</em> })}
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart key={brushKey} data={filtered} margin={{ top: 8, right: hasRightAxis ? 8 : 16, left: hasLeftAxis ? -8 : 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#6B7280"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtTick}
              />
              {hasLeftAxis && (
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  domain={[0, 100]}
                  stroke="#6B7280"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
              )}
              {hasRightAxis && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={['auto', 'auto']}
                  stroke="#6B7280"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v) => num(v, 0, locale)}
                />
              )}
              {/* se non c'è left, usa right come default per le linee left (fallback non dovrebbe servire) */}
              <Tooltip
                content={<CustomTooltip locale={locale} fullDate={fullDate} tMetrics={tMetrics} />}
                cursor={{ stroke: '#94A3B8', strokeDasharray: '3 3' }}
              />
              {renderedMetrics.map((m) => (
                <Line
                  key={m.key}
                  yAxisId={m.axis === 'left' ? (hasLeftAxis ? 'left' : 'right') : 'right'}
                  type="monotone"
                  dataKey={m.key}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
              {showBrush && filtered.length > 8 && (
                <Brush
                  dataKey="date"
                  height={28}
                  stroke="#4FA39A"
                  travellerWidth={8}
                  tickFormatter={fmtTick}
                  className="hidden md:block"
                />
              )}
            </LineChart>
          </ResponsiveContainer>

          {/* LEGENDA INTERATTIVA */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {Array.from(selected).map((k) => {
              const m = METRIC_MAP[k]
              if (!m) return null
              const isHidden = hidden.has(k)
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleHidden(k)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border max-w-full transition-colors ${
                    isHidden
                      ? 'bg-surface border-surface-border text-anthracite-lighter line-through'
                      : 'bg-white border-surface-border text-anthracite hover:bg-surface'
                  }`}
                  title={isHidden ? t('trend.show') : t('trend.hideTemporarily')}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.color, opacity: isHidden ? 0.4 : 1 }} />
                  <span className="truncate">{metricLabel(m, tMetrics)}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* PANNELLO SELEZIONE METRICHE — drawer destro / fullscreen su mobile */}
      {panelOpen && (
        <MetricsPanel
          onClose={() => setPanelOpen(false)}
          search={search}
          setSearch={setSearch}
          filteredMetrics={filteredMetrics}
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

// ============================================================================
// PANNELLO METRICHE
// ============================================================================

function MetricsPanel({
  onClose,
  search,
  setSearch,
  filteredMetrics,
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
  filteredMetrics: MetricDef[]
  selected: Set<string>
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

  const isSearching = search.trim().length > 0
  // raggruppa metriche filtrate per gruppo, preservando l'ordine dei gruppi
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
            <p className="text-xs text-anthracite-lighter mt-0.5">{t('trend.panelCount', { selected: selected.size, total: TREND_METRICS.length })}</p>
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
            <button
              type="button"
              onClick={() => bulkSelectGroup('score')}
              className="px-2 py-1 text-[11px] rounded-md border border-surface-border bg-white hover:bg-surface text-anthracite"
            >{t('trend.allScores')}</button>
            <button
              type="button"
              onClick={() => bulkSelectGroup('time')}
              className="px-2 py-1 text-[11px] rounded-md border border-surface-border bg-white hover:bg-surface text-anthracite"
            >{t('trend.allTimeDomain')}</button>
            <button
              type="button"
              onClick={resetSelection}
              className="px-2 py-1 text-[11px] rounded-md border border-surface-border bg-white hover:bg-surface text-anthracite-lighter ml-auto"
            >{tCommon('reset')}</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {GROUP_ORDER.map((g) => {
            const metrics = grouped.get(g) ?? []
            if (!metrics.length) return null
            const isOpen = isSearching || expandedGroups.has(g)
            const selectedInGroup = metrics.filter((m) => selected.has(m.key)).length
            return (
              <div key={g} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroupExpanded(g)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-surface text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-anthracite truncate">{t(`groups.${g}`)}</span>
                    <span className="text-[10px] text-anthracite-lighter px-1.5 py-0.5 rounded bg-surface flex-shrink-0">{selectedInGroup}/{metrics.length}</span>
                  </div>
                  {isOpen ? <ChevronUp size={14} className="text-anthracite-lighter flex-shrink-0" /> : <ChevronDown size={14} className="text-anthracite-lighter flex-shrink-0" />}
                </button>
                {isOpen && (
                  <ul className="px-1 pb-1">
                    {metrics.map((m) => {
                      const isSel = selected.has(m.key)
                      return (
                        <li key={m.key}>
                          <label className="flex items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-surface cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => toggleMetric(m.key)}
                              className="w-4 h-4 rounded border-surface-border accent-teal-dark"
                            />
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                            <span className="text-sm text-anthracite flex-1 min-w-0 truncate">{metricLabel(m, tMetrics)}</span>
                            {m.unit && <span className="text-[10px] text-anthracite-lighter flex-shrink-0">{m.unit}</span>}
                          </label>
                        </li>
                      )
                    })}
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
          <button
            type="button"
            onClick={onClose}
            className="w-full px-3 py-2 rounded-lg bg-teal-dark text-white text-sm font-medium hover:bg-teal transition-colors"
          >
            {t('trend.apply', { count: selected.size })}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// TOOLTIP CUSTOM
// ============================================================================

type TooltipEntry = { dataKey?: string | number; value?: number | null; color?: string }

function CustomTooltip(props: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  locale: string
  fullDate: Intl.DateTimeFormat
  tMetrics: Tr
}) {
  const { active, payload, label, locale, fullDate, tMetrics } = props
  if (!active || !payload || !payload.length) return null
  let dateLabel = String(label ?? '')
  try { dateLabel = fullDate.format(parseISO(dateLabel)) } catch {}

  return (
    <div className="bg-white rounded-xl border border-surface-border shadow-elevated px-3 py-2 text-[11px] max-w-[260px]">
      <div className="font-medium text-anthracite mb-1">{dateLabel}</div>
      {payload.map((p) => {
        const key = String(p.dataKey ?? '')
        const m = METRIC_MAP[key]
        const v = p.value
        return (
          <div key={key} className="flex items-center gap-1.5 mb-0.5 last:mb-0">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-anthracite-lighter flex-1 min-w-0 truncate">{m ? metricLabel(m, tMetrics) : key}</span>
            <b className="text-anthracite ml-2 whitespace-nowrap">{v == null ? '—' : formatMetricValue(Number(v), m, locale)}</b>
          </div>
        )
      })}
    </div>
  )
}
