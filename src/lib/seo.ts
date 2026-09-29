import type { Metadata } from 'next'
import { locales, ogLocale, withLocale, type Locale } from '@/i18n/routing'

export const SITE_URL = 'https://stressindex.io'
export const OG_IMAGE = { url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }

/** URL assoluta di una pagina in una lingua (regola "as-needed"). */
export function absoluteUrl(path: string, locale: Locale): string {
  return `${SITE_URL}${withLocale(path, locale)}`
}

/**
 * `alternates` con canonical e hreflang it/en/de + x-default (italiano).
 * `path` è il percorso SENZA prefisso di lingua, es. '/registrazione'.
 */
export function alternatesFor(path: string, locale: Locale): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = {}
  for (const l of locales) languages[l] = absoluteUrl(path, l)
  languages['x-default'] = absoluteUrl(path, 'it')
  return { canonical: absoluteUrl(path, locale), languages }
}

type PageMeta = {
  locale: Locale
  path: string
  title: string
  description: string
  /** Descrizione breve per Twitter (facoltativa). */
  shortDescription?: string
  index?: boolean
}

/** Metadata completi (title, description, OpenGraph, Twitter, hreflang) di una pagina pubblica. */
export function pageMetadata({ locale, path, title, description, shortDescription, index = true }: PageMeta): Metadata {
  const url = absoluteUrl(path, locale)
  return {
    title,
    description,
    alternates: alternatesFor(path, locale),
    openGraph: {
      title,
      description,
      url,
      siteName: 'Stress Index',
      locale: ogLocale[locale],
      alternateLocale: locales.filter((l) => l !== locale).map((l) => ogLocale[l]),
      type: 'website',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: shortDescription ?? description,
      images: [OG_IMAGE.url],
    },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
  }
}
