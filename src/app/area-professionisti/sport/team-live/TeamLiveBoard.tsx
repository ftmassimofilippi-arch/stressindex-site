'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Timer, Heart, X, Activity, ArrowUpRight, Wifi, WifiOff } from 'lucide-react'
import {
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { createClient } from '@/lib/supabase-browser'
import { num } from '@/lib/format'
import {
  artifactPct,
  athleteHrMax,
  athleteName,
  CONN_COLOR,
  CONN_LABEL,
  connStatus,
  DFA_BANDS,
  formatElapsed,
  formatUpdatedClock,
  hrZoneColor,
  isInSession,
  isVisible,
  liveZone,
  parseLiveTags,
  SPORT_LIVE_COLUMNS,
  type AthleteMeta,
  type ConnStatus,
  type SportLiveRow,
} from '@/lib/sport-live'

type SortKey = 'zone' | 'name' | 'hr' | 'trimp'

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'zone', label: 'Intensità (zona)' },
  { key: 'name', label: 'Nome' },
  { key: 'hr', label: 'HR' },
  { key: 'trimp', label: 'TRIMP' },
]

// Punto storico accumulato lato client (per i mini-trend del drawer).
interface HistPoint {
  t: number
  hr: number | null
  alpha1: number | null
  rmssd: number | null
}

type RowMap = Record<string, SportLiveRow>
type HistMap = Record<string, HistPoint[]>

const HISTORY_CAP = 120 // ~10 min @ 5s

export function TeamLiveBoard({
  professionalId,
  initialRows,
  athletes,
  baseQuery,
}: {
  professionalId: string
  initialRows: SportLiveRow[]
  athletes: Record<string, AthleteMeta>
  baseQuery: string
}) {
  const [rows, setRows] = useState<RowMap>(() => {
    const m: RowMap = {}
    for (const r of initialRows) m[r.id] = r
    return m
  })
  const [history, setHistory] = useState<HistMap>(() => {
    const h: HistMap = {}
    for (const r of initialRows) {
      const t = Date.parse(r.updated_at) || 0
      h[r.athlete_id] = [{ t, hr: r.hr, alpha1: r.dfa_alpha1, rmssd: r.rmssd }]
    }
    return h
  })
  const [now, setNow] = useState(() => Date.now())
  const [mounted, setMounted] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('zone')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [flashIds, setFlashIds] = useState<Record<string, number>>({})
  const [realtimeOk, setRealtimeOk] = useState(true)

  const rowsRef = useRef<RowMap>(rows)
  rowsRef.current = rows

  // ── Ticker 1s: aggiorna stati di connessione e timer anche senza nuovi dati ──
  useEffect(() => {
    setMounted(true)
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Applica una riga in arrivo (realtime o poll): aggiorna mappa, storico, flash.
  const applyRow = useCallback((row: SportLiveRow, markFlash: boolean) => {
    setRows((prev) => ({ ...prev, [row.id]: row }))
    setHistory((prev) => {
      const arr = prev[row.athlete_id] ?? []
      const t = Date.parse(row.updated_at) || Date.now()
      if (arr.length && arr[arr.length - 1].t === t) return prev // dedup poll+realtime
      const next = [...arr, { t, hr: row.hr, alpha1: row.dfa_alpha1, rmssd: row.rmssd }].slice(-HISTORY_CAP)
      return { ...prev, [row.athlete_id]: next }
    })
    if (markFlash) {
      const stamp = Date.now()
      setFlashIds((prev) => ({ ...prev, [row.id]: stamp }))
      setTimeout(() => {
        setFlashIds((prev) => {
          if (prev[row.id] !== stamp) return prev
          const { [row.id]: _drop, ...rest } = prev
          return rest
        })
      }, 700)
    }
  }, [])

  // ── Supabase Realtime (WebSocket) ────────────────────────────────────────────
  useEffect(() => {
    if (!professionalId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`team-live:${professionalId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sport_live_data',
          filter: `professional_id=eq.${professionalId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id
            if (oldId) setRows((prev) => {
              if (!prev[oldId]) return prev
              const { [oldId]: _drop, ...rest } = prev
              return rest
            })
            return
          }
          const row = payload.new as SportLiveRow
          if (row?.id) applyRow(row, true)
        },
      )
      .subscribe((status) => {
        // Se il canale non si sottoscrive, attiva il fallback polling.
        if (status === 'SUBSCRIBED') setRealtimeOk(true)
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setRealtimeOk(false)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [professionalId, applyRow])

  // ── Polling: fallback 5s se Realtime KO, altrimenti reconcile lento 20s ──────
  useEffect(() => {
    if (!professionalId) return
    const supabase = createClient()
    let cancelled = false

    async function fetchSnapshot() {
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('sport_live_data')
        .select(SPORT_LIVE_COLUMNS)
        .eq('professional_id', professionalId)
        .or(`is_connected.eq.true,updated_at.gte.${since}`)
        .order('updated_at', { ascending: false })
      if (cancelled || error || !data) return
      const fetched = data as SportLiveRow[]
      const fetchedIds = new Set(fetched.map((r) => r.id))
      // Aggiorna/inserisci le righe cambiate (flash solo se Realtime è KO).
      for (const row of fetched) {
        const existing = rowsRef.current[row.id]
        if (!existing || existing.updated_at !== row.updated_at) applyRow(row, !realtimeOk)
      }
      // Rimuovi le righe non più presenti nello snapshot (sessioni archiviate).
      setRows((prev) => {
        let changed = false
        const next: RowMap = {}
        for (const [id, r] of Object.entries(prev)) {
          if (fetchedIds.has(id)) next[id] = r
          else changed = true
        }
        return changed ? next : prev
      })
    }

    const delay = realtimeOk ? 20000 : 5000
    const id = setInterval(fetchSnapshot, delay)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [professionalId, realtimeOk, applyRow])

  // ── Liste derivate (una card per atleta, deduplicate sull'ultimo update) ─────
  const visible = useMemo(() => {
    const byAthlete = new Map<string, SportLiveRow>()
    for (const r of Object.values(rows)) {
      if (!isVisible(r, now)) continue
      const cur = byAthlete.get(r.athlete_id)
      if (!cur || Date.parse(r.updated_at) > Date.parse(cur.updated_at)) byAthlete.set(r.athlete_id, r)
    }
    const arr = Array.from(byAthlete.values())
    const statusRank = (r: SportLiveRow) => (connStatus(r, now) === 'disconnected' ? 1 : 0)
    arr.sort((a, b) => {
      const rs = statusRank(a) - statusRank(b)
      if (rs !== 0) return rs
      switch (sortBy) {
        case 'name':
          return athleteName(a, athletes).localeCompare(athleteName(b, athletes))
        case 'hr':
          return (b.hr ?? -1) - (a.hr ?? -1)
        case 'trimp':
          return (b.trimp ?? -1) - (a.trimp ?? -1)
        case 'zone':
        default:
          return (b.zone ?? -1) - (a.zone ?? -1)
      }
    })
    return arr
  }, [rows, now, sortBy, athletes])

  const inSessionCount = useMemo(
    () => visible.filter((r) => isInSession(r, now)).length,
    [visible, now],
  )
  const anyInSession = inSessionCount > 0

  const selected = selectedId ? rows[selectedId] ?? null : null

  // Esc chiude il drawer.
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  return (
    <div>
      {/* HEADER */}
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl text-anthracite flex items-center gap-3">
            Team <em className="italic text-teal-dark">Live</em>
            {mounted && anyInSession && (
              <span className="relative inline-flex h-3 w-3 align-middle" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
            )}
          </h1>
          <p className="mt-1.5 text-sm text-anthracite-lighter">
            {mounted ? (
              <>
                <strong className="text-anthracite">{inSessionCount}</strong>{' '}
                {inSessionCount === 1 ? 'atleta in sessione' : 'atleti in sessione'}
              </>
            ) : (
              'Monitoraggio in tempo reale'
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {mounted && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg"
              style={{
                color: realtimeOk ? '#0f766e' : '#92400e',
                backgroundColor: realtimeOk ? '#E8F4F3' : '#FEF3C7',
              }}
              title={realtimeOk ? 'Aggiornamenti in tempo reale via WebSocket' : 'WebSocket non disponibile — aggiornamento ogni 5s'}
            >
              {realtimeOk ? <Wifi size={13} /> : <WifiOff size={13} />}
              {realtimeOk ? 'Realtime' : 'Polling 5s'}
            </span>
          )}
          <div className="flex items-center gap-2">
            <label htmlFor="team-live-sort" className="text-xs text-anthracite-lighter">Ordina per</label>
            <select
              id="team-live-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="select-field text-sm"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* GRIGLIA / EMPTY STATE */}
      {!mounted ? (
        <div className="card p-10 text-center text-sm text-anthracite-lighter">Caricamento…</div>
      ) : visible.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {visible.map((row) => (
            <AthleteCard
              key={row.id}
              row={row}
              now={now}
              name={athleteName(row, athletes)}
              hrMax={athleteHrMax(row, athletes)}
              flash={!!flashIds[row.id]}
              onClick={() => setSelectedId(row.id)}
            />
          ))}
        </div>
      )}

      {/* DRAWER DETTAGLIO */}
      {selected && (
        <LiveDrawer
          row={selected}
          now={now}
          name={athleteName(selected, athletes)}
          hrMax={athleteHrMax(selected, athletes)}
          history={history[selected.athlete_id] ?? []}
          baseQuery={baseQuery}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

// ── Card atleta ───────────────────────────────────────────────────────────────

function AthleteCard({
  row,
  now,
  name,
  hrMax,
  flash,
  onClick,
}: {
  row: SportLiveRow
  now: number
  name: string
  hrMax: number | null
  flash: boolean
  onClick: () => void
}) {
  const status = connStatus(row, now)
  const offline = status === 'disconnected'
  const zone = liveZone(row.zone)
  const hrColor = hrZoneColor(row.hr, hrMax) ?? '#2F343A'
  const artifact = artifactPct(row.artifact_rate)
  const artifactHigh = artifact != null && artifact > 5

  return (
    <button
      type="button"
      onClick={onClick}
      className={`card p-5 text-left w-full transition-all duration-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2
        ${offline ? 'opacity-60 border-gray-300' : ''}
        ${flash ? 'ring-2 ring-teal shadow-md' : ''}`}
    >
      {/* Riga 1: semaforo + nome + orario */}
      <div className="flex items-center gap-2.5">
        <ConnDot status={status} />
        <span className="font-serif text-lg text-anthracite leading-tight flex-1 truncate">{name}</span>
        <span className="text-xs text-anthracite-lighter tabular-nums flex items-center gap-1">
          <Timer size={13} /> {formatElapsed(row.elapsed_s)}
        </span>
      </div>

      <div className="mt-0.5 flex items-center justify-between">
        <span className="text-xs text-anthracite-lighter">{row.sport || 'Sport'}</span>
        <span className="text-[11px] text-anthracite-lighter">agg. {formatUpdatedClock(row.updated_at)}</span>
      </div>

      {offline ? (
        <div className="mt-3 text-xs font-medium text-gray-500">
          {row.is_connected === false ? 'Sessione terminata' : 'Disconnesso'} · ultimi dati ricevuti
        </div>
      ) : null}

      {/* Riga 2: HR attuale + HR max */}
      <div className="mt-4 flex items-end justify-between">
        <div className="flex items-baseline gap-2">
          <Heart size={20} style={{ color: hrColor }} className={offline ? '' : 'animate-pulse'} fill={offline ? 'none' : hrColor} />
          <span className="text-4xl font-serif tabular-nums leading-none" style={{ color: hrColor }}>
            {row.hr ?? '—'}
          </span>
          <span className="text-sm text-anthracite-lighter">bpm</span>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-anthracite-lighter">HR Max</div>
          <div className="text-sm font-medium text-anthracite tabular-nums">{row.hr_max ?? '—'}</div>
        </div>
      </div>

      {/* Riga 3: zona DFA — bordo+sfondo del colore zona, vivido da lontano */}
      <div
        className="mt-4 rounded-xl border-2 px-3.5 py-2.5"
        style={{
          borderColor: zone ? zone.color : '#E2E6EA',
          backgroundColor: zone ? zone.bg : '#F6F7F8',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-wide" style={{ color: zone ? zone.color : '#9CA3AF' }}>
            {zone ? `Zona ${zone.id} · ${zone.label}` : 'Zona n/d'}
          </span>
        </div>
        <div className="mt-0.5 text-xs" style={{ color: zone ? zone.color : '#9CA3AF' }}>
          DFA α1: <span className="font-semibold tabular-nums">{num(row.dfa_alpha1, 2)}</span>
        </div>
      </div>

      {/* Riga 4: RMSSD / TRIMP / Artifact */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Metric label="RMSSD" value={row.rmssd == null ? '—' : num(row.rmssd, 1)} />
        <Metric label="TRIMP" value={row.trimp == null ? '—' : `${Math.round(row.trimp)}`} />
        <Metric
          label="Artifact"
          value={artifact == null ? '—' : `${num(artifact, 1)}%`}
          danger={artifactHigh}
        />
      </div>
    </button>
  )
}

function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-anthracite-lighter">{label}</div>
      <div className={`text-sm font-medium tabular-nums ${danger ? 'text-red-600' : 'text-anthracite'}`}>{value}</div>
    </div>
  )
}

function ConnDot({ status }: { status: ConnStatus }) {
  const color = CONN_COLOR[status]
  return (
    <span className="relative inline-flex h-3 w-3 shrink-0" title={CONN_LABEL[status]} aria-label={CONN_LABEL[status]}>
      {status === 'connected' && (
        <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ backgroundColor: color }} />
      )}
      <span className="relative inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
    </span>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="card p-10 sm:p-14 text-center max-w-2xl mx-auto mt-4">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-teal-light text-teal-dark flex items-center justify-center mb-5">
        <Timer size={32} />
      </div>
      <h2 className="font-serif text-2xl text-anthracite">Nessun atleta in sessione</h2>
      <p className="mt-2 text-sm text-anthracite-lighter max-w-md mx-auto">
        Quando i tuoi atleti avviano una sessione sport dall&apos;app, le card appariranno qui in tempo reale.
      </p>

      <div className="mt-8 text-left bg-surface rounded-xl p-5 border border-surface-border">
        <div className="text-sm font-semibold text-anthracite mb-3">Come funziona</div>
        <ol className="space-y-2.5">
          {[
            'Ogni atleta installa l’app Stress Index',
            'Si collega al tuo account professionista',
            'Indossa la fascia Polar e avvia una sessione sport dall’app',
            'I dati appaiono qui automaticamente',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-anthracite">
              <span className="shrink-0 w-6 h-6 rounded-full bg-teal text-white text-xs font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// ── Drawer dettaglio live ─────────────────────────────────────────────────────

function LiveDrawer({
  row,
  now,
  name,
  hrMax,
  history,
  baseQuery,
  onClose,
}: {
  row: SportLiveRow
  now: number
  name: string
  hrMax: number | null
  history: HistPoint[]
  baseQuery: string
  onClose: () => void
}) {
  const status = connStatus(row, now)
  const zone = liveZone(row.zone)
  const tags = parseLiveTags(row.tags)
  const ended = row.is_connected === false
  // Solo gli ultimi 5 minuti di storico per i mini-trend.
  const since = now - 5 * 60 * 1000
  const data = history.filter((p) => p.t >= since)

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-anthracite/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside
        className="absolute top-0 right-0 h-full w-full sm:w-[460px] bg-white shadow-2xl flex flex-col animate-fade-in"
        role="dialog"
        aria-label={`Dettaglio live ${name}`}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-surface-border">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ConnDot status={status} />
              <h2 className="font-serif text-xl text-anthracite truncate">{name}</h2>
            </div>
            <p className="mt-0.5 text-sm text-anthracite-lighter">
              {row.sport || 'Sport'} · <Timer size={12} className="inline" /> {formatElapsed(row.elapsed_s)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="w-9 h-9 rounded-lg hover:bg-surface flex items-center justify-center text-anthracite-lighter hover:text-anthracite shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Valori attuali */}
          <div className="grid grid-cols-3 gap-3">
            <BigStat label="HR" value={row.hr == null ? '—' : `${row.hr}`} unit="bpm" color={hrZoneColor(row.hr, hrMax) ?? '#2F343A'} />
            <BigStat label="DFA α1" value={num(row.dfa_alpha1, 2)} color={zone?.color ?? '#2F343A'} />
            <BigStat label="RMSSD" value={row.rmssd == null ? '—' : num(row.rmssd, 1)} unit="ms" />
          </div>

          {zone && (
            <div
              className="rounded-xl border-2 px-4 py-3 text-center"
              style={{ borderColor: zone.color, backgroundColor: zone.bg }}
            >
              <span className="text-base font-bold uppercase tracking-wide" style={{ color: zone.color }}>
                Zona {zone.id} · {zone.label}
              </span>
            </div>
          )}

          {/* Grafico HR live */}
          <ChartBlock title="Frequenza cardiaca (ultimi 5 min)" icon={<Heart size={15} className="text-red-500" />}>
            <MiniLine data={data} dataKey="hr" color="#EF4444" unit=" bpm" />
          </ChartBlock>

          {/* Grafico DFA Alpha1 con bande zone */}
          <ChartBlock title="DFA Alpha1 con bande zone" icon={<Activity size={15} className="text-teal" />}>
            <MiniLine data={data} dataKey="alpha1" color="#2E746C" domain={[0, 1.5]} bands />
          </ChartBlock>

          {/* Trend RMSSD */}
          <ChartBlock title="RMSSD rolling" icon={<Activity size={15} className="text-amber-500" />}>
            <MiniLine data={data} dataKey="rmssd" color="#F59E0B" unit=" ms" />
          </ChartBlock>

          {/* Tag sessione */}
          {tags.length > 0 && (
            <div>
              <div className="text-sm font-medium text-anthracite mb-2">Tag sessione</div>
              <ul className="flex flex-wrap gap-2">
                {tags.map((t, i) => (
                  <li key={`${t}-${i}`} className="text-sm px-3 py-1.5 rounded-full bg-teal-light text-teal-dark font-medium">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-anthracite-lighter">
            I grafici mostrano i valori accumulati da quando questa pagina è aperta (la tabella live conserva solo l&apos;ultimo valore).
          </p>
        </div>

        {row.session_id && (
          <div className="p-5 border-t border-surface-border">
            <Link
              href={`/area-professionisti/sport/sessione/${row.session_id}${baseQuery}`}
              className="btn-primary text-sm w-full inline-flex items-center justify-center gap-2"
            >
              {ended ? 'Apri dettaglio completo' : 'Apri sessione'} <ArrowUpRight size={16} />
            </Link>
          </div>
        )}
      </aside>
    </div>
  )
}

function BigStat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-anthracite-lighter">{label}</div>
      <div className="mt-1 text-2xl font-serif tabular-nums leading-none" style={{ color: color ?? '#2F343A' }}>
        {value}
      </div>
      {unit && <div className="text-[10px] text-anthracite-lighter mt-0.5">{unit}</div>}
    </div>
  )
}

function ChartBlock({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm font-medium text-anthracite mb-2">{icon}{title}</div>
      <div className="h-32">{children}</div>
    </div>
  )
}

function MiniLine({
  data,
  dataKey,
  color,
  unit = '',
  domain,
  bands,
}: {
  data: HistPoint[]
  dataKey: 'hr' | 'alpha1' | 'rmssd'
  color: string
  unit?: string
  domain?: [number, number]
  bands?: boolean
}) {
  const points = data.filter((p) => p[dataKey] != null)
  if (points.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-anthracite-lighter bg-surface rounded-lg">
        In attesa di dati sufficienti…
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
        {bands &&
          DFA_BANDS.map((b) => (
            <ReferenceArea key={b.id} y1={b.min} y2={Math.min(b.max, domain?.[1] ?? b.max)} fill={b.bg} fillOpacity={0.55} ifOverflow="hidden" />
          ))}
        <XAxis dataKey="t" hide />
        <YAxis
          domain={domain ?? ['auto', 'auto']}
          tick={{ fontSize: 10, fill: '#9CA3AF' }}
          width={34}
          allowDecimals
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E6EA' }}
          labelFormatter={(t) => {
            const d = new Date(Number(t))
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
          }}
          formatter={(v) => [`${typeof v === 'number' ? v.toFixed(dataKey === 'alpha1' ? 2 : 1) : v}${unit}`, '']}
        />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}
