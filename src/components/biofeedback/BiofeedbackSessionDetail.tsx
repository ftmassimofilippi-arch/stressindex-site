'use client'

import { useLocale, useTranslations } from 'next-intl'
import { formatDate, num } from '@/lib/format'
import { istanteLocale, minutiSintonia, minutiTotali, type BiofeedbackSession } from '@/lib/biofeedback'
import { SessionCurve } from './BiofeedbackCharts'

function fmtRitmo(r: number, locale: string): string {
  return num(r, Math.round(r * 10) === r * 10 ? 1 : 2, locale)
}

// Il dettaglio di una sessione: curva ogni 5 s, cambi di ritmo con il
// motivo, umore, sfida e battiti corretti.
export function BiofeedbackSessionDetail({ sessione, onClose }: { sessione: BiofeedbackSession; onClose: () => void }) {
  const t = useTranslations('clients.biofeedback.sessions')
  const locale = useLocale()
  const s = sessione
  const data = formatDate(istanteLocale(s.iniziata_il, s.tz_offset_minutes), 'd MMM yyyy HH:mm', locale)
  const cambi = s.cambi_ritmo
  const pct = s.battiti === 0 ? 0 : (s.artefatti / s.battiti) * 100
  return (
    <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-anthracite">
            {t('row', { date: data, sintonia: Math.round(minutiSintonia(s)), totale: Math.round(minutiTotali(s)) })}
          </div>
          <div className="text-xs text-anthracite-lighter">
            {t('challenge', { n: s.sfida })} · {t('artifacts', { pct: num(pct, 1, locale) })}
            {!s.completata && <> · {t('incomplete')}</>}
            {s.umore_dopo != null && <> · {t('mood', { umore: t(`moods.${s.umore_dopo}` as never) })}</>}
          </div>
        </div>
        <button type="button" className="text-sm text-teal-dark hover:underline" onClick={onClose}>{t('close')}</button>
      </div>
      <div>
        <div className="text-xs text-anthracite-lighter mb-1">{t('curve')}</div>
        {s.serie.length > 0 ? <SessionCurve serie={s.serie} /> : <p className="text-sm text-anthracite-lighter">–</p>}
      </div>
      <div>
        <div className="text-xs text-anthracite-lighter mb-1">{t('changes')}</div>
        {cambi.length === 0 ? (
          <p className="text-sm text-anthracite-lighter">{t('noChanges')}</p>
        ) : (
          <ul className="text-sm text-anthracite space-y-0.5">
            {cambi.map((c, i) => (
              <li key={i}>
                {t('change', {
                  s: Math.round(c.s),
                  da: fmtRitmo(c.da, locale),
                  a: fmtRitmo(c.a, locale),
                  motivo: t(`reasons.${c.motivo}` as never),
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
