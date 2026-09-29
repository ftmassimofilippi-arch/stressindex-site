import { createTranslator } from 'next-intl'
import { cookies, headers } from 'next/headers'
import { defaultLocale, isLocale, locales, splitLocale, type Locale } from '@/i18n/routing'
import { loadMessages } from '@/i18n/messages'

// =============================================================================
// Lingua e traduzioni FUORI dal segmento [locale]: route API (PDF, CSV, email
// transazionali) e codice server che non passa dal provider next-intl.
// =============================================================================
//
// Ordine di risoluzione, dal più al meno affidabile:
//   1. `?locale=` nella query (link espliciti, es. download PDF);
//   2. cookie NEXT_LOCALE (impostato da next-intl quando l'utente sceglie);
//   3. prefisso di lingua nel Referer (la pagina da cui parte la chiamata);
//   4. Accept-Language;
//   5. italiano.

function fromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null
  const candidates = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=')
      return { tag: tag.toLowerCase().split('-')[0], q: q ? Number(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)
  for (const c of candidates) {
    if (isLocale(c.tag)) return c.tag
  }
  return null
}

function fromReferer(referer: string | null): Locale | null {
  if (!referer) return null
  try {
    const { locale } = splitLocale(new URL(referer).pathname)
    return locale
  } catch {
    return null
  }
}

/** Lingua della richiesta corrente (route handler o server component). */
export async function getRequestLocale(req?: Request | null): Promise<Locale> {
  if (req) {
    const q = new URL(req.url).searchParams.get('locale')
    if (isLocale(q)) return q
  }
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get('NEXT_LOCALE')?.value
  if (isLocale(fromCookie)) return fromCookie

  const h = req?.headers ?? (await headers())
  return fromReferer(h.get('referer')) ?? fromAcceptLanguage(h.get('accept-language')) ?? defaultLocale
}

/** Lingua da un valore libero (es. `user_metadata.locale`), con fallback. */
export function coerceLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale
}

/** Funzione di traduzione "sciolta": chiave e valori di interpolazione. */
export type Translator = {
  (key: string, values?: Record<string, string | number | Date>): string
  has: (key: string) => boolean
  raw: (key: string) => unknown
}

/**
 * Traduttore per un namespace, usabile ovunque (anche in una route API).
 * `const t = await getTranslator(locale, 'pdf'); t('title')`.
 */
export async function getTranslator(locale: Locale, namespace?: string): Promise<Translator> {
  const messages = await loadMessages(locale)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = createTranslator({ locale, messages: messages as any, namespace: namespace as any }) as any
  const fn = ((key: string, values?: Record<string, string | number | Date>) => t(key, values)) as Translator
  fn.has = (key: string) => t.has(key)
  fn.raw = (key: string) => t.raw(key)
  return fn
}

export { locales }
