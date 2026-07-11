'use client'

import { num } from '@/lib/format'
import type { OrthostaticData, OrthostaticPhaseMetrics } from '@/lib/types'
import { PoincareScatter, Rhythmogram } from './HrvCharts'

// Vista dedicata alla misurazione ortostatica: confronto supino vs in piedi
// (stessa analisi della pagina risultati dell'app) + indice di reattività.

type Row = { key: keyof OrthostaticPhaseMetrics; label: string; unit?: string; digits?: number }

const ROWS: Row[] = [
  { key: 'meanBpm', label: 'Frequenza cardiaca', unit: 'bpm', digits: 0 },
  { key: 'sdnn', label: 'SDNN', unit: 'ms' },
  { key: 'rmssd', label: 'RMSSD', unit: 'ms' },
  { key: 'pnn50', label: 'pNN50', unit: '%' },
  { key: 'sd1', label: 'SD1', unit: 'ms' },
  { key: 'sd2', label: 'SD2', unit: 'ms' },
  { key: 'lfPower', label: 'LF', unit: 'ms²' },
  { key: 'hfPower', label: 'HF', unit: 'ms²' },
  { key: 'lfHfRatio', label: 'LF/HF', digits: 2 },
  { key: 'lfNorm', label: 'LFnu', unit: 'n.u.' },
  { key: 'hfNorm', label: 'HFnu', unit: 'n.u.' },
  { key: 'totalPower', label: 'Total Power', unit: 'ms²' },
  { key: 'dfaAlpha1', label: 'DFA α1', digits: 2 },
  { key: 'stressIndex', label: 'Stress Index (Baevsky)', digits: 1 },
]

function val(phase: OrthostaticPhaseMetrics | null | undefined, key: keyof OrthostaticPhaseMetrics): number | null {
  const v = phase?.[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function deltaPct(supine: number | null, standing: number | null): number | null {
  if (supine == null || standing == null || supine === 0) return null
  return ((standing - supine) / Math.abs(supine)) * 100
}

export function OrthostaticView({ data }: { data: OrthostaticData | null }) {
  if (!data || (!data.supine && !data.standing)) {
    return (
      <div className="card p-8 text-center text-sm text-anthracite-lighter">
        Dato ortostatico non disponibile per questa misurazione
      </div>
    )
  }

  const supine = data.supine
  const standing = data.standing
  const ri = data.reactivityIndex

  const riLevel =
    ri == null ? null
      : ri >= 70 ? { label: 'Reattività ottimale', tone: 'text-emerald-700' }
      : ri >= 40 ? { label: 'Reattività moderata', tone: 'text-amber-700' }
      : { label: 'Reattività ridotta', tone: 'text-red-700' }

  return (
    <div className="space-y-6">
      {/* Indice di reattività ortostatica */}
      <section className="card p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg text-anthracite mb-1">Indice di <em className="italic">reattività ortostatica</em></h2>
            <p className="text-sm text-anthracite-lighter max-w-prose">
              Sintetizza l&apos;adattamento del sistema nervoso autonomo al passaggio dalla posizione supina a quella eretta.
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-2 justify-end">
              <span className="font-serif text-5xl text-anthracite">{num(ri, 1)}</span>
              <span className="text-sm text-anthracite-lighter">/ 100</span>
            </div>
            {riLevel && <div className={`text-xs font-medium mt-1 ${riLevel.tone}`}>{riLevel.label}</div>}
          </div>
        </div>
      </section>

      {/* Tabella confronto supino vs in piedi */}
      <section className="card p-6">
        <h3 className="font-serif text-base text-anthracite mb-4">Confronto fasi · <span className="text-anthracite-lighter font-sans text-sm">supino vs in piedi</span></h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-anthracite-lighter border-b border-surface-border">
                <th className="py-2 pr-4 font-medium">Parametro</th>
                <th className="py-2 px-4 font-medium text-right">
                  <span className="inline-flex items-center gap-1.5 justify-end">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#4FA39A' }} /> Supino
                  </span>
                </th>
                <th className="py-2 px-4 font-medium text-right">
                  <span className="inline-flex items-center gap-1.5 justify-end">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#6366F1' }} /> In piedi
                  </span>
                </th>
                <th className="py-2 pl-4 font-medium text-right">Variazione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {ROWS.map((r) => {
                const s = val(supine, r.key)
                const st = val(standing, r.key)
                const d = deltaPct(s, st)
                return (
                  <tr key={String(r.key)}>
                    <td className="py-2 pr-4 text-anthracite-lighter">{r.label}</td>
                    <td className="py-2 px-4 text-right font-medium text-anthracite tabular-nums">
                      {num(s, r.digits ?? 1)}{r.unit ? <span className="text-[10px] text-anthracite-lighter ml-1">{r.unit}</span> : null}
                    </td>
                    <td className="py-2 px-4 text-right font-medium text-anthracite tabular-nums">
                      {num(st, r.digits ?? 1)}{r.unit ? <span className="text-[10px] text-anthracite-lighter ml-1">{r.unit}</span> : null}
                    </td>
                    <td className="py-2 pl-4 text-right tabular-nums">
                      {d == null ? <span className="text-anthracite-lighter">—</span> : (
                        <span className={d > 0 ? 'text-emerald-700' : d < 0 ? 'text-red-700' : 'text-anthracite-lighter'}>
                          {d > 0 ? '+' : ''}{d.toFixed(0)}%
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-anthracite-lighter mt-3">
          La variazione confronta la fase in piedi rispetto a quella supina. Nel passaggio ortostatico è fisiologico l&apos;aumento della frequenza cardiaca e la riduzione della variabilità vagale (RMSSD, HF).
        </p>
      </section>

      {/* Poincaré + ritmogramma per fase */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PhaseCharts title="Fase supina" phase={supine} />
        <PhaseCharts title="Fase in piedi" phase={standing} />
      </div>
    </div>
  )
}

function PhaseCharts({ title, phase }: { title: string; phase: OrthostaticPhaseMetrics | null | undefined }) {
  const rr = Array.isArray(phase?.rrIntervals) ? (phase!.rrIntervals as number[]) : null
  return (
    <div className="card p-6 space-y-6">
      <h3 className="font-serif text-base text-anthracite">{title}</h3>
      <div>
        <div className="text-xs text-anthracite-lighter mb-2">Diagramma di Poincaré</div>
        <PoincareScatter rr={rr} sd1={val(phase, 'sd1')} sd2={val(phase, 'sd2')} />
      </div>
      <div>
        <div className="text-xs text-anthracite-lighter mb-2">Ritmogramma RR</div>
        <Rhythmogram rr={rr} />
      </div>
    </div>
  )
}
