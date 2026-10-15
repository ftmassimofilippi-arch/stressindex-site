import { useTranslations } from 'next-intl'
import { SPORT_MIN_DURATION_S } from '@/lib/sport-rules'

// Badge per le sessioni sport sotto i 5 minuti: restano nell'elenco ma non
// entrano in statistiche e grafici (src/lib/sport-rules.ts).
export function SportTooShortBadge() {
  const t = useTranslations('sport.sessions')
  return (
    <span
      className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-surface text-anthracite-lighter border border-surface-border whitespace-nowrap"
      title={t('tooShortHint', { minutes: SPORT_MIN_DURATION_S / 60 })}
    >
      {t('tooShortBadge')}
    </span>
  )
}
