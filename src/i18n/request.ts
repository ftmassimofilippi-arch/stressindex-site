import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'
import { loadMessages } from './messages'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: 'Europe/Rome',
    // Una chiave mancante non deve far cadere la pagina: in sviluppo si vede
    // la chiave, in produzione si logga e si mostra la chiave.
    onError(error) {
      if (process.env.NODE_ENV !== 'production') console.error(error)
    },
    getMessageFallback({ namespace, key }) {
      return namespace ? `${namespace}.${key}` : key
    },
  }
})
