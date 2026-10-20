'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatDate, num } from '@/lib/format'
import {
  aderenzaPerSettimana,
  celleCalendario,
  confrontoPeriodi,
  guidaControIlLimite,
  istanteLocale,
  minutiSintonia,
  minutiTotali,
  puntiSessioni,
  type BiofeedbackScheda,
  type BiofeedbackSession,
} from '@/lib/biofeedback'
import { AdherenceChart, PaceChart, TuneChart } from '@/components/biofeedback/BiofeedbackCharts'
import { BiofeedbackCalendar } from '@/components/biofeedback/BiofeedbackCalendar'
import { BiofeedbackSessionDetail } from '@/components/biofeedback/BiofeedbackSessionDetail'

function oggiChiave(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtRitmo(r: number, locale: string): string {
  return num(r, Math.round(r * 10) === r * 10 ? 1 : 2, locale)
}

// Tab "Biofeedback" della scheda cliente: sola lettura, perimetro esplicito
// (i dati arrivano già filtrati dal server). Aderenza per settimana,
// calendario, minuti in sintonia e aggancio nel tempo, ritmo e valutazioni,
// dettaglio di una sessione, avviso quando la guida resta contro un limite.
export function BiofeedbackTab({ dati }: { dati: BiofeedbackScheda }) {
  const t = useTranslations('clients.biofeedback')
  const locale = useLocale()
  const [aperta, setAperta] = useState<string | null>(null)
  const oggi = useMemo(oggiChiave, [])
  const sessioni = dati.sessioni
  const assegnazione = useMemo(
    () => [...dati.assegnazioni].sort((a, b) => b.inizio.localeCompare(a.inizio)).find((a) => a.stato === 'attivo' || a.stato === 'sospeso') ?? dati.assegnazioni[0] ?? null,
    [dati.assegnazioni],
  )
  const aderenze = useMemo(() => (assegnazione && assegnazione.percorso !== 'pratica_libera' ? aderenzaPerSettimana(assegnazione, sessioni, oggi) : []), [assegnazione, sessioni, oggi])
  const celle = useMemo(() => celleCalendario(sessioni, oggi), [sessioni, oggi])
  const punti = useMemo(() => puntiSessioni(sessioni), [sessioni])
  const confronto = useMemo(() => confrontoPeriodi(sessioni, minutiSintonia, oggi), [sessioni, oggi])
  const limite = useMemo(() => guidaControIlLimite(sessioni), [sessioni])

  if (dati.tabelleAssenti) {
    return <p className="text-sm text-anthracite-lighter">{t('tablesMissing')}</p>
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-anthracite-lighter">{t('perimeter')}</p>

      {limite && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-anthracite">
          {t('warning.limit', { verso: limite.verso === 'su' ? t('warning.up') : t('warning.down') })}
        </div>
      )}

      <section className="card p-4 space-y-3">
        <h3 className="font-medium text-anthracite">{t('path.title')}</h3>
        {assegnazione ? (
          <p className="text-sm text-anthracite">
            {t('path.active', {
              nome: t(`path.names.${assegnazione.percorso}` as never),
              rate: fmtRitmo(assegnazione.ritmo, locale),
              date: formatDate(assegnazione.inizio, undefined, locale),
              stato: t(`path.states.${assegnazione.stato}` as never),
            })}
          </p>
        ) : (
          <p className="text-sm text-anthracite-lighter">{t('path.none')}</p>
        )}
        {assegnazione && assegnazione.percorso === 'pratica_libera' && <p className="text-xs text-anthracite-lighter">{t('adherence.free')}</p>}
        {aderenze.length > 0 && (
          <div>
            <div className="text-xs text-anthracite-lighter mb-1">{t('adherence.title')}</div>
            <AdherenceChart aderenze={aderenze} />
          </div>
        )}
      </section>

      {sessioni.length === 0 ? (
        <p className="text-sm text-anthracite-lighter">{t('empty')}</p>
      ) : (
        <>
          <section className="card p-4 space-y-3">
            <h3 className="font-medium text-anthracite">{t('calendar.title')}</h3>
            <BiofeedbackCalendar celle={celle} oggi={oggi} />
          </section>

          <section className="card p-4 space-y-3">
            <h3 className="font-medium text-anthracite">{t('tune.title')}</h3>
            <p className="text-sm text-anthracite">
              {confronto.deltaPct == null
                ? t('tune.compareNA')
                : t('tune.compare', { delta: `${confronto.deltaPct > 0 ? '+' : ''}${num(confronto.deltaPct, 0, locale)}%` })}
              <span className="text-anthracite-lighter"> · {t('tune.counts', { n: confronto.sessioniRecenti, m: confronto.sessioniPrecedenti })}</span>
            </p>
            <TuneChart punti={punti} />
          </section>

          <section className="card p-4 space-y-3">
            <h3 className="font-medium text-anthracite">{t('pace.title')}</h3>
            <p className="text-xs text-anthracite-lighter">{t('pace.final')} · {t('pace.assigned')} · {t('pace.unit')}</p>
            <PaceChart punti={punti} valutazioni={dati.valutazioni} />
          </section>
        </>
      )}

      <section className="card p-4 space-y-2">
        <h3 className="font-medium text-anthracite">{t('pace.assessmentsTitle')}</h3>
        {dati.valutazioni.length === 0 ? (
          <p className="text-sm text-anthracite-lighter">{t('pace.none')}</p>
        ) : (
          <ul className="text-sm text-anthracite space-y-1">
            {dati.valutazioni.map((v) => {
              const data = formatDate(istanteLocale(v.iniziata_il, v.tz_offset_minutes), undefined, locale)
              const sugg = v.ritmo_suggerito
              const voti = sugg == null ? 0 : Object.values(v.voti).filter((x) => x != null && Math.abs(x - sugg) < 1e-9).length
              return (
                <li key={v.id}>
                  {sugg == null
                    ? `${data} · ${t('pace.noSuggestion')}`
                    : t('pace.assessmentRow', { date: data, rate: fmtRitmo(sugg, locale), voti, totale: v.voti_validi })}
                  {v.ritmo_confermato != null && v.ritmo_confermato !== sugg && <> · {t('pace.confirmed', { rate: fmtRitmo(v.ritmo_confermato, locale) })}</>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {sessioni.length > 0 && (
        <section className="card p-4 space-y-2">
          <h3 className="font-medium text-anthracite">{t('sessions.title')}</h3>
          <ul className="divide-y divide-surface-border">
            {sessioni.map((s: BiofeedbackSession) => (
              <li key={s.id} className="py-2">
                {aperta === s.id ? (
                  <BiofeedbackSessionDetail sessione={s} onClose={() => setAperta(null)} />
                ) : (
                  <button type="button" className="w-full text-left text-sm text-anthracite hover:text-teal-dark" onClick={() => setAperta(s.id)}>
                    {t('sessions.row', {
                      date: formatDate(istanteLocale(s.iniziata_il, s.tz_offset_minutes), 'd MMM yyyy HH:mm', locale),
                      sintonia: Math.round(minutiSintonia(s)),
                      totale: Math.round(minutiTotali(s)),
                    })}
                    {!s.completata && <span className="text-anthracite-lighter"> · {t('sessions.incomplete')}</span>}
                    {s.umore_dopo != null && <span className="text-anthracite-lighter"> · {t(`sessions.moods.${s.umore_dopo}` as never)}</span>}
                    <span className="ml-2 text-xs text-teal-dark">{t('sessions.detail')}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
