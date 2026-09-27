import type { DfaWindow } from '@/lib/sport-data'
import { DFA_ZONES, zoneForAlpha1 } from '@/lib/sport-format'
import { formatClock } from '@/lib/sport-format'
import {
  formatIntensity,
  hrr60Band,
  THRESHOLD_METHOD_NOTE,
  THRESHOLD_MODE_LABEL,
  THRESHOLD_REASON_TEXT,
  type HrZone,
  type ThresholdTestRecord,
} from '@/lib/threshold-types'
import { ThresholdScatterChart, ThresholdTimeChart } from '../../ThresholdCharts'

// Dettaglio di una sessione di tipo test incrementale con stima delle soglie:
// card soglie, scatter alpha1-FC con retta e soglie, grafico temporale con le
// bande degli step, tabella step, recupero, nota metodologica. Tutto letto da
// sport_sessions.threshold_test (calcolato dall'app), niente ricalcoli.

const Z3 = DFA_ZONES[2].color
const Z4 = DFA_ZONES[3].color

export function ThresholdTestView({ record, windows }: { record: ThresholdTestRecord; windows: DfaWindow[] }) {
  const a = record.analysis
  const mode = record.config.mode
  return (
    <div className="space-y-6">
      {/* Soglie stimate */}
      <section className="card p-5">
        <h2 className="font-serif text-lg text-anthracite mb-1">Soglie stimate</h2>
        <p className="text-xs text-anthracite-lighter mb-4">
          {THRESHOLD_MODE_LABEL[mode]} · dal DFA alpha1 durante il test
        </p>
        {!a ? (
          <div className="callout-blue text-sm text-anthracite">
            Test eseguito senza stima delle soglie: il sensore non trasmetteva gli intervalli RR necessari al DFA alpha1.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ThresholdTile name="VT1 stimata" color={Z3} hr={a.vt1?.hr ?? null} ci={a.vt1?.ci95 ?? null} intensity={a.vt1 ? formatIntensity(mode, a.vt1.intensity) : null} />
              <ThresholdTile name="VT2 stimata" color={Z4} hr={a.vt2?.hr ?? null} ci={a.vt2?.ci95 ?? null} intensity={a.vt2 ? formatIntensity(mode, a.vt2.intensity) : null} />
            </div>
            <div className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${a.reliable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {a.regression
                ? a.reliable
                  ? `Stima affidabile (R² ${a.regression.r2.toFixed(2)})`
                  : `Stima non affidabile (R² ${a.regression.r2.toFixed(2)}, sotto 0,6): i dati si mostrano, le soglie non si salvano.`
                : 'Segnale non sufficiente per stimare le soglie'}
            </div>
            {a.reasons.filter((r) => r !== 'lowR2').length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-anthracite-lighter">
                {a.reasons.filter((r) => r !== 'lowR2').map((r) => (
                  <li key={r}>· {THRESHOLD_REASON_TEXT[r] ?? r}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-anthracite-lighter">
              <Pill label="finestre valide" value={`${a.valid_windows} (${Math.round(a.valid_seconds / 60)} min)`} />
              <Pill label="scartate per artefatti > 3%" value={`${a.discarded_for_artifacts}`} />
              {a.hr_max_observed != null && <Pill label="FC max raggiunta" value={`${Math.round(a.hr_max_observed)} bpm`} />}
              <Pill label="step raggiunto" value={record.step_reached === 0 ? 'riscaldamento' : `${record.step_reached}${record.step_fraction < 0.99 ? ` (${Math.round(record.step_fraction * 100)}%)` : ''}`} />
              <Pill label="stop a" value={formatClock(record.stop_at_s * 1000)} />
              {record.sensor_name && <Pill label="sensore" value={record.sensor_name} />}
            </div>
          </>
        )}
      </section>

      {/* Scatter */}
      <section className="card p-5">
        <h2 className="font-serif text-lg text-anthracite mb-3">Alpha1 contro FC</h2>
        <ThresholdScatterChart windows={windows} record={record} />
      </section>

      {/* Temporale */}
      <section className="card p-5">
        <h2 className="font-serif text-lg text-anthracite mb-3">FC e alpha1 nel tempo</h2>
        <ThresholdTimeChart windows={windows} record={record} />
      </section>

      {/* Step */}
      <section className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border">
          <h2 className="font-serif text-lg text-anthracite">Step</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-anthracite-lighter">
              <tr>
                <th className="text-left px-6 py-2.5 text-[11px] uppercase tracking-wide font-medium">Step</th>
                <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">Intensità</th>
                <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">FC media</th>
                <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">alpha1 medio</th>
                <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">Zona</th>
              </tr>
            </thead>
            <tbody>
              {record.steps.map((s) => {
                const z = zoneForAlpha1(s.alpha1_avg)
                const intensity = s.actual_intensity ?? s.target_intensity
                return (
                  <tr key={s.index} className="border-t border-surface-border">
                    <td className="px-6 py-2.5 text-anthracite font-medium">
                      {s.index === 0 ? 'Riscaldamento' : `${s.index}`}
                      {s.completed_fraction < 0.99 && <span className="text-[11px] text-anthracite-lighter ml-1">({Math.round(s.completed_fraction * 100)}%)</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {s.index === 0 && intensity == null ? 'corsa lenta' : formatIntensity(mode, intensity)}
                      {s.actual_intensity != null && <span className="text-[11px] text-anthracite-lighter ml-1" title="intensità corretta dall'atleta">*</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.hr_avg == null ? '—' : Math.round(s.hr_avg)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.alpha1_avg == null ? '—' : s.alpha1_avg.toFixed(2)}</td>
                    <td className="px-3 py-2.5">
                      {z ? (
                        <span className="inline-flex items-center gap-1.5 text-xs"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: z.color }} />{z.short} · {z.label}</span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {record.steps.some((s) => s.actual_intensity != null) && (
          <p className="px-6 py-2 text-[11px] text-anthracite-lighter">* intensità corretta dall&apos;atleta durante il test</p>
        )}
      </section>

      {/* Recupero */}
      <section className="card p-5">
        <h2 className="font-serif text-lg text-anthracite mb-1">Recupero a 60 secondi</h2>
        {record.recovery?.hrr60 == null ? (
          <p className="text-sm text-anthracite-lighter">Recupero non registrato: il test è stato chiuso prima dei 60 secondi.</p>
        ) : (
          <RecoveryBlock hrr60={record.recovery.hrr60} hrStop={record.recovery.hr_at_stop} hr60={record.recovery.hr_at_60} rmssd={record.recovery.rmssd_5min} />
        )}
      </section>

      {/* Zone */}
      <section className="card p-5">
        <h2 className="font-serif text-lg text-anthracite mb-1">Zone di FC proposte</h2>
        <p className="text-xs text-anthracite-lighter mb-3">
          I confini delle cinque zone DFA (1,0 · 0,75 · 0,50 · 0,30) convertiti in FC con la stessa retta del test. Un confine fuori dai dati osservati non si inventa: la zona si unisce alla vicina.
        </p>
        <ZoneList zones={a?.zones ?? []} />
      </section>

      <div className="rounded-2xl bg-teal-light/40 px-5 py-4 text-sm text-anthracite">{THRESHOLD_METHOD_NOTE}</div>
    </div>
  )
}

function ThresholdTile({ name, color, hr, ci, intensity }: { name: string; color: string; hr: number | null; ci: number | null; intensity: string | null }) {
  return (
    <div className="rounded-xl border px-4 py-3" style={{ borderColor: color, backgroundColor: `${color}14` }}>
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>{name}</div>
      {hr == null ? (
        <div className="font-serif text-3xl text-anthracite-lighter mt-1">—</div>
      ) : (
        <>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-serif text-4xl text-anthracite">{Math.round(hr)}</span>
            <span className="text-xs text-anthracite-lighter">bpm</span>
          </div>
          {ci != null && Number.isFinite(ci) && <div className="text-[11px] text-anthracite-lighter">± {ci.toFixed(1)} bpm (IC95%)</div>}
          {intensity && intensity !== '—' && <div className="text-sm font-medium text-anthracite mt-1">{intensity}</div>}
        </>
      )}
    </div>
  )
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface px-2 py-1">
      {label} <b className="text-anthracite">{value}</b>
    </span>
  )
}

export function RecoveryBlock({ hrr60, hrStop, hr60, rmssd }: { hrr60: number; hrStop: number | null; hr60: number | null; rmssd: number | null }) {
  const band = hrr60Band(hrr60)
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-4xl text-anthracite">{hrr60}</span>
        <span className="text-xs text-anthracite-lighter">bpm</span>
        <span className={`ml-2 text-sm font-medium ${band.tone}`}>{band.label}</span>
      </div>
      <div className="text-xs text-anthracite-lighter mt-1">
        FC allo stop {hrStop ?? '—'} bpm, a 60 s {hr60 ?? '—'} bpm
        {rmssd != null && ` · RMSSD nei primi 5 minuti di recupero ${rmssd.toFixed(1)} ms`}
      </div>
      <p className="text-[11px] text-anthracite-lighter mt-2">
        Lettura: 25 bpm o più buono, 13–24 nella media, 12 o meno da migliorare (soglie di letteratura, le stesse dell&apos;app). Il recupero migliora con l&apos;allenamento aerobico.
      </p>
    </div>
  )
}

export function ZoneList({ zones }: { zones: HrZone[] }) {
  if (zones.length === 0) return <p className="text-sm text-anthracite-lighter">Zone non disponibili senza una stima.</p>
  return (
    <ul className="space-y-1.5">
      {zones.map((z) => {
        const def = DFA_ZONES.find((d) => d.id === z.zone) ?? DFA_ZONES[4]
        const range =
          z.merged_with != null ? `unita alla Z${z.merged_with}`
            : z.lo == null ? `< ${Math.round(z.hi ?? 0)} bpm`
            : z.hi == null ? `> ${Math.round(z.lo)} bpm`
            : `${Math.round(z.lo)} – ${Math.round(z.hi)} bpm`
        return (
          <li key={z.zone} className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: def.color }} />{def.short} · {def.label} <span className="text-[11px] text-anthracite-lighter">(α1 {def.min === 0 ? '<' : ''}{def.max === Infinity ? `> ${def.min}` : def.min === 0 ? def.max : `${def.min}–${def.max}`})</span></span>
            <span className={`tabular-nums ${z.merged_with != null ? 'text-anthracite-lighter' : 'font-medium text-anthracite'}`}>{range}</span>
          </li>
        )
      })}
    </ul>
  )
}
