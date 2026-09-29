import { Link } from '@/i18n/navigation'
import { formatIstante, formatMeasuredDate } from '@/lib/format'
import type { ThresholdTestSummary } from '@/lib/sport-data'
import { formatIntensity, THRESHOLD_MODE_LABEL, THRESHOLD_MODE_UNIT, type AthleteThresholds } from '@/lib/threshold-types'
import { ThresholdTrendChart } from '../../ThresholdCharts'
import { ZoneList } from '../../sessione/[id]/ThresholdTestView'

// Sezione "Test soglie" della scheda atleta: zone personalizzate attuali (con
// provenienza e avviso dopo 90 giorni), storico dei test con VT1/VT2/HRR60 e
// andamento nel tempo (con l'intensità se la modalità è la stessa).

export function ThresholdAthleteSection({
  thresholds,
  tests,
  baseQuery,
}: {
  thresholds: AthleteThresholds | null
  tests: ThresholdTestSummary[]
  baseQuery: string
}) {
  const ageDays = thresholds?.vt_test_date ? Math.floor((Date.now() - new Date(thresholds.vt_test_date).getTime()) / 86_400_000) : null
  const stale = ageDays != null && ageDays > 90
  const sameMode = tests.length >= 2 && tests.every((t) => t.record.config.mode === tests[0].record.config.mode)
  const chrono = tests.slice().reverse()

  const intensity = (mode: AthleteThresholds['vt_mode'], power: number | null, speed: number | null): string | null => {
    if (!mode) return null
    if (mode === 'bike') return power == null ? null : `${power} W`
    return speed == null ? null : formatIntensity(mode, speed)
  }

  return (
    <section className="card p-5 mb-6">
      <h2 className="font-serif text-lg text-anthracite mb-3">Test soglie</h2>

      {/* Zone attuali */}
      {thresholds ? (
        <div className="rounded-xl border border-surface-border bg-surface p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium text-teal-dark">
              {thresholds.hr_zones_manual
                ? 'Zone modificate a mano dal professionista'
                : thresholds.vt_test_date
                  ? `Zone dal test del ${formatIstante(thresholds.vt_test_date, 'dd/MM/yyyy')}`
                  : 'Zone salvate'}
            </div>
            {thresholds.vt_mode && <span className="text-xs text-anthracite-lighter">{THRESHOLD_MODE_LABEL[thresholds.vt_mode]}</span>}
          </div>
          <div className="flex flex-wrap gap-6 mt-2">
            <Kv k="VT1" v={thresholds.hr_vt1 == null ? '—' : `${thresholds.hr_vt1} bpm`} sub={intensity(thresholds.vt_mode, thresholds.power_vt1, thresholds.speed_vt1)} />
            <Kv k="VT2" v={thresholds.hr_vt2 == null ? '—' : `${thresholds.hr_vt2} bpm`} sub={intensity(thresholds.vt_mode, thresholds.power_vt2, thresholds.speed_vt2)} />
          </div>
          {thresholds.hr_zones.length > 0 && <div className="mt-3"><ZoneList zones={thresholds.hr_zones} /></div>}
          {stale && (
            <div className="mt-3 text-xs font-medium text-amber-700">Il test ha più di 90 giorni ({ageDays}): conviene ripeterlo.</div>
          )}
        </div>
      ) : (
        <p className="text-sm text-anthracite-lighter mb-4">Nessuna soglia salvata sul profilo: si salvano dall&apos;app, dai risultati di un test con stima affidabile.</p>
      )}

      {tests.length === 0 ? (
        <p className="text-sm text-anthracite-lighter">Nessun test incrementale con stima delle soglie ancora eseguito.</p>
      ) : (
        <>
          <div className="text-xs font-medium text-anthracite-lighter mb-1">Andamento di VT1 e VT2 (bpm)</div>
          <ThresholdTrendChart
            unit="bpm"
            points={chrono.map((t) => ({ date: t.session.start_time, vt1: t.record.analysis?.vt1?.hr ?? null, vt2: t.record.analysis?.vt2?.hr ?? null }))}
          />
          {sameMode && (
            <>
              <div className="text-xs font-medium text-anthracite-lighter mt-3 mb-1">Intensità alle soglie ({THRESHOLD_MODE_UNIT[tests[0].record.config.mode]})</div>
              <ThresholdTrendChart
                unit={THRESHOLD_MODE_UNIT[tests[0].record.config.mode]}
                points={chrono.map((t) => ({ date: t.session.start_time, vt1: t.record.analysis?.vt1?.intensity ?? null, vt2: t.record.analysis?.vt2?.intensity ?? null }))}
              />
            </>
          )}
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead className="bg-surface text-anthracite-lighter">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide font-medium">Data</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">Modalità</th>
                  <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">VT1</th>
                  <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">VT2</th>
                  <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">HRR60</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => {
                  const a = t.record.analysis
                  const current = thresholds?.threshold_session_id === t.session.id
                  return (
                    <tr key={t.session.id} className={`border-t border-surface-border ${current ? 'bg-teal-light/30' : ''}`}>
                      <td className="px-4 py-2.5 text-anthracite font-medium">{formatMeasuredDate(t.session)}{current && <span className="ml-1 text-[10px] text-teal-dark">· in uso</span>}</td>
                      <td className="px-3 py-2.5">{THRESHOLD_MODE_LABEL[t.record.config.mode]}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{a?.vt1 ? `${Math.round(a.vt1.hr)} bpm` : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{a?.vt2 ? `${Math.round(a.vt2.hr)} bpm` : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{t.record.recovery?.hrr60 ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right">
                        {a && !a.reliable && <span className="text-[10px] text-amber-700 mr-2">stima non affidabile</span>}
                        <Link href={`/area-professionisti/sport/sessione/${t.session.id}${baseQuery}`} className="text-teal-dark text-sm hover:underline">Apri →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function Kv({ k, v, sub }: { k: string; v: string; sub: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-anthracite-lighter">{k}</div>
      <div className="font-serif text-2xl text-anthracite">{v}</div>
      {sub && <div className="text-xs text-anthracite-lighter">{sub}</div>}
    </div>
  )
}
