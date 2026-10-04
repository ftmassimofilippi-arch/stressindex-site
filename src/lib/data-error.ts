import * as Sentry from '@sentry/nextjs'
import { senzaEmail } from './sentry-options'

// =============================================================================
// Nessun errore muto (stessa regola dell'app, `docs/regole-progetto.md` §2)
// =============================================================================
//
// Una lettura che fallisce non deve diventare una lista vuota: l'utente
// leggerebbe "nessun dato" dove invece c'è un guasto, e a noi non arriverebbe
// niente. Chi legge dal database e riceve `error`:
//
//  - `reportDataError(dove, error)` quando il ripiego resta (il dato mancante è
//    un di più: l'errore va a Sentry, la pagina prosegue);
//  - `throw dataLoadError(dove, error)` quando senza quel dato il risultato
//    sarebbe falso. Le pagine lo raccolgono con `caricaOErrore` e mostrano
//    `DataLoadNotice` al posto della sezione; le stampe lasciano salire
//    l'errore, perché un PDF con un buco non si consegna.
//
// A Sentry vanno il nome della funzione, il codice e il messaggio di Postgres.
// Niente righe, niente parametri della query.

type ErroreDb = { code?: string | null; message?: string | null } | Error | null | undefined

export class DataLoadError extends Error {
  readonly where: string
  readonly code: string | null

  constructor(where: string, error: ErroreDb) {
    const code = error && 'code' in error ? error.code ?? null : null
    super(`${where}: ${senzaEmail(error?.message ?? 'errore sconosciuto')}`)
    this.name = 'DataLoadError'
    this.where = where
    this.code = code
  }
}

/** Manda l'errore a Sentry (e ai log di Vercel) e restituisce l'eccezione da lanciare, se serve. */
export function reportDataError(where: string, error: ErroreDb): DataLoadError {
  const err = error instanceof DataLoadError ? error : new DataLoadError(where, error)
  console.error(`[data-error] ${err.message}`, { code: err.code })
  Sentry.captureException(err, {
    tags: { funzione: where, pg_code: err.code ?? 'n/d' },
    // Un evento per funzione e codice, non uno per messaggio.
    fingerprint: ['data-load-error', where, err.code ?? 'n/d'],
  })
  return err
}

/** Come `reportDataError`, per l'uso in `throw`. */
export function dataLoadError(where: string, error: ErroreDb): DataLoadError {
  return reportDataError(where, error)
}

export type Caricato<T> = { ok: true; data: T } | { ok: false; data: null }

/**
 * Per le pagine: una sezione che non si carica non deve buttare giù tutte le
 * altre. L'errore è già andato a Sentry in `dataLoadError`; qui si raccoglie
 * solo quello, il resto (notFound, redirect, bug) risale com'è.
 */
export async function caricaOErrore<T>(p: Promise<T>): Promise<Caricato<T>> {
  try {
    return { ok: true, data: await p }
  } catch (e) {
    if (e instanceof DataLoadError) return { ok: false, data: null }
    throw e
  }
}
