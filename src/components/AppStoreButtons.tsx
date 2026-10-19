import { getTranslations } from 'next-intl/server'
import { APP_STORES } from '@/config/company'

// Bottoni "App Store" / "Google Play" con i link di `APP_STORES`
// (`src/config/company.ts`). Un bottone compare solo se il link esiste: senza
// link App Store resta Google Play e, se `iphoneNote` è true, la riga che dice
// di chiedere il link al proprio professionista.

const buttonClass =
  'inline-flex items-center gap-2 px-4 py-2.5 bg-anthracite text-white rounded-lg text-sm font-medium hover:bg-anthracite-light transition-colors'

export async function AppStoreButtons({ iphoneNote = true, className = '' }: { iphoneNote?: boolean; className?: string }) {
  const t = await getTranslations('appClient.stores')
  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        {APP_STORES.ios && (
          <a href={APP_STORES.ios} target="_blank" rel="noopener noreferrer" className={buttonClass}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            {t('appStore')}
          </a>
        )}
        {APP_STORES.android && (
          <a href={APP_STORES.android} target="_blank" rel="noopener noreferrer" className={buttonClass}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 010 1.38l-2.302 2.302L15.396 12l2.302-3.492zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z"/>
            </svg>
            {t('googlePlay')}
          </a>
        )}
      </div>
      {!APP_STORES.ios && iphoneNote && (
        <p className="mt-3 text-sm text-anthracite-lighter">{t('iphoneAsk')}</p>
      )}
    </div>
  )
}
