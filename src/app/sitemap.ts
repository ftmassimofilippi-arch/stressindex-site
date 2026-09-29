import { MetadataRoute } from 'next'
import { locales } from '@/i18n/routing'
import { absoluteUrl } from '@/lib/seo'

// Pagine pubbliche, senza prefisso di lingua. Ogni voce esce in tre lingue con
// gli hreflang alternativi (x-default = italiano).
const PAGES: { path: string; changeFrequency: 'weekly' | 'monthly'; priority: number }[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/funzionalita', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/sport', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/guide', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/supporto', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/registrazione', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/area-professionisti/login', changeFrequency: 'monthly', priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return PAGES.flatMap((page) => {
    const languages: Record<string, string> = {}
    for (const l of locales) languages[l] = absoluteUrl(page.path, l)
    languages['x-default'] = absoluteUrl(page.path, 'it')
    return locales.map((locale) => ({
      url: absoluteUrl(page.path, locale),
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: locale === 'it' ? page.priority : Math.round(page.priority * 0.9 * 100) / 100,
      alternates: { languages },
    }))
  })
}
