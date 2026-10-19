import { getTranslations } from 'next-intl/server'
import { AppStoreButtons } from '@/components/AppStoreButtons'

// Ramo "Sono un cliente" della registrazione: nessun account creato dal sito.
// Prima opzione: farsi invitare dal proprio professionista (link email, poi
// /imposta-password). Seconda: registrarsi direttamente dall'app.
export async function ClientBranch() {
  const t = await getTranslations('registration.choice')
  return (
    <div className="card p-6 sm:p-8 space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-anthracite tracking-tight mb-2">{t('clientHeading')}</h2>
        <p className="text-anthracite-light leading-relaxed">{t('clientIntro')}</p>
      </div>

      <div className="space-y-5">
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center text-sm font-semibold">1</div>
          <div className="min-w-0">
            <p className="font-semibold text-anthracite mb-1">{t('clientOption1Title')}</p>
            <p className="text-[15px] text-anthracite-light leading-relaxed">{t('clientOption1Body')}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center text-sm font-semibold">2</div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-anthracite mb-1">{t('clientOption2Title')}</p>
            <p className="text-[15px] text-anthracite-light leading-relaxed">{t('clientOption2Body')}</p>
            <AppStoreButtons className="mt-3" />
          </div>
        </div>
      </div>
    </div>
  )
}
