'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDate, num } from '@/lib/format'
import {
  asseAdattivo,
  mediaMobile,
  type AderenzaSettimana,
  type PuntoSessione,
  type ResonanceAssessment,
} from '@/lib/biofeedback'

const TEAL = '#4FA39A'
const TEAL_DARK = '#2E746C'
const SAND = '#C78A2C'
const GREY = '#B8C2CC'

// Aderenza per settimana: barre "fatte" su "attese".
export function AdherenceChart({ aderenze }: { aderenze: AderenzaSettimana[] }) {
  const t = useTranslations('clients.biofeedback.adherence')
  const data = aderenze.map((a) => ({ settimana: t('week', { n: a.settimana }), fatte: a.fatte, attese: a.attese }))
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
        <XAxis dataKey="settimana" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v, name) => [String(v), String(name) === 'fatte' ? t('done') : t('expected')]} />
        <Bar dataKey="attese" fill={GREY} radius={[4, 4, 0, 0]} />
        <Bar dataKey="fatte" fill={TEAL} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Minuti in sintonia per sessione (puntini) con la media mobile, e tempo di
// aggancio: asse adattivo ai dati, niente mediana.
export function TuneChart({ punti }: { punti: PuntoSessione[] }) {
  const t = useTranslations('clients.biofeedback.tune')
  const locale = useLocale()
  const data = useMemo(() => {
    const media = mediaMobile(punti.map((p) => p.minutiSintonia))
    return punti.map((p, i) => ({
      x: p.istante,
      giorno: p.giorno,
      sintonia: Math.round(p.minutiSintonia * 10) / 10,
      media: media[i] == null ? null : Math.round(media[i]! * 10) / 10,
      aggancio: p.aggancio_min == null ? null : Math.round(p.aggancio_min * 10) / 10,
    }))
  }, [punti])
  const dominioSintonia = asseAdattivo(data.map((d) => d.sintonia))
  const dominioAggancio = asseAdattivo(data.map((d) => d.aggancio))
  const fmtData = (v: number) => formatDate(new Date(v), 'd MMM', locale)
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-anthracite-lighter mb-1">{t('minutes')} · {t('movingAverage')}</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
            <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtData} tick={{ fontSize: 11 }} />
            <YAxis domain={dominioSintonia} tick={{ fontSize: 11 }} />
            <Tooltip
              labelFormatter={(v) => formatDate(new Date(Number(v)), undefined, locale)}
              formatter={(v, name) => [v == null || v === '' ? '–' : num(Number(v), 1, locale), String(name) === 'sintonia' ? t('minutes') : t('movingAverage')]}
            />
            <Line dataKey="sintonia" stroke={TEAL} strokeWidth={0} dot={{ r: 4, fill: TEAL, strokeWidth: 0 }} activeDot={{ r: 6 }} isAnimationActive={false} />
            <Line dataKey="media" stroke={TEAL_DARK} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div>
        <div className="text-xs text-anthracite-lighter mb-1">{t('lock')}</div>
        <ResponsiveContainer width="100%" height={160}>
          <ScatterChart margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
            <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtData} tick={{ fontSize: 11 }} />
            <YAxis dataKey="aggancio" domain={dominioAggancio} tick={{ fontSize: 11 }} />
            <Tooltip
              labelFormatter={(v) => formatDate(new Date(Number(v)), undefined, locale)}
              formatter={(v) => [v == null || v === '' ? t('notLocked') : num(Number(v), 1, locale), t('lock')]}
            />
            <Scatter data={data.filter((d) => d.aggancio != null)} fill={SAND} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Ritmo finale della guida per sessione, ritmo assegnato come riferimento e
// le valutazioni Trova il ritmo come puntini.
export function PaceChart({ punti, valutazioni }: { punti: PuntoSessione[]; valutazioni: ResonanceAssessment[] }) {
  const t = useTranslations('clients.biofeedback.pace')
  const locale = useLocale()
  const data = punti.map((p) => ({ x: p.istante, finale: p.ritmo_finale, assegnato: p.ritmo_assegnato }))
  const val = valutazioni
    .filter((v) => (v.ritmo_confermato ?? v.ritmo_suggerito) != null)
    .map((v) => ({ x: new Date(v.iniziata_il).getTime(), ritmo: v.ritmo_confermato ?? v.ritmo_suggerito! }))
  const tutti = [...data.map((d) => d.finale), ...data.map((d) => d.assegnato), ...val.map((v) => v.ritmo)]
  const dominio = asseAdattivo(tutti, { daZero: false })
  const fmtData = (v: number) => formatDate(new Date(v), 'd MMM', locale)
  const assegnato = data.length ? data[data.length - 1].assegnato : null
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
        <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtData} tick={{ fontSize: 11 }} />
        <YAxis domain={dominio} tick={{ fontSize: 11 }} tickFormatter={(v: number) => num(v, 1, locale)} />
        <Tooltip
          labelFormatter={(v) => formatDate(new Date(Number(v)), undefined, locale)}
          formatter={(v, name) => [num(Number(v), 2, locale), String(name) === 'finale' ? t('final') : t('assigned')]}
        />
        {assegnato != null && <ReferenceLine y={assegnato} stroke={GREY} strokeDasharray="4 4" />}
        <Line dataKey="assegnato" stroke={GREY} strokeWidth={1} dot={false} isAnimationActive={false} />
        <Line dataKey="finale" stroke={TEAL_DARK} strokeWidth={2} dot={{ r: 3, fill: TEAL_DARK, strokeWidth: 0 }} isAnimationActive={false} />
        {val.length > 0 && (
          <Scatter data={val} dataKey="ritmo" fill={SAND} shape="diamond" isAnimationActive={false} />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

// La curva di una sessione: livello (1-3) ogni 5 s e score, sul tempo.
export function SessionCurve({ serie }: { serie: { s: number; livello: number | null; score: number | null; stato: string }[] }) {
  const t = useTranslations('clients.biofeedback.sessions')
  const locale = useLocale()
  const data = serie.map((p) => ({ s: p.s, livello: p.stato === 'attivo' ? p.livello : null, score: p.score == null ? null : Math.round(p.score * 100) / 100 }))
  const fmtTempo = (v: number) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}`
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
        <XAxis dataKey="s" type="number" domain={[0, 'dataMax']} tickFormatter={fmtTempo} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="l" domain={[0, 3]} ticks={[1, 2, 3]} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="s" orientation="right" domain={asseAdattivo(data.map((d) => d.score))} tick={{ fontSize: 11 }} />
        <Tooltip
          labelFormatter={(v) => fmtTempo(Number(v))}
          formatter={(v, name) => {
            const n = String(name)
            const testo = v == null || v === '' ? t('paused') : n === 'livello' ? t(`levels.${Number(v)}` as never) : num(Number(v), 2, locale)
            return [testo, n === 'livello' ? t('level') : t('score')]
          }}
        />
        <Line yAxisId="l" dataKey="livello" type="stepAfter" stroke={TEAL} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line yAxisId="s" dataKey="score" stroke={SAND} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
