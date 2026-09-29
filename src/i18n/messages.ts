import type { Locale } from './routing'

type Messages = Record<string, unknown>

// Caricamento dei file messaggi. Usato dalla request config di next-intl e,
// fuori dall'albero React (route API che generano PDF ed email), da
// `getTranslator` in `src/lib/i18n-server.ts`.
export async function loadMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    case 'en':
      return (await import('../../messages/en.json')).default as Messages
    case 'de':
      return (await import('../../messages/de.json')).default as Messages
    default:
      return (await import('../../messages/it.json')).default as Messages
  }
}
