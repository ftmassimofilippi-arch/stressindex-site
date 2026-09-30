import { Link } from '@/i18n/navigation'
import { LinkCell } from '@/components/dashboard/LinkCell'
import { getLocale, getTranslations } from 'next-intl/server'
import { formatIstante, formatMeasuredDate } from '@/lib/format'
import type { ThresholdTestSummary } from '@/lib/sport-data'
import { formatIntensity, thresholdModeLabel, THRESHOLD_MODE_UNIT, type AthleteThresholds } from '@/lib/threshold-types'
import { ThresholdTrendChart } from '../../ThresholdCharts'
import { ZoneList } from '../../sessione/[id]/ThresholdTestView'

// Sezione "Test soglie" della scheda atleta: zone personalizzate attuali (con
// provenienza e avviso dopo 90 giorni), storico dei test con VT1/VT2/HRR60 e
// andamento nel tempo (con l'intensità se la modalità è la stessa).

export async function ThresholdAthleteSection({
  thresholds,
  tests,
  baseQuery,
}: {
  thresholds: AthleteThresholds | null
  tests: ThresholdTestSummary[]
  baseQuery: string
}) {
  const t = await getTranslations('sport')
  const locale = await getLocale()
  const ageDays = thresholds?.vt_test_date ? Math.floor((Date.now() - new Date(thresholds.vt_test_date).getTime()) / 86_400_000) : null
  const stale = ageDays != null && ageDays > 90
  const sameMode = tests.length >= 2 && tests.every((x) => x.record.config.mode === tests[0].record.config.mode)
  const chrono = tests.slice().reverse()

  const intensity = (mode: AthleteThresholds['vt_mode'], power: number | null, speed: number | null): string | null => {
    if (!mode) return null
    if (mode === 'bike') return power == null ? null : `${power} W`
    return speed == null ? null : formatIntensity(mode, speed, true, locale)
  }

  const zonesTitle = thresholds?.hr_zones_manual
    ? t('threshold.zonesManual')
    : thresholds?.vt_test_date
      ? t('threshold.zonesFromTest', { date: formatIstante(thresholds.vt_test_date, undefined, locale) })
      : t('threshold.zonesSaved')

  return (
    <section className="card p-5 mb-6">
      <h2 className="font-serif text-lg text-anthracite mb-3">{t('threshold.sectionTitle')}</h2>

      {/* Zone attuali */}
      {thresholds ? (
        <div className="rounded-xl border border-surface-border bg-surface p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium text-teal-dark">{zonesTitle}</div>
            {thresholds.vt_mode && <span className="text-xs text-anthracite-lighter">{thresholdModeLabel(thresholds.vt_mode, t)}</span>}
          </div>
          <div className="flex flex-wrap gap-6 mt-2">
            <Kv k="VT1" v={thresholds.hr_vt1 == null ? '—' : `${thresholds.hr_vt1} bpm`} sub={intensity(thresholds.vt_mode, thresholds.power_vt1, thresholds.speed_vt1)} />
            <Kv k="VT2" v={thresholds.hr_vt2 == null ? '—' : `${thresholds.hr_vt2} bpm`} sub={intensity(thresholds.vt_mode, thresholds.power_vt2, thresholds.speed_vt2)} />
          </div>
          {thresholds.hr_zones.length > 0 && <div className="mt-3"><ZoneList zones={thresholds.hr_zones} /></div>}
          {stale && (
            <div className="mt-3 text-xs font-medium text-amber-700">{t('threshold.stale', { days: ageDays as number })}</div>
          )}
        </div>
      ) : (
        <p className="text-sm text-anthracite-lighter mb-4">{t('threshold.noneSaved')}</p>
      )}

      {tests.length === 0 ? (
        <p className="text-sm text-anthracite-lighter">{t('threshold.noTests')}</p>
      ) : (
        <>
          <div className="text-xs font-medium text-anthracite-lighter mb-1">{t('threshold.trendTitle')}</div>
          <ThresholdTrendChart
            unit="bpm"
            points={chrono.map((x) => ({ date: x.session.start_time, vt1: x.record.analysis?.vt1?.hr ?? null, vt2: x.record.analysis?.vt2?.hr ?? null }))}
          />
          {sameMode && (
            <>
              <div className="text-xs font-medium text-anthracite-lighter mt-3 mb-1">{t('threshold.intensityTitle', { unit: THRESHOLD_MODE_UNIT[tests[0].record.config.mode] })}</div>
              <ThresholdTrendChart
                unit={THRESHOLD_MODE_UNIT[tests[0].record.config.mode]}
                points={chrono.map((x) => ({ date: x.session.start_time, vt1: x.record.analysis?.vt1?.intensity ?? null, vt2: x.record.analysis?.vt2?.intensity ?? null }))}
              />
            </>
          )}
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead className="bg-surface text-anthracite-lighter">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('threshold.colDate')}</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('threshold.colMode')}</th>
                  <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">VT1</th>
                  <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">VT2</th>
                  <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">HRR60</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {tests.map((x) => {
                  const a = x.record.analysis
                  const current = thresholds?.threshold_session_id === x.session.id
                  const href = `/area-professionisti/sport/sessione/${x.session.id}${baseQuery}`
                  return (
                    <tr key={x.session.id} className={`border-t border-surface-border hover:bg-surface transition-colors ${current ? 'bg-teal-light/30' : ''}`}>
                      <LinkCell href={href} primary padding="px-4 py-2.5" className="text-anthracite font-medium">{formatMeasuredDate(x.session, undefined, locale)}{current && <span className="ml-1 text-[10px] text-teal-dark">· {t('threshold.inUse')}</span>}</LinkCell>
                      <LinkCell href={href} padding="px-3 py-2.5">{thresholdModeLabel(x.record.config.mode, t)}</LinkCell>
                      <LinkCell href={href} padding="px-3 py-2.5" className="text-right tabular-nums">{a?.vt1 ? `${Math.round(a.vt1.hr)} bpm` : '—'}</LinkCell>
                      <LinkCell href={href} padding="px-3 py-2.5" className="text-right tabular-nums">{a?.vt2 ? `${Math.round(a.vt2.hr)} bpm` : '—'}</LinkCell>
                      <LinkCell href={href} padding="px-3 py-2.5" className="text-right tabular-nums">{x.record.recovery?.hrr60 ?? '—'}</LinkCell>
                      <LinkCell href={href} padding="px-3 py-2.5" className="text-right whitespace-nowrap">
                        {a && !a.reliable && <span className="text-[10px] text-amber-700 mr-2">{t('threshold.unreliableShort')}</span>}
                        <span className="text-teal-dark text-sm">{t('sessions.open')} →</span>
                      </LinkCell>
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
