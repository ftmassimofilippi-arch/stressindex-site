'use client'

import { useLocale, useTranslations } from 'next-intl'
import { num } from '@/lib/format'
import type { OrthostaticData, OrthostaticPhaseMetrics } from '@/lib/types'
import { PoincareScatter, Rhythmogram } from './HrvCharts'

// Vista dedicata alla misurazione ortostatica: confronto supino vs in piedi
// (stessa analisi della pagina risultati dell'app) + indice di reattività.

// `expected`: direzione fisiologica ATTESA nel passaggio supino → in piedi
// (+1 sale, -1 scende, 0 nessuna attesa). Il colore della variazione dice se
// la risposta è nella direzione attesa (teal), opposta (ambra) o neutra: un
// aumento della frequenza cardiaca in piedi è normale, colorarlo di verde o di
// rosso "per segno" raccontava il contrario. Stessa lettura della pagina
// risultati dell'app (risposte fisiologiche normali: HR +10–30 bpm, RMSSD
// -30–50%, rapporto LF/HF in aumento, Stress Index in aumento).
// L'etichetta di ogni riga è in `measurement.orthostatic.rows.<key>`.
type Row = { key: keyof OrthostaticPhaseMetrics; unit?: string; digits?: number; expected: -1 | 0 | 1 }

const ROWS: Row[] = [
  { key: 'meanBpm', unit: 'bpm', digits: 0, expected: 1 },
  { key: 'sdnn', unit: 'ms', expected: 0 },
  { key: 'rmssd', unit: 'ms', expected: -1 },
  { key: 'pnn50', unit: '%', expected: -1 },
  { key: 'sd1', unit: 'ms', expected: -1 },
  { key: 'sd2', unit: 'ms', expected: 0 },
  { key: 'lfPower', unit: 'ms²', expected: 0 },
  { key: 'hfPower', unit: 'ms²', expected: -1 },
  { key: 'lfHfRatio', digits: 2, expected: 1 },
  { key: 'lfNorm', unit: 'n.u.', expected: 1 },
  { key: 'hfNorm', unit: 'n.u.', expected: -1 },
  { key: 'totalPower', unit: 'ms²', expected: 0 },
  { key: 'dfaAlpha1', digits: 2, expected: 0 },
  { key: 'stressIndex', digits: 1, expected: 1 },
]

function val(phase: OrthostaticPhaseMetrics | null | undefined, key: keyof OrthostaticPhaseMetrics): number | null {
  const v = phase?.[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function deltaPct(supine: number | null, standing: number | null): number | null {
  if (supine == null || standing == null || supine === 0) return null
  return ((standing - supine) / Math.abs(supine)) * 100
}

function deltaAbs(supine: number | null, standing: number | null): number | null {
  if (supine == null || standing == null) return null
  return standing - supine
}

// Classe colore della variazione: nella direzione attesa (teal), opposta
// (ambra), oppure neutra quando non c'è un'attesa fisiologica per quel
// parametro o la variazione è trascurabile.
function deltaTone(pctDelta: number | null, expected: -1 | 0 | 1): string {
  if (pctDelta == null || expected === 0 || Math.abs(pctDelta) < 2) return 'text-anthracite'
  return Math.sign(pctDelta) === expected ? 'text-teal-dark' : 'text-amber-700'
}

function signed(v: number, digits: number, locale: string): string {
  return `${v > 0 ? '+' : ''}${num(v, digits, locale)}`
}

export function OrthostaticView({ data }: { data: OrthostaticData | null }) {
  const locale = useLocale()
  const t = useTranslations('measurement.orthostatic')

  if (!data || (!data.supine && !data.standing)) {
    return (
      <div className="card p-8 text-center text-sm text-anthracite-lighter">
        {t('unavailable')}
      </div>
    )
  }

  const supine = data.supine
  const standing = data.standing
  const ri = data.reactivityIndex

  const riLevel =
    ri == null ? null
      : ri >= 70 ? { label: t('reactivityOptimal'), tone: 'text-emerald-700' }
      : ri >= 40 ? { label: t('reactivityModerate'), tone: 'text-amber-700' }
      : { label: t('reactivityReduced'), tone: 'text-red-700' }

  return (
    <div className="space-y-6">
      {/* Indice di reattività ortostatica */}
      <section className="card p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-serif text-lg text-anthracite mb-1">
              {t.rich('title', { em: (c) => <em className="italic">{c}</em> })}
            </h2>
            <p className="text-sm text-anthracite-lighter max-w-prose">{t('description')}</p>
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-2 justify-end">
              <span className="font-serif text-5xl text-anthracite">{num(ri, 1, locale)}</span>
              <span className="text-sm text-anthracite-lighter">/ 100</span>
            </div>
            {riLevel && <div className={`text-xs font-medium mt-1 ${riLevel.tone}`}>{riLevel.label}</div>}
          </div>
        </div>
      </section>

      {/* Tabella confronto supino vs in piedi */}
      <section className="card p-6">
        <h3 className="font-serif text-base text-anthracite mb-4">
          {t('comparisonTitle')} · <span className="text-anthracite-lighter font-sans text-sm">{t('comparisonSubtitle')}</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-anthracite-lighter border-b border-surface-border">
                <th className="py-2 pr-4 font-medium">{t('colParameter')}</th>
                <th className="py-2 px-4 font-medium text-right">
                  <span className="inline-flex items-center gap-1.5 justify-end whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#4FA39A' }} /> {t('supine')}
                  </span>
                </th>
                <th className="py-2 px-4 font-medium text-right">
                  <span className="inline-flex items-center gap-1.5 justify-end whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#6366F1' }} /> {t('standing')}
                  </span>
                </th>
                <th className="py-2 pl-4 font-medium text-right">{t('colChange')}</th>
                <th className="py-2 pl-4 font-medium text-right">{t('colPct')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {ROWS.map((r) => {
                const s = val(supine, r.key)
                const st = val(standing, r.key)
                const d = deltaPct(s, st)
                const da = deltaAbs(s, st)
                const tone = deltaTone(d, r.expected)
                return (
                  <tr key={String(r.key)}>
                    <td className="py-2 pr-4 text-anthracite-lighter">{t(`rows.${String(r.key)}`)}</td>
                    <td className="py-2 px-4 text-right font-medium text-anthracite tabular-nums">
                      {num(s, r.digits ?? 1, locale)}{r.unit ? <span className="text-[10px] text-anthracite-lighter ml-1">{r.unit}</span> : null}
                    </td>
                    <td className="py-2 px-4 text-right font-medium text-anthracite tabular-nums">
                      {num(st, r.digits ?? 1, locale)}{r.unit ? <span className="text-[10px] text-anthracite-lighter ml-1">{r.unit}</span> : null}
                    </td>
                    <td className="py-2 pl-4 text-right tabular-nums">
                      {da == null ? <span className="text-anthracite-lighter">—</span> : (
                        <span className={tone}>
                          {signed(da, r.digits ?? 1, locale)}{r.unit ? <span className="text-[10px] text-anthracite-lighter ml-1">{r.unit}</span> : null}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pl-4 text-right tabular-nums">
                      {d == null ? <span className="text-anthracite-lighter">—</span> : (
                        <span className={tone}>
                          {signed(d, 0, locale)}%
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-anthracite-lighter mt-3">{t('note')}</p>
      </section>

      {/* Poincaré + ritmogramma per fase */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PhaseCharts title={t('phaseSupine')} phase={supine} />
        <PhaseCharts title={t('phaseStanding')} phase={standing} />
      </div>
    </div>
  )
}

function PhaseCharts({ title, phase }: { title: string; phase: OrthostaticPhaseMetrics | null | undefined }) {
  const t = useTranslations('measurement.orthostatic')
  const rr = Array.isArray(phase?.rrIntervals) ? (phase!.rrIntervals as number[]) : null
  return (
    <div className="card p-6 space-y-6">
      <h3 className="font-serif text-base text-anthracite">{title}</h3>
      <div>
        <div className="text-xs text-anthracite-lighter mb-2">{t('poincare')}</div>
        <PoincareScatter rr={rr} sd1={val(phase, 'sd1')} sd2={val(phase, 'sd2')} />
      </div>
      <div>
        <div className="text-xs text-anthracite-lighter mb-2">{t('rhythmogram')}</div>
        <Rhythmogram rr={rr} />
      </div>
    </div>
  )
}
