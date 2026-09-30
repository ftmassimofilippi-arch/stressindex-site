import { createHmac, timingSafeEqual } from 'node:crypto'

// =============================================================================
// Token firmato per le pagine di stampa (/stampa/...).
// =============================================================================
//
// La route API che genera il PDF apre la pagina di stampa con Chrome headless.
// L'URL porta un token HMAC legato a (tipo, risorsa, utente) con scadenza a
// 60 secondi: senza token, la pagina richiede la sessione del professionista.
// Con il token e senza sessione, la pagina carica i dati con la service_role
// ma solo per il proprietario o un superadmin (vedi print-access.ts).
//
// Segreto: PDF_TOKEN_SECRET, OBBLIGATORIO in produzione (senza, le route
// /api/pdf/* rispondono 500 e loggano il motivo: nessun fallback). Solo fuori
// produzione si accetta un fallback locale derivato dalla service_role.

export type PrintKind = 'measurement' | 'report' | 'monitoring'

export type PrintClaims = {
  kind: PrintKind
  /** Risorsa: sessionId, monitoringId o `${clientId}:${from}:${to}` per il report. */
  id: string
  userId: string
  exp: number // epoch secondi
}

const TTL_SECONDS = 60

export class PrintSecretMissingError extends Error {
  constructor() {
    super('PDF_TOKEN_SECRET mancante: in produzione è obbligatorio per firmare i token delle pagine di stampa')
    this.name = 'PrintSecretMissingError'
  }
}

/** True se il segreto di firma è configurato (o se, fuori produzione, esiste il fallback locale). */
export function printSecretConfigured(): boolean {
  if (process.env.PDF_TOKEN_SECRET) return true
  return process.env.NODE_ENV !== 'production' && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

function secret(): string {
  const configured = process.env.PDF_TOKEN_SECRET
  if (configured) return configured
  if (process.env.NODE_ENV !== 'production' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Solo sviluppo/test: derivazione locale, mai usata in produzione.
    return createHmac('sha256', 'stressindex-print-dev').update(process.env.SUPABASE_SERVICE_ROLE_KEY).digest('hex')
  }
  throw new PrintSecretMissingError()
}

// Token già consumati (monouso): firma → scadenza. Vale per l'istanza corrente
// del server; su più istanze resta comunque il vincolo di scadenza a 60 s e,
// nella via normale, la coincidenza con l'utente della sessione.
const consumed = new Map<string, number>()

function purgeConsumed(now: number) {
  if (consumed.size < 500) return
  for (const [sig, exp] of consumed) if (exp < now) consumed.delete(sig)
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createPrintToken(claims: Omit<PrintClaims, 'exp'>, ttlSeconds = TTL_SECONDS): string {
  const full: PrintClaims = { ...claims, exp: Math.floor(Date.now() / 1000) + ttlSeconds }
  const payload = b64url(JSON.stringify(full))
  return `${payload}.${sign(payload)}`
}

/**
 * Verifica firma, scadenza e monouso; `expected` deve coincidere con tipo e
 * risorsa. Con `consume` (default) il token viene marcato come usato: una
 * seconda verifica dello stesso token fallisce.
 */
export function verifyPrintToken(
  token: string | null | undefined,
  expected: { kind: PrintKind; id: string },
  opts: { consume?: boolean } = {},
): PrintClaims | null {
  if (!token) return null
  let good: string
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  try {
    good = sign(payload)
  } catch (err) {
    console.error('[print-token]', (err as Error).message)
    return null
  }
  const a = Buffer.from(sig)
  const b = Buffer.from(good)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  let claims: PrintClaims
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PrintClaims
  } catch {
    return null
  }
  if (claims.kind !== expected.kind || claims.id !== expected.id) return null
  const now = Math.floor(Date.now() / 1000)
  if (typeof claims.exp !== 'number' || claims.exp < now) return null
  if (!claims.userId) return null
  if (opts.consume !== false) {
    if (consumed.has(sig)) return null
    purgeConsumed(now)
    consumed.set(sig, claims.exp)
  }
  return claims
}
