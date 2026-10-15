import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { LegalFooter } from '@/components/LegalFooter'

// Unico footer del sito pubblico (home comprese): colonne Prodotto / Supporto /
// Legale e, sotto, la riga legale condivisa (`LegalFooter`). Le ancore della
// home sono link assoluti (`/#prezzi`) così funzionano da qualsiasi pagina.
export function Footer() {
  const t = useTranslations('home.footer')
  const tc = useTranslations('common')
  const linkClass = 'text-anthracite-light hover:text-teal transition-colors'

  return (
    <footer className="bg-white border-t border-gray-100 px-6 pt-16 pb-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-10 md:gap-12">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 group" aria-label={tc('logoAria')}>
              <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-lg font-semibold tracking-tight text-anthracite">{tc('brand')}</span>
            </Link>
            <p className="mt-4 text-[14px] text-anthracite-light leading-relaxed max-w-sm">{t('tagline')}</p>
          </div>

          <div>
            <h3 className="text-[12px] uppercase tracking-wider text-anthracite-lighter font-semibold">{t('product')}</h3>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              <li><Link className={linkClass} href="/#come-funziona">{tc('nav.howItWorks')}</Link></li>
              <li><Link className={linkClass} href="/funzionalita">{tc('nav.features')}</Link></li>
              <li><Link className={linkClass} href="/sport">{tc('nav.sport')}</Link></li>
              <li><Link className={linkClass} href="/#prezzi">{tc('nav.pricing')}</Link></li>
              <li><Link className={linkClass} href="/registrazione">{tc('startFree')}</Link></li>
              <li><Link className={linkClass} href="/area-professionisti/login" prefetch={false}>{tc('proArea')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-[12px] uppercase tracking-wider text-anthracite-lighter font-semibold">{t('support')}</h3>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              <li><Link className={linkClass} href="/guide">{tc('nav.guides')}</Link></li>
              <li><Link className={linkClass} href="/supporto">{tc('support')}</Link></li>
              <li><Link className={linkClass} href="/#faq">{tc('nav.faq')}</Link></li>
              <li><a className={linkClass} href="mailto:support@stressindex.io">{tc('nav.contactUs')}</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-[12px] uppercase tracking-wider text-anthracite-lighter font-semibold">{t('legal')}</h3>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              <li><Link className={linkClass} href="/privacy">{tc('nav.privacyPolicy')}</Link></li>
              <li><Link className={linkClass} href="/termini">{tc('nav.termsOfService')}</Link></li>
              <li><Link className={linkClass} href="/cookie">{tc('nav.cookie')}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100">
          <LegalFooter />
        </div>
      </div>
    </footer>
  )
}
