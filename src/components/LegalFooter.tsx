import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { COMPANY } from '@/config/company'

// Riga legale comune a tutti i footer del sito: ragione sociale, indirizzo e
// partita IVA (da `src/config/company.ts`, unica fonte), copyright, link alle
// pagine legali e selettore lingua. Server component: niente stato.
export function LegalFooter() {
  const t = useTranslations('common')
  const tf = useTranslations('home.footer')
  const currentYear = new Date().getFullYear()

  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 text-[13px] text-anthracite-lighter">
      <div className="leading-relaxed">
        <div className="font-medium text-anthracite-light">{COMPANY.legalName}</div>
        <div>{COMPANY.address}</div>
        <div>{tf('vat', { vat: COMPANY.vat })}</div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 md:justify-end">
        <span>
          © {currentYear} {COMPANY.legalName} · {t('allRightsReserved')}
        </span>
        <Link className="hover:text-teal transition-colors" href="/privacy">
          {t('nav.privacy')}
        </Link>
        <Link className="hover:text-teal transition-colors" href="/termini">
          {t('nav.terms')}
        </Link>
        <Link className="hover:text-teal transition-colors" href="/cookie">
          {t('nav.cookie')}
        </Link>
        <Suspense fallback={null}>
          <LanguageSwitcher variant="text" />
        </Suspense>
      </div>
    </div>
  )
}
