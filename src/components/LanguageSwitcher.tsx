'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { locales, type Locale } from '@/i18n/routing'

const NAMES: Record<Locale, string> = { it: 'Italiano', en: 'English', de: 'Deutsch' }
const EMOJI: Record<Locale, string> = { it: '🇮🇹', en: '🇬🇧', de: '🇩🇪' }

// Bandierine SVG inline (nessuna libreria, nessuna immagine remota): le emoji
// delle bandiere non si vedono su Windows. L'emoji resta solo come fallback
// testuale per chi non renderizza SVG.
function Flag({ locale, size = 20 }: { locale: Locale; size?: number }) {
  const h = Math.round(size * 0.7)
  const common = { width: size, height: h, viewBox: '0 0 60 42', 'aria-hidden': true as const, focusable: 'false' as const, className: 'block rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]' }
  if (locale === 'it') {
    return (
      <svg {...common}>
        <rect width="20" height="42" fill="#009246" />
        <rect x="20" width="20" height="42" fill="#FFFFFF" />
        <rect x="40" width="20" height="42" fill="#CE2B37" />
      </svg>
    )
  }
  if (locale === 'de') {
    return (
      <svg {...common}>
        <rect width="60" height="14" fill="#000000" />
        <rect y="14" width="60" height="14" fill="#DD0000" />
        <rect y="28" width="60" height="14" fill="#FFCE00" />
      </svg>
    )
  }
  // Union Jack semplificata
  return (
    <svg {...common}>
      <rect width="60" height="42" fill="#012169" />
      <path d="M0 0L60 42M60 0L0 42" stroke="#FFFFFF" strokeWidth="8" />
      <path d="M0 0L60 42M60 0L0 42" stroke="#C8102E" strokeWidth="3" />
      <path d="M30 0V42M0 21H60" stroke="#FFFFFF" strokeWidth="12" />
      <path d="M30 0V42M0 21H60" stroke="#C8102E" strokeWidth="7" />
    </svg>
  )
}

type Props = {
  className?: string
  /** `flags`: tre bandierine affiancate (navbar, header). `text`: bandierina + nome (footer). */
  variant?: 'flags' | 'text'
  tone?: 'light' | 'dark'
}

// Selettore lingua a un solo click: tre bandierine sempre visibili, niente
// menu. Un click cambia lingua restando sulla stessa pagina (path, query e
// ancora); next-intl aggiorna il cookie NEXT_LOCALE al cambio di segmento.
export function LanguageSwitcher({ className = '', variant = 'flags', tone = 'light' }: Props) {
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()

  // Query e ancora si leggono al click da window.location (non da
  // useSearchParams): così il selettore viene reso anche lato server nelle
  // pagine statiche, senza bail-out al client.
  function change(next: Locale) {
    if (next === locale) return
    const { search, hash } = window.location
    router.replace(`${pathname}${search}${hash}`, { locale: next })
  }

  if (variant === 'text') {
    const muted = tone === 'dark' ? 'text-white/70 hover:text-white' : 'text-anthracite-lighter hover:text-anthracite'
    const active = tone === 'dark' ? 'text-white' : 'text-anthracite'
    return (
      <div className={`inline-flex flex-wrap items-center gap-x-1 gap-y-1 text-sm ${className}`} role="group" aria-label="Language">
        {locales.map((l, i) => (
          <span key={l} className="inline-flex items-center">
            {i > 0 && <span className={`mx-2 ${tone === 'dark' ? 'text-white/30' : 'text-gray-300'}`} aria-hidden="true">·</span>}
            <button
              type="button"
              lang={l}
              title={NAMES[l]}
              aria-label={NAMES[l]}
              aria-current={l === locale ? 'true' : undefined}
              onClick={() => change(l)}
              className={`inline-flex items-center gap-1.5 min-h-[40px] px-1 rounded-md transition-colors ${l === locale ? `${active} font-medium` : muted}`}
            >
              <Flag locale={l} size={18} />
              <span>{NAMES[l]}</span>
            </button>
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className={`inline-flex items-center ${className}`} role="group" aria-label="Language">
      {locales.map((l) => {
        const isActive = l === locale
        return (
          <button
            key={l}
            type="button"
            lang={l}
            title={NAMES[l]}
            aria-label={NAMES[l]}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => change(l)}
            className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-opacity ${
              isActive ? 'opacity-100' : 'opacity-50 hover:opacity-90 active:opacity-100'
            }`}
          >
            <span className={`rounded-[3px] ${isActive ? 'ring-2 ring-teal ring-offset-1 ring-offset-white' : ''}`}>
              <Flag locale={l} size={22} />
            </span>
            <span className="sr-only">{EMOJI[l]} {NAMES[l]}</span>
          </button>
        )
      })}
    </div>
  )
}
