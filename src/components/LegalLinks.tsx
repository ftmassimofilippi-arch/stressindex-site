import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

// Riquadro in fondo a ogni pagina legale: i documenti del pacchetto 2.1 sono
// collegati fra loro, così chi legge l'informativa trova DPA e fornitori.
const DOCS = [
  { href: '/privacy', key: 'privacySite' },
  { href: '/legal/privacy-app', key: 'privacyApp' },
  { href: '/termini', key: 'terms' },
  { href: '/legal/dpa', key: 'dpa' },
  { href: '/legal/subprocessors', key: 'subprocessors' },
  { href: '/cookie', key: 'cookie' },
] as const

export async function LegalLinks() {
  const t = await getTranslations('legal.links')
  return (
    <nav aria-label={t('title')} className="mt-12 rounded-2xl bg-surface px-6 py-5">
      <h2 className="text-sm font-medium text-anthracite">{t('title')}</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-[15px]">
        {DOCS.map((d) => (
          <li key={d.key}>
            <Link className="text-teal hover:text-teal-dark underline underline-offset-2" href={d.href}>
              {t(d.key)}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-anthracite-lighter leading-relaxed">{t('prevails')}</p>
    </nav>
  )
}
