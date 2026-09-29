import { defineRouting } from 'next-intl/routing'

// Lingue del sito. L'italiano resta senza prefisso (le URL attuali non
// cambiano: sono indicizzate e linkate da email e app); inglese e tedesco
// vivono su /en/... e /de/.... Gli slug delle pagine restano quelli italiani
// in tutte le lingue, per non rompere deep link e redirect Supabase.
export const locales = ['it', 'en', 'de'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'it'

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  // Prima visita: Accept-Language. Poi vale il cookie NEXT_LOCALE, che
  // next-intl aggiorna quando l'utente cambia lingua dallo switcher.
  localeDetection: true,
  localeCookie: {
    name: 'NEXT_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
  },
})

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value)
}

// Separa l'eventuale prefisso di lingua dal percorso: '/en/registrazione' →
// { locale: 'en', path: '/registrazione' }; '/registrazione' → { locale: 'it', ... }.
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const m = /^\/(it|en|de)(?=\/|$)/.exec(pathname)
  if (!m) return { locale: defaultLocale, path: pathname }
  const rest = pathname.slice(m[0].length)
  return { locale: m[1] as Locale, path: rest === '' ? '/' : rest }
}

// Percorso con il prefisso di lingua, secondo la regola "as-needed".
export function withLocale(path: string, locale: Locale): string {
  return locale === defaultLocale ? path : `/${locale}${path === '/' ? '' : path}`
}

// Tag BCP 47 usati per Intl (date, numeri) e per OpenGraph.
export const intlLocale: Record<Locale, string> = {
  it: 'it-IT',
  en: 'en-US',
  de: 'de-DE',
}

export const ogLocale: Record<Locale, string> = {
  it: 'it_IT',
  en: 'en_US',
  de: 'de_DE',
}
