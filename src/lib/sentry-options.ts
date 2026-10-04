import type { ErrorEvent } from '@sentry/nextjs'

// =============================================================================
// Sentry: opzioni comuni a browser, server Node e middleware
// =============================================================================
//
// La DSN NON sta nel codice: arriva da `NEXT_PUBLIC_SENTRY_DSN` (variabile
// d'ambiente di Vercel). Senza DSN l'SDK resta spento e non parte nessuna
// richiesta: è il caso di `npm run dev` e delle build locali.
//
// `release` e `environment` vengono fissati in `next.config.js` al momento
// della build (commit di Vercel e `VERCEL_ENV`), così browser e server
// dichiarano la stessa versione.
//
// COSA NON DEVE MAI USCIRE (stessa regola dell'app, `docs/regole-progetto.md`
// §2): email, nomi, valori di misurazione. A Sentry vanno tipo dell'errore,
// stack, nome della funzione e uuid dell'utente. Per questo:
//  - `sendDefaultPii: false` (niente IP, cookie, header);
//  - dell'utente resta il solo `id`;
//  - della richiesta resta il solo percorso: la query string porta il token
//    firmato delle pagine di stampa e gli id dei professionisti;
//  - ogni testo libero passa da `senzaEmail`.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

export function senzaEmail(testo: string): string {
  return testo.replace(EMAIL, '[email]')
}

function senzaQuery(url: string): string {
  const i = url.search(/[?#]/)
  return i === -1 ? url : url.slice(0, i)
}

export function pulisciEvento(event: ErrorEvent): ErrorEvent {
  if (event.user) {
    event.user = event.user.id != null ? { id: event.user.id } : undefined
  }
  if (event.request) {
    event.request = {
      method: event.request.method,
      url: event.request.url ? senzaQuery(event.request.url) : undefined,
    }
  }
  if (event.message) event.message = senzaEmail(event.message)
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = senzaEmail(ex.value)
  }
  for (const b of event.breadcrumbs ?? []) {
    if (b.message) b.message = senzaEmail(b.message)
    if (b.data) {
      for (const k of ['url', 'from', 'to'] as const) {
        if (typeof b.data[k] === 'string') b.data[k] = senzaQuery(b.data[k] as string)
      }
    }
  }
  return event
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

export const sentryOptions = {
  dsn,
  enabled: !!dsn,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
  sendDefaultPii: false,
  // Solo diagnostica degli errori: niente tracce di prestazione, niente replay.
  tracesSampleRate: 0,
  beforeSend: pulisciEvento,
}
