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
// Segreto: PDF_TOKEN_SECRET; in mancanza, una derivazione della service_role
// (mai esposta) così il sistema funziona anche senza variabile dedicata.

export type PrintKind = 'measurement' | 'report' | 'monitoring'

export type PrintClaims = {
  kind: PrintKind
  /** Risorsa: sessionId, monitoringId o `${clientId}:${from}:${to}` per il report. */
  id: string
  userId: string
  exp: number // epoch secondi
}

const TTL_SECONDS = 60

function secret(): string {
  const s = process.env.PDF_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!s) throw new Error('PDF_TOKEN_SECRET (o SUPABASE_SERVICE_ROLE_KEY) mancante')
  return createHmac('sha256', 'stressindex-print').update(s).digest('hex')
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

/** Verifica firma e scadenza; `expected` deve coincidere con tipo e risorsa. */
export function verifyPrintToken(token: string | null | undefined, expected: { kind: PrintKind; id: string }): PrintClaims | null {
  if (!token) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const good = sign(payload)
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
  if (typeof claims.exp !== 'number' || claims.exp < Math.floor(Date.now() / 1000)) return null
  if (!claims.userId) return null
  return claims
}
