'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Smartphone, Users } from 'lucide-react'

// Primo passo della registrazione: "Sono un cliente" / "Sono un professionista".
// Il ramo professionista mostra il form (passato dal server come `professional`);
// il ramo cliente NON crea nessun account: spiega di farsi invitare dal proprio
// professionista o di registrarsi dall'app (`client`, anch'esso dal server).
// La scelta vive solo nello stato del componente: nessuna query string, nessun
// cookie.

type Choice = 'professional' | 'client'

export function RegistrationChoice({ professional, client }: { professional: React.ReactNode; client: React.ReactNode }) {
  const t = useTranslations('registration.choice')
  const [choice, setChoice] = useState<Choice | null>(null)

  if (choice === null) {
    const cardClass =
      'card p-6 text-left w-full hover:border-teal hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal'
    return (
      <div>
        <p className="text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider mb-4">{t('question')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button type="button" onClick={() => setChoice('professional')} className={cardClass}>
            <div className="w-10 h-10 rounded-xl bg-teal-light text-teal-dark flex items-center justify-center mb-4">
              <Users size={20} aria-hidden="true" />
            </div>
            <p className="font-semibold text-anthracite text-lg mb-1">{t('professionalTitle')}</p>
            <p className="text-[14.5px] text-anthracite-light leading-relaxed">{t('professionalBody')}</p>
          </button>
          <button type="button" onClick={() => setChoice('client')} className={cardClass}>
            <div className="w-10 h-10 rounded-xl bg-teal-light text-teal-dark flex items-center justify-center mb-4">
              <Smartphone size={20} aria-hidden="true" />
            </div>
            <p className="font-semibold text-anthracite text-lg mb-1">{t('clientTitle')}</p>
            <p className="text-[14.5px] text-anthracite-light leading-relaxed">{t('clientBody')}</p>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setChoice(null)}
        className="text-sm text-teal-dark font-medium hover:underline mb-6 inline-block"
      >
        {t('back')}
      </button>
      {choice === 'professional' ? professional : client}
    </div>
  )
}
