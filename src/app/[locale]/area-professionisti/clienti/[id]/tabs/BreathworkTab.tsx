'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatDate, num } from '@/lib/format'
import { istanteLocale, type BiofeedbackScheda } from '@/lib/biofeedback'
import {
  aderenza4Settimane,
  aderenzaPerSettimane,
  aderenzaSettimana,
  nomeEsercizio,
  type AttivitaProgramma,
  type BreathworkScheda,
  type BreathworkSession,
} from '@/lib/breathwork'
import { BiofeedbackTab } from './BiofeedbackTab'

function oggiChiave(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const NOMI_PERCORSO = ['fondamenti', 'ripresa_veloce', 'pratica_libera'] as const

// Tab "Breathwork" della scheda cliente: sola lettura, perimetro esplicito
// (i dati arrivano già filtrati dal server). Programma attivo con
// l'aderenza (settimana e ultime quattro), sessioni degli esercizi (con FC
// e RMSSD se c'era la fascia), poi il Biofeedback com'era.
export function BreathworkTab({ dati, biofeedback }: { dati: BreathworkScheda; biofeedback: BiofeedbackScheda }) {
  const t = useTranslations('clients.breathwork')
  const tBf = useTranslations('clients.biofeedback')
  const locale = useLocale()
  const oggi = useMemo(oggiChiave, [])
  const [aperta, setAperta] = useState<string | null>(null)
  const attivita = useMemo(
    () => [...dati.attivita].filter((a) => a.stato === 'attivo' || a.stato === 'sospeso').sort((a, b) => b.inizio.localeCompare(a.inizio)),
    [dati.attivita],
  )

  const nome = (a: AttivitaProgramma): string => {
    if (a.tipo === 'test_hrv') return t('types.test_hrv')
    if (a.tipo === 'biofeedback_percorso') {
      const p = NOMI_PERCORSO.includes(a.riferimento as never) ? (a.riferimento as (typeof NOMI_PERCORSO)[number]) : 'pratica_libera'
      return `${t('types.biofeedback_percorso')} · ${tBf(`path.names.${p}` as never)}`
    }
    const e = dati.esercizi.find((x) => x.id === a.riferimento)
    return e ? nomeEsercizio(e, locale) : t('types.esercizio_respiro')
  }

  const calendario = (a: AttivitaProgramma): string => {
    if (a.tipo === 'biofeedback_percorso') return t('program.byPath')
    const giorni = a.calendario.giorni.length === 7 ? t('program.everyDay') : t('program.daysPerWeek', { n: a.calendario.giorni.length })
    return t('program.calendar', { giorni, volte: a.calendario.volte_giorno ?? 1 })
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-anthracite-lighter">{t('perimeter')}</p>

      <section className="card p-4 space-y-3">
        <h3 className="font-medium text-anthracite">{t('program.title')}</h3>
        {dati.tabelleAssenti ? (
          <p className="text-sm text-anthracite-lighter">{t('tablesMissing')}</p>
        ) : attivita.length === 0 ? (
          <p className="text-sm text-anthracite-lighter">{t('program.none')}</p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {attivita.map((a) => {
              const c = dati.completamenti.filter((x) => x.attivita_id === a.id)
              const sett = aderenzaSettimana(a, c, oggi)
              const quattro = aderenza4Settimane(a, c, oggi)
              const perSettimana = aderenzaPerSettimane(a, c, oggi, 4)
              return (
                <li key={a.id} className="py-3 space-y-1">
                  <div className="text-sm font-medium text-anthracite">{nome(a)}</div>
                  <div className="text-xs text-anthracite-lighter">
                    {calendario(a)}
                    {a.calendario.orari.length > 0 && <> · {a.calendario.orari.join(', ')}</>}
                    {' · '}
                    {t('program.since', { date: formatDate(a.inizio, undefined, locale) })}
                    {a.settimane != null && <> · {t('program.weeks', { n: a.settimane })}</>}
                    {' · '}
                    {tBf(`path.states.${a.stato}` as never)}
                  </div>
                  <div className="text-sm text-anthracite">
                    {t('program.adherenceWeek', { fatte: sett.fatte, previste: sett.previste })}
                    <span className="text-anthracite-lighter"> · {t('program.adherence4', { fatte: quattro.fatte, previste: quattro.previste })}</span>
                  </div>
                  <div className="flex gap-1" aria-label={t('program.adherenceByWeek')}>
                    {perSettimana.map((w) => (
                      <div
                        key={w.lunedi}
                        title={`${formatDate(w.lunedi, undefined, locale)}: ${w.aderenza.fatte}/${w.aderenza.previste}`}
                        className="h-2 flex-1 rounded-full bg-surface-border overflow-hidden"
                      >
                        <div className="h-2 bg-teal" style={{ width: `${Math.round(w.aderenza.quota * 100)}%` }} />
                      </div>
                    ))}
                  </div>
                  {a.nota_cliente && <div className="text-xs italic text-anthracite-lighter">{a.nota_cliente}</div>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card p-4 space-y-2">
        <h3 className="font-medium text-anthracite">{t('sessions.title')}</h3>
        {dati.tabelleAssenti ? (
          <p className="text-sm text-anthracite-lighter">{t('tablesMissing')}</p>
        ) : dati.sessioni.length === 0 ? (
          <p className="text-sm text-anthracite-lighter">{t('sessions.none')}</p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {dati.sessioni.map((s: BreathworkSession) => (
              <li key={s.id} className="py-2 text-sm text-anthracite">
                <button type="button" className="w-full text-left hover:text-teal-dark" onClick={() => setAperta(aperta === s.id ? null : s.id)}>
                  {t('sessions.row', {
                    date: formatDate(istanteLocale(s.iniziata_il, s.tz_offset_minutes), 'd MMM yyyy HH:mm', locale),
                    nome: s.esercizio_nome,
                    minuti: Math.round(s.durata_s / 60),
                    cicli: s.cicli_completati,
                  })}
                  {s.durata_prevista_s == null && <span className="text-anthracite-lighter"> · {t('sessions.open')}</span>}
                  {!s.completata && <span className="text-anthracite-lighter"> · {tBf('sessions.incomplete')}</span>}
                  {s.con_sensore && s.fc_media != null && <span className="text-anthracite-lighter"> · {t('sessions.hr', { bpm: Math.round(s.fc_media) })}</span>}
                  {s.con_sensore && s.rmssd_ms != null && <span className="text-anthracite-lighter"> · {t('sessions.rmssd', { ms: num(s.rmssd_ms, 1, locale) })}</span>}
                  {s.umore_dopo != null && <span className="text-anthracite-lighter"> · {tBf(`sessions.moods.${s.umore_dopo}` as never)}</span>}
                </button>
                {aperta === s.id && s.con_sensore && (
                  <div className="mt-1 text-xs text-anthracite-lighter space-y-0.5">
                    {s.fc_inizio != null && s.fc_fine != null && <div>{t('sessions.hrStartEnd', { a: Math.round(s.fc_inizio), b: Math.round(s.fc_fine) })}</div>}
                    {s.rmssd_inizio != null && s.rmssd_fine != null && <div>{t('sessions.rmssdStartEnd', { a: num(s.rmssd_inizio, 1, locale), b: num(s.rmssd_fine, 1, locale) })}</div>}
                    <div>{tBf('sessions.artifacts', { pct: s.battiti === 0 ? '0' : num((s.artefatti / s.battiti) * 100, 1, locale) })}</div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-medium text-anthracite">{t('biofeedbackTitle')}</h3>
        <BiofeedbackTab dati={biofeedback} />
      </section>
    </div>
  )
}
