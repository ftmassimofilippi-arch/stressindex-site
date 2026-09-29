'use client'

import { useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { usePathname, useRouter } from '@/i18n/navigation'
import { locales, type Locale } from '@/i18n/routing'

const LABELS: Record<Locale, string> = { it: 'IT', en: 'EN', de: 'DE' }
const NAMES: Record<Locale, string> = { it: 'Italiano', en: 'English', de: 'Deutsch' }

// Switcher discreto IT / EN / DE. Mantiene la pagina corrente (query compresa);
// next-intl aggiorna il cookie NEXT_LOCALE al cambio.
export function LanguageSwitcher({ className = '', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  function change(next: Locale) {
    if (next === locale) return
    const query = searchParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { locale: next })
    router.refresh()
  }

  const base = tone === 'dark' ? 'text-white/60 hover:text-white' : 'text-anthracite-lighter hover:text-anthracite'
  const active = tone === 'dark' ? 'text-white' : 'text-anthracite'

  return (
    <div
      className={`inline-flex items-center text-[11px] font-semibold tracking-wider whitespace-nowrap ${className}`}
      role="group"
      aria-label="Language"
    >
      {locales.map((l, i) => (
        <span key={l} className="inline-flex items-center">
          {i > 0 && <span className={`mx-0.5 ${tone === 'dark' ? 'text-white/30' : 'text-gray-300'}`} aria-hidden="true">/</span>}
          <button
            type="button"
            lang={l}
            aria-label={NAMES[l]}
            aria-current={l === locale ? 'true' : undefined}
            onClick={() => change(l)}
            className={`px-1 py-0.5 rounded transition-colors ${l === locale ? active : base}`}
          >
            {LABELS[l]}
          </button>
        </span>
      ))}
    </div>
  )
}
