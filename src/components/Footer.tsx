import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export function Footer() {
  const t = useTranslations('common')
  const currentYear = new Date().getFullYear()

  const links = [
    { href: '/funzionalita', label: t('nav.features') },
    { href: '/sport', label: t('nav.sport') },
    { href: '/guide', label: t('nav.guides') },
    { href: '/supporto', label: t('support') },
    { href: '/privacy', label: t('nav.privacy') },
    { href: '/termini', label: t('nav.terms') },
    { href: '/contatti', label: t('nav.contacts') },
  ]

  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-md bg-teal flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-sm text-anthracite-lighter">
              © {currentYear} {t('brand')} · {t('allRightsReserved')}
            </span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-anthracite-lighter">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-teal transition-colors">
                {l.label}
              </Link>
            ))}
            <Suspense fallback={null}>
              <LanguageSwitcher />
            </Suspense>
          </nav>
        </div>
      </div>
    </footer>
  )
}
