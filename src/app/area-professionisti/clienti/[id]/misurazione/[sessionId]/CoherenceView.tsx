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
import { num } from '@/lib/format'
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
  if (!data) {
    return (
      <div className="card p-8 text-center text-sm text-anthracite-lighter">
        Dato di coerenza non disponibile per questa misurazione
      </div>
    )
  }

  const score = data.coherenceScore
  const breathing = data.breathingRate
  const resonanceHz = data.peakFrequencyHz
  const resonanceBpm = resonanceHz != null ? resonanceHz * 60 : null
  const inhaleRatio = data.inhaleRatio
  const series = Array.isArray(data.coherenceSeries) ? data.coherenceSeries : []

  const scoreLevel =
    score == null ? null
      : score >= 66 ? { label: 'Coerenza alta', tone: 'text-emerald-700' }
      : score >= 33 ? { label: 'Coerenza media', tone: 'text-amber-700' }
      : { label: 'Coerenza bassa', tone: 'text-red-700' }

  // Distribuisce i punti della serie sul tempo della sessione (finestre uniformi).
  const dur = measurement.duration_seconds ?? 0
  const seriesData = series.map((v, i) => ({
    idx: i + 1,
    t: series.length > 1 && dur > 0 ? (dur * (i + 1)) / series.length : i + 1,
    coherence: v,
  }))

  return (
    <div className="space-y-6">
      {/* Card indici principali */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter">Score di coerenza</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-serif text-4xl text-anthracite">{num(score, 0)}</span>
            <span className="text-xs text-anthracite-lighter">/ 100</span>
          </div>
          {scoreLevel && <div className={`text-[11px] font-medium mt-1 ${scoreLevel.tone}`}>{scoreLevel.label}</div>}
        </div>
        <div className="card p-5">
          <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter">Frequenza respiratoria</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-serif text-4xl text-anthracite">{num(breathing, 1)}</span>
            <span className="text-xs text-anthracite-lighter">resp/min</span>
          </div>
          <div className="text-[11px] text-anthracite-lighter mt-1">ritmo di respirazione guidato</div>
        </div>
        <div className="card p-5">
          <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter">Frequenza di risonanza</div>
          <div className="flex items-baseline gap-1 mt-1">
            {resonanceHz != null ? (
              <>
                <span className="font-serif text-4xl text-anthracite">{resonanceHz.toFixed(3)}</span>
                <span className="text-xs text-anthracite-lighter">Hz</span>
              </>
            ) : (
              <span className="font-serif text-2xl text-anthracite-lighter">non rilevata</span>
            )}
          </div>
          {resonanceBpm != null && <div className="text-[11px] text-anthracite-lighter mt-1">≈ {resonanceBpm.toFixed(1)} resp/min</div>}
        </div>
        <div className="card p-5">
          <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter">Rapporto inspirazione</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-serif text-4xl text-anthracite">{inhaleRatio != null ? `${Math.round(inhaleRatio * 100)}` : '—'}</span>
            {inhaleRatio != null && <span className="text-xs text-anthracite-lighter">% del ciclo</span>}
          </div>
          <div className="text-[11px] text-anthracite-lighter mt-1">quota inspirazione / espirazione</div>
        </div>
      </section>

      {/* Andamento coerenza nel tempo */}
      <section className="card p-6">
        <h3 className="font-serif text-base text-anthracite mb-1">Andamento della <em className="italic">coerenza</em></h3>
        <p className="text-xs text-anthracite-lighter mb-4">Score di coerenza per finestra temporale durante la sessione</p>
        {seriesData.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-sm text-anthracite-lighter bg-surface rounded-xl">
            Serie temporale non disponibile per questa misurazione
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
                label={{ value: dur > 0 ? 'Tempo (mm:ss)' : 'Finestra', position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6B7280' }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#6B7280"
                fontSize={10}
                label={{ value: 'Coerenza', angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#6B7280' }}
              />
              {score != null && (
                <ReferenceLine y={score} stroke="#8B5CF6" strokeDasharray="4 4" label={{ value: `media ${score.toFixed(0)}`, position: 'right', fontSize: 10, fill: '#6D28D9' }} />
              )}
              <Tooltip
                contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }}
                labelFormatter={(v) => (dur > 0 ? `t = ${formatClock(Number(v))}` : `finestra ${Math.round(Number(v))}`)}
                formatter={(v) => [`${Number(v).toFixed(1)}`, 'Coerenza']}
              />
              <Line type="monotone" dataKey="coherence" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 2.5, fill: '#8B5CF6' }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Spettro PSD con banda di risonanza */}
      <section className="card p-6">
        <h3 className="font-serif text-base text-anthracite mb-1">Spettro frequenze (PSD)</h3>
        <p className="text-xs text-anthracite-lighter mb-3">
          Densità spettrale di potenza · la linea viola indica la frequenza di risonanza rilevata (attesa nella banda LF ~0.1 Hz)
        </p>
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
