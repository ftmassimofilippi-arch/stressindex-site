import * as Sentry from '@sentry/nextjs'

// Avvio di Sentry lato server. Su Next 14 serve `experimental.instrumentationHook`,
// che `withSentryConfig` accende da solo in `next.config.js`.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config')
}

// Usato da Next 15 in poi (errori di rendering lato server); su Next 14 viene
// ignorato e gli errori arrivano dall'instrumentazione automatica di Sentry.
export const onRequestError = Sentry.captureRequestError
