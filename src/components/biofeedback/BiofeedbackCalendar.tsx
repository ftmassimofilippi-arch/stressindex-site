'use client'

import { useLocale, useTranslations } from 'next-intl'
import { formatDate } from '@/lib/format'
import type { CellaCalendario } from '@/lib/biofeedback'

// Calendario a celle: una per giorno, otto settimane, lunedì a sinistra; il
// colore cresce con i minuti in sintonia, grigio chiaro dove non c'è stata
// nessuna sessione, vuoto nei giorni futuri.
export function BiofeedbackCalendar({ celle, oggi }: { celle: CellaCalendario[]; oggi: string }) {
  const t = useTranslations('clients.biofeedback.calendar')
  const locale = useLocale()
  const max = Math.max(0, ...celle.map((c) => c.minutiSintonia))
  const settimane: CellaCalendario[][] = []
  for (let i = 0; i + 7 <= celle.length; i += 7) settimane.push(celle.slice(i, i + 7))
  return (
    <div>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {settimane.flatMap((s) =>
          s.map((c) => {
            const futuro = c.giorno > oggi
            const intensita = max === 0 ? 0 : c.minutiSintonia / max
            const sfondo = futuro
              ? 'transparent'
              : c.sessioni === 0
                ? '#EEF1F2'
                : `rgba(46, 116, 108, ${0.25 + 0.75 * intensita})`
            return (
              <div
                key={c.giorno}
                title={t('cell', { date: formatDate(c.giorno, undefined, locale), sessioni: c.sessioni, minuti: Math.round(c.minuti), sintonia: Math.round(c.minutiSintonia) })}
                className={`aspect-square rounded-md border text-[10px] flex items-center justify-center ${c.giorno === oggi ? 'border-teal-dark border-2' : 'border-surface-border'}`}
                style={{ background: sfondo, color: intensita > 0.5 ? '#FFFFFF' : '#6B7280' }}
              >
                {Number(c.giorno.slice(8, 10))}
              </div>
            )
          }),
        )}
      </div>
      <p className="mt-2 text-xs text-anthracite-lighter">{t('legend')}</p>
    </div>
  )
}
