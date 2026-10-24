'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { GraduationCap, X } from 'lucide-react'
import { TRAINER_SHARE_BANNER_KEY, TRAINER_SHARE_PATH } from '@/lib/trainer-share'

// Banner discreto in cima alla home: invita chi partecipa al Master HRV a
// condividere qualche misurazione con il formatore. Lo decide il server se
// mostrarlo (flag acceso, nessuna condivisione attiva, non superadmin); qui si
// ricorda solo la chiusura, in localStorage e con try/catch (modalità privata,
// storage bloccato: il banner si rivede e basta).
export function TrainerShareBanner() {
  const t = useTranslations('dashboard.trainerShare.banner')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(TRAINER_SHARE_BANNER_KEY) !== '1')
    } catch {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    setVisible(false)
    try {
      window.localStorage.setItem(TRAINER_SHARE_BANNER_KEY, '1')
    } catch {
      // niente storage: pazienza, si rivedrà alla prossima visita
    }
  }

  if (!visible) return null
  return (
    <div className="mb-6 flex items-center gap-4 flex-wrap px-5 py-3.5 rounded-2xl bg-white border border-surface-border shadow-card">
      <div className="w-9 h-9 rounded-xl bg-teal-light text-teal-dark flex items-center justify-center flex-shrink-0">
        <GraduationCap size={18} />
      </div>
      <p className="min-w-0 flex-1 text-sm text-anthracite">{t('text')}</p>
      <div className="flex items-center gap-2">
        <Link href={TRAINER_SHARE_PATH} className="btn-primary text-sm whitespace-nowrap">
          {t('cta')}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismiss')}
          title={t('dismiss')}
          className="w-9 h-9 rounded-lg hover:bg-surface flex items-center justify-center text-anthracite-lighter hover:text-anthracite transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
