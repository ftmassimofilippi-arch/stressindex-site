'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronDown, ChevronUp, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import { format as fmtDate, parseISO, subDays } from 'date-fns'
import { it } from 'date-fns/locale'
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

type Group = 'score' | 'time' | 'welch' | 'lomb' | 'nonlinear' | 'geometric'

export type MetricDef = {
  key: string
  label: string
  color: string
  group: Group
  unit?: string
  axis: 'left' | 'right'
  decimals?: number
}

export const TREND_METRICS: MetricDef[] = [
  // Score proprietari (0-100, asse sinistro)
  { key: 'score_stress', label: 'Indice di Stress', color: '#E85D4A', group: 'score', unit: '/100', axis: 'left', decimals: 1 },
  { key: 'score_recupero', label: 'Recupero', color: '#4FA39A', group: 'score', unit: '/100', axis: 'left', decimals: 1 },
  { key: 'score_equilibrio', label: 'Equilibrio', color: '#F59E0B', group: 'score', unit: '/100', axis: 'left', decimals: 1 },
  { key: 'score_energia', label: 'Energia', color: '#6366F1', group: 'score', unit: '/100', axis: 'left', decimals: 1 },
  { key: 'score_modulazione_infiammatoria', label: 'Modulazione infiammatoria', color: '#8B5CF6', group: 'score', unit: '/100', axis: 'left', decimals: 1 },
  { key: 'score_composito', label: 'Indice composito', color: '#2E746C', group: 'score', unit: '/100', axis: 'left', decimals: 1 },

  // Time domain (blu)
  { key: 'sdnn', label: 'SDNN', color: '#0EA5E9', group: 'time', unit: 'ms', axis: 'right', decimals: 1 },
  { key: 'rmssd', label: 'RMSSD', color: '#38BDF8', group: 'time', unit: 'ms', axis: 'right', decimals: 1 },
  { key: 'pnn50', label: 'pNN50', color: '#7DD3FC', group: 'time', unit: '%', axis: 'right', decimals: 1 },
  { key: 'pnn20', label: 'pNN20', color: '#BAE6FD', group: 'time', unit: '%', axis: 'right', decimals: 1 },
  { key: 'mean_hr', label: 'BPM medio', color: '#0284C7', group: 'time', unit: 'bpm', axis: 'right', decimals: 1 },
  { key: 'cv', label: 'CV', color: '#0369A1', group: 'time', unit: '', axis: 'right', decimals: 2 },
  { key: 'rmssd_sdnn_ratio', label: 'RMSSD/SDNN', color: '#075985', group: 'time', unit: '', axis: 'right', decimals: 2 },

  // Frequency Welch (viola)
  { key: 'vlf_power', label: 'VLF Power', color: '#A855F7', group: 'welch', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'lf_power', label: 'LF Power', color: '#C084FC', group: 'welch', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'hf_power', label: 'HF Power', color: '#D8B4FE', group: 'welch', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'total_power', label: 'Total Power', color: '#7C3AED', group: 'welch', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'lf_hf_ratio', label: 'LF/HF', color: '#6D28D9', group: 'welch', unit: '', axis: 'right', decimals: 2 },
  { key: 'lf_nu', label: 'LFnu', color: '#5B21B6', group: 'welch', unit: 'n.u.', axis: 'right', decimals: 1 },
  { key: 'hf_nu', label: 'HFnu', color: '#4C1D95', group: 'welch', unit: 'n.u.', axis: 'right', decimals: 1 },

  // Frequency Lomb-Scargle (rosa)
  { key: 'vlf_power_ls', label: 'VLF Power (LS)', color: '#EC4899', group: 'lomb', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'lf_power_ls', label: 'LF Power (LS)', color: '#F472B6', group: 'lomb', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'hf_power_ls', label: 'HF Power (LS)', color: '#F9A8D4', group: 'lomb', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'total_power_ls', label: 'Total Power (LS)', color: '#DB2777', group: 'lomb', unit: 'ms²', axis: 'right', decimals: 0 },
  { key: 'lf_hf_ratio_ls', label: 'LF/HF (LS)', color: '#BE185D', group: 'lomb', unit: '', axis: 'right', decimals: 2 },

  // Non-lineari (arancio)
  { key: 'sd1', label: 'SD1', color: '#F97316', group: 'nonlinear', unit: 'ms', axis: 'right', decimals: 1 },
  { key: 'sd2', label: 'SD2', color: '#FB923C', group: 'nonlinear', unit: 'ms', axis: 'right', decimals: 1 },
  { key: 'sd1_sd2_ratio', label: 'SD1/SD2', color: '#FDBA74', group: 'nonlinear', unit: '', axis: 'right', decimals: 2 },
  { key: 'dfa_alpha1', label: 'DFA α1', color: '#FED7AA', group: 'nonlinear', unit: '', axis: 'right', decimals: 2 },
  { key: 'dfa_alpha2', label: 'DFA α2', color: '#EA580C', group: 'nonlinear', unit: '', axis: 'right', decimals: 2 },
  { key: 'sample_entropy', label: 'Sample Entropy', color: '#C2410C', group: 'nonlinear', unit: '', axis: 'right', decimals: 2 },
  { key: 'approximate_entropy', label: 'Approximate Entropy', color: '#9A3412', group: 'nonlinear', unit: '', axis: 'right', decimals: 2 },

  // Geometrici (lime)
  { key: 'triangular_index', label: 'Triangular Index', color: '#84CC16', group: 'geometric', unit: '', axis: 'right', decimals: 1 },
  { key: 'tinn', label: 'TINN', color: '#A3E635', group: 'geometric', unit: 'ms', axis: 'right', decimals: 1 },
  { key: 'stress_index_baevsky', label: 'Stress Index (Baevsky)', color: '#65A30D', group: 'geometric', unit: '', axis: 'right', decimals: 1 },
]

const METRIC_MAP: Record<string, MetricDef> = Object.fromEntries(TREND_METRICS.map((m) => [m.key, m]))

const GROUPS: Array<{ key: Group; label: string }> = [
  { key: 'score', label: 'Score Proprietari' },
  { key: 'time', label: 'Time Domain' },
  { key: 'welch', label: 'Frequency · Welch' },
  { key: 'lomb', label: 'Frequency · Lomb-Scargle' },
  { key: 'nonlinear', label: 'Non-lineari' },
  { key: 'geometric', label: 'Geometrici' },
]

function formatMetricValue(value: number, m: MetricDef | undefined): string {
  const decimals = m?.decimals ?? 1
  const formatted = value.toFixed(decimals)
  if (!m?.unit) return formatted
  if (m.unit === '/100') return `${formatted} / 100`
  if (m.unit === '%') return `${formatted}%`
  return `${formatted} ${m.unit}`
}

// ============================================================================
// DATE PRESETS
// ============================================================================

type PresetKey = '7' | '30' | '90' | '180' | '365' | 'all' | 'custom'

const PRESETS: Array<{ key: PresetKey; label: string; days: number | null }> = [
  { key: '7', label: 'Ultimi 7', days: 7 },
  { key: '30', label: 'Ultimi 30', days: 30 },
  { key: '90', label: '90 giorni', days: 90 },
  { key: '180', label: '6 mesi', days: 180 },
  { key: '365', label: '1 anno', days: 365 },
  { key: 'all', label: 'Tutto', days: null },
]

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
    const savedPreset = window.localStorage.getItem(`${storageKey}:range`) as PresetKey | null
    const savedMetrics = window.localStorage.getItem(`${storageKey}:metrics`)
    const savedHidden = window.localStorage.getItem(`${storageKey}:hidden`)
    if (savedPreset) setActiveKey(savedPreset)
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

  // ricerca metriche
  const filteredMetrics = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return TREND_METRICS
    return TREND_METRICS.filter((m) => m.label.toLowerCase().includes(q) || m.key.toLowerCase().includes(q))
  }, [search])

  return (
    <div>
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setRange(p.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              activeKey === p.key
                ? 'bg-teal-dark text-white border-teal-dark'
                : 'bg-white border-surface-border text-anthracite-lighter hover:bg-surface hover:text-anthracite'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setRange('custom')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            activeKey === 'custom'
              ? 'bg-teal-dark text-white border-teal-dark'
              : 'bg-white border-surface-border text-anthracite-lighter hover:bg-surface hover:text-anthracite'
          }`}
        >
          <Calendar size={12} /> Custom
        </button>
        {activeKey === 'custom' && (
          <div className="flex items-center gap-1.5 ml-2">
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

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBrushKey((x) => x + 1)}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-white border-surface-border text-anthracite-lighter hover:bg-surface hover:text-anthracite transition-colors"
            title="Reset zoom"
          >
            <RotateCcw size={12} /> Reset zoom
          </button>
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-anthracite text-white hover:bg-anthracite-lighter transition-colors"
          >
            <SlidersHorizontal size={13} /> Seleziona metriche
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/15 text-[10px]">{selected.size}</span>
          </button>
        </div>
      </div>

      {/* CHART */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-anthracite-lighter">Nessun dato nel periodo selezionato</div>
      ) : renderedMetrics.length === 0 ? (
        <div className="py-10 text-center text-sm text-anthracite-lighter">
          Nessuna metrica selezionata — apri <em>“Seleziona metriche”</em> per scegliere cosa visualizzare
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
                tickFormatter={(v) => {
                  try { return fmtDate(parseISO(v), 'd MMM', { locale: it }) } catch { return v }
                }}
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
                />
              )}
              {/* se non c'è left, usa right come default per le linee left (fallback non dovrebbe servire) */}
              <Tooltip
                content={<CustomTooltip />}
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
                  tickFormatter={(v) => {
                    try { return fmtDate(parseISO(String(v)), 'd MMM', { locale: it }) } catch { return String(v) }
                  }}
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
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    isHidden
                      ? 'bg-surface border-surface-border text-anthracite-lighter line-through'
                      : 'bg-white border-surface-border text-anthracite hover:bg-surface'
                  }`}
                  title={isHidden ? 'Mostra' : 'Nascondi temporaneamente'}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color, opacity: isHidden ? 0.4 : 1 }} />
                  {m.label}
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isSearching = search.trim().length > 0
  // raggruppa metriche filtrate per gruppo, preservando ordine GROUPS
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
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
          <div>
            <h3 className="font-serif text-base text-anthracite">Metriche del grafico</h3>
            <p className="text-xs text-anthracite-lighter mt-0.5">{selected.size} selezionate · {TREND_METRICS.length} disponibili</p>
          </div>
          <button type="button" aria-label="Chiudi" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center">
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
              placeholder="Cerca metrica…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-surface-border rounded-lg bg-white focus:outline-none focus:border-teal-dark"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => bulkSelectGroup('score')}
              className="px-2 py-1 text-[11px] rounded-md border border-surface-border bg-white hover:bg-surface text-anthracite"
            >Tutti i score</button>
            <button
              type="button"
              onClick={() => bulkSelectGroup('time')}
              className="px-2 py-1 text-[11px] rounded-md border border-surface-border bg-white hover:bg-surface text-anthracite"
            >Tutti i Time Domain</button>
            <button
              type="button"
              onClick={resetSelection}
              className="px-2 py-1 text-[11px] rounded-md border border-surface-border bg-white hover:bg-surface text-anthracite-lighter ml-auto"
            >Reset</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {GROUPS.map((g) => {
            const metrics = grouped.get(g.key) ?? []
            if (!metrics.length) return null
            const isOpen = isSearching || expandedGroups.has(g.key)
            const selectedInGroup = metrics.filter((m) => selected.has(m.key)).length
            return (
              <div key={g.key} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroupExpanded(g.key)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-anthracite">{g.label}</span>
                    <span className="text-[10px] text-anthracite-lighter px-1.5 py-0.5 rounded bg-surface">{selectedInGroup}/{metrics.length}</span>
                  </div>
                  {isOpen ? <ChevronUp size={14} className="text-anthracite-lighter" /> : <ChevronDown size={14} className="text-anthracite-lighter" />}
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
                            <span className="text-sm text-anthracite flex-1">{m.label}</span>
                            {m.unit && <span className="text-[10px] text-anthracite-lighter">{m.unit}</span>}
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
            <div className="px-5 py-8 text-center text-sm text-anthracite-lighter">Nessuna metrica corrisponde a “{search}”</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-surface-border bg-surface/50">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-3 py-2 rounded-lg bg-teal-dark text-white text-sm font-medium hover:bg-teal transition-colors"
          >
            Applica · {selected.size} metrich{selected.size === 1 ? 'a' : 'e'}
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
}) {
  const { active, payload, label } = props
  if (!active || !payload || !payload.length) return null
  let dateLabel = String(label ?? '')
  try { dateLabel = fmtDate(parseISO(dateLabel), 'd MMM yyyy', { locale: it }) } catch {}

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
            <span className="text-anthracite-lighter flex-1">{m?.label ?? key}</span>
            <b className="text-anthracite ml-2">{v == null ? '—' : formatMetricValue(Number(v), m)}</b>
          </div>
        )
      })}
    </div>
  )
}
