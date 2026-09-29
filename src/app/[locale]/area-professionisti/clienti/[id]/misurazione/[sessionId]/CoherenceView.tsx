'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useLocale, useTranslations } from 'next-intl'
import { num, toNum } from '@/lib/format'
import { formatClock } from '@/lib/measurement-type'
import type { CoherenceData, MeasurementAnalytics } from '@/lib/types'
import { PsdPlaceholder } from './HrvCharts'

// Vista dedicata alla misurazione di coerenza cardiaca (respirazione guidata).
// Mostra score di coerenza, frequenza respiratoria, frequenza di risonanza,
// l'andamento della coerenza nel tempo e lo spettro PSD con la banda di risonanza.

export function CoherenceView({
  data,
  measurement,
}: {
  data: CoherenceData | null
  measurement: MeasurementAnalytics
}) {
  const locale = useLocale()
  const t = useTranslations('measurement.coherence')
  const tAxes = useTranslations('charts.axes')

  if (!data) {
    return (
      <div className="card p-8 text-center text-sm text-anthracite-lighter">
        {t('unavailable')}
      </div>
    )
  }

  // coherence_data è jsonb scritto dall'app: i valori vanno coercizzati prima
  // di qualsiasi formattazione numerica, non sono garantiti number.
  const score = toNum(data.coherenceScore)
  const breathing = toNum(data.breathingRate)
  const resonanceHz = toNum(data.peakFrequencyHz)
  const resonanceBpm = resonanceHz != null ? resonanceHz * 60 : null
  const inhaleRatio = toNum(data.inhaleRatio)
  const series = (Array.isArray(data.coherenceSeries) ? data.coherenceSeries : [])
    .map((v) => toNum(v))
    .filter((v): v is number => v != null)

  // Soglie dell'app (coherenceScoreLabel): ≥60 alta, ≥30 moderata, sotto bassa.
  const scoreLevel =
    score == null ? null
      : score >= 60 ? { label: t('levelHigh'), tone: 'text-emerald-700' }
      : score >= 30 ? { label: t('levelModerate'), tone: 'text-amber-700' }
      : { label: t('levelLow'), tone: 'text-red-700' }

  // Picco di risonanza contro il ritmo impostato: come nella pagina risultati
  // dell'app, entro 0,5 resp/min il picco è "allineato" al ritmo guidato.
  const peakDelta = resonanceBpm != null && breathing != null ? Math.abs(resonanceBpm - breathing) : null
  const peakAligned = peakDelta == null ? null : peakDelta <= 0.5

  // Distribuisce i punti della serie sul tempo della sessione (finestre uniformi).
  const dur = toNum(measurement.duration_seconds) ?? 0
  const seriesData = series.map((v, i) => ({
    idx: i + 1,
    t: series.length > 1 && dur > 0 ? (dur * (i + 1)) / series.length : i + 1,
    coherence: v,
  }))

  return (
    <div className="space-y-6">
      {/* Card indici principali */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter">{t('scoreTitle')}</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-serif text-4xl text-anthracite">{num(score, 0, locale)}</span>
            <span className="text-xs text-anthracite-lighter">/ 100</span>
          </div>
          {scoreLevel && <div className={`text-[11px] font-medium mt-1 ${scoreLevel.tone}`}>{scoreLevel.label}</div>}
        </div>
        <div className="card p-5 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter">{t('breathingTitle')}</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-serif text-4xl text-anthracite">{num(breathing, 1, locale)}</span>
            <span className="text-xs text-anthracite-lighter">{t('breathsPerMin')}</span>
          </div>
          <div className="text-[11px] text-anthracite-lighter mt-1">{t('setRate')}</div>
        </div>
        <div className="card p-5 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter">{t('resonanceTitle')}</div>
          <div className="flex items-baseline gap-1 mt-1">
            {resonanceHz != null ? (
              <>
                <span className="font-serif text-4xl text-anthracite">{num(resonanceHz, 3, locale)}</span>
                <span className="text-xs text-anthracite-lighter">Hz</span>
              </>
            ) : (
              <span className="font-serif text-2xl text-anthracite-lighter">{t('notDetected')}</span>
            )}
          </div>
          {resonanceBpm != null && <div className="text-[11px] text-anthracite-lighter mt-1">{t('approxBpm', { value: num(resonanceBpm, 1, locale) })}</div>}
          {peakAligned != null && (
            <div className={`text-[11px] font-medium mt-1 ${peakAligned ? 'text-emerald-700' : 'text-amber-700'}`}>
              {peakAligned ? t('peakAligned') : t('peakOffset', { value: num(peakDelta!, 1, locale) })}
            </div>
          )}
        </div>
        <div className="card p-5 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter">{t('inhaleTitle')}</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-serif text-4xl text-anthracite">{inhaleRatio != null ? num(inhaleRatio * 100, 0, locale) : '—'}</span>
            {inhaleRatio != null && <span className="text-xs text-anthracite-lighter">{t('ofCycle')}</span>}
          </div>
          <div className="text-[11px] text-anthracite-lighter mt-1">{t('inhaleHint')}</div>
        </div>
      </section>

      {/* Andamento coerenza nel tempo */}
      <section className="card p-6">
        <h3 className="font-serif text-base text-anthracite mb-1">
          {t.rich('trendTitle', { em: (c) => <em className="italic">{c}</em> })}
        </h3>
        <p className="text-xs text-anthracite-lighter mb-4">{t('trendSubtitle')}</p>
        {seriesData.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-sm text-anthracite-lighter bg-surface rounded-xl">
            {t('noSeries')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={seriesData} margin={{ top: 8, right: 20, bottom: 28, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
              <XAxis
                dataKey="t"
                type="number"
                domain={[0, 'dataMax']}
                stroke="#6B7280"
                fontSize={10}
                tickFormatter={(v) => (dur > 0 ? formatClock(Number(v)) : `#${Math.round(Number(v))}`)}
                label={{ value: dur > 0 ? tAxes('timeClock') : tAxes('window'), position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6B7280' }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#6B7280"
                fontSize={10}
                label={{ value: tAxes('coherence'), angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }}
              />
              {score != null && (
                <ReferenceLine y={score} stroke="#8B5CF6" strokeDasharray="4 4" label={{ value: t('meanLabel', { value: num(score, 0, locale) }), position: 'right', fontSize: 10, fill: '#6D28D9' }} />
              )}
              <Tooltip
                contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }}
                labelFormatter={(v) => (dur > 0 ? t('tooltipTime', { value: formatClock(Number(v)) }) : t('tooltipWindow', { value: Math.round(Number(v)) }))}
                formatter={(v) => [num(v, 1, locale), tAxes('coherence')]}
              />
              <Line type="monotone" dataKey="coherence" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 2.5, fill: '#8B5CF6' }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Spettro PSD con banda di risonanza */}
      <section className="card p-6">
        <h3 className="font-serif text-base text-anthracite mb-1">{t('psdTitle')}</h3>
        <p className="text-xs text-anthracite-lighter mb-3">{t('psdSubtitle')}</p>
        <PsdPlaceholder
          vlf={measurement.vlf_power}
          lf={measurement.lf_power}
          hf={measurement.hf_power}
          lfHfRatio={measurement.lf_hf_ratio}
          resonanceHz={resonanceHz}
        />
      </section>
    </div>
  )
}
