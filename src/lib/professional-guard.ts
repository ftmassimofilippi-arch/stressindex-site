import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient } from './supabase-server'
import { resolveClientUserId } from './collegamenti'

// =============================================================================
// Guardie per le route che agiscono a nome di un PROFESSIONISTA
// =============================================================================
//
// Le route in /api/admin/* usano requireSuperadmin (admin-guard.ts). Queste
// servono alle route che un professionista normale chiama sui PROPRI clienti e
// che hanno comunque bisogno della service_role (creare un utente auth,
// impostare una password, generare un link di recupero).
//
// Due livelli, da usare sempre in quest'ordine:
//
//   const guard = await requireProfessional()
//   if (guard.error) return guard.error
//   const scope = await requireClientScope(admin, guard.user.id, clientId)
//   if (scope.error) return scope.error
//
// Niente di ciò che arriva dal browser viene creduto: il professionista è
// quello del cookie di sessione (o del JWT nell'header Authorization, per l'app
// Flutter), e la scheda cliente deve risultare sua leggendo il database.

export type ProfessionalGuard =
  | { error: NextResponse; user: null; isSuperadmin: false }
  | { error: null; user: User; isSuperadmin: boolean }

/**
 * `Authorization: Bearer <jwt>`, se c'è. Header vuoto o malformato → null, così
 * si ricade sul cookie invece di rifiutare la richiesta.
 */
function bearerToken(req?: Request | null): string | null {
  const raw = req?.headers.get('authorization')
  if (!raw) return null
  const token = /^Bearer\s+(\S+)$/i.exec(raw.trim())?.[1] ?? ''
  return token || null
}

/**
 * Client anon che parla a nome del portatore del JWT: l'header viaggia su ogni
 * query, quindi le RLS valgono come per il client a cookie. La chiave usata è
 * l'anon, non la service_role: un token scaduto o falso non ottiene nulla.
 */
function createBearerClient(token: string): SupabaseClient {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  )
}

/**
 * Autenticato E profiles.role = 'professional'.
 *
 * Con `req` la route accetta anche `Authorization: Bearer <access token
 * Supabase>` (è così che chiama l'app Flutter, che non ha il cookie di sessione
 * Next). Il token non viene decodificato qui: `getUser(token)` lo fa verificare
 * a Supabase Auth, quindi una firma sbagliata o scaduta è un 401 e basta. Da
 * lì in avanti le regole sono le stesse per entrambe le vie, perché a decidere
 * è sempre e solo lo `user.id` che torna dalla verifica.
 */
export async function requireProfessional(req?: Request | null): Promise<ProfessionalGuard> {
  const token = bearerToken(req)
  const supabase = token ? createBearerClient(token) : await createClient()
  const {
    data: { user },
  } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }), user: null, isSuperadmin: false }
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('role, is_superadmin')
    .eq('id', user.id)
    .maybeSingle()
  const row = (data ?? null) as { role?: string | null; is_superadmin?: boolean } | null
  if (error || row?.role !== 'professional') {
    return {
      error: NextResponse.json({ error: 'forbidden', message: 'Serve un account professionista.' }, { status: 403 }),
      user: null,
      isSuperadmin: false,
    }
  }
  return { error: null, user, isSuperadmin: !!row.is_superadmin }
}

export type ClientScope = {
  /** Scheda CRM (clients.id, TEXT). */
  clientId: string
  /** Account app del cliente, se esiste. */
  clientUserId: string | null
  /** Email dell'account app, o quella della scheda. */
  email: string | null
  nome: string | null
  cognome: string | null
  /** true se esiste un link `active` fra questo professionista e l'account. */
  linkActive: boolean
}

export type ClientScopeResult =
  | { error: NextResponse; scope: null }
  | { error: null; scope: ClientScope }

/**
 * La scheda cliente appartiene davvero a questo professionista?
 *
 * Con `requireActiveLink` si pretende anche un collegamento `active` con
 * l'account app: è la condizione per toccare il mezzo di accesso di un cliente
 * che l'account lo ha già. Senza quel vincolo un professionista che ha (o ha
 * avuto) una scheda con la stessa email potrebbe agire su un account non suo.
 *
 * Risponde sempre 403 e non 404: a chi non è autorizzato non si dice nemmeno se
 * quella scheda esiste.
 */
export async function requireClientScope(
  admin: SupabaseClient,
  professionalId: string,
  clientId: string,
  opts: { requireActiveLink?: boolean } = {},
): Promise<ClientScopeResult> {
  const vietato = (message: string) => ({
    error: NextResponse.json({ error: 'forbidden', message }, { status: 403 }),
    scope: null as null,
  })

  if (!clientId) return vietato('Scheda cliente non indicata.')

  const { data, error } = await admin
    .from('clients')
    .select('id, professionista_id, email, nome, cognome, client_user_id, merged_into_client_id')
    .eq('id', clientId)
    .maybeSingle()
  if (error) {
    return {
      error: NextResponse.json({ error: 'client_read_failed', message: error.message }, { status: 500 }),
      scope: null,
    }
  }
  const card = (data ?? null) as {
    id: string
    professionista_id: string | null
    email: string | null
    nome: string | null
    cognome: string | null
    client_user_id: string | null
    merged_into_client_id: string | null
  } | null

  if (!card || card.professionista_id !== professionalId) {
    return vietato('Questa scheda cliente non è tua.')
  }
  if (card.merged_into_client_id) {
    return vietato('Questa scheda è stata unita a un\'altra: agisci su quella.')
  }

  const clientUserId = await resolveClientUserId(admin, {
    client_user_id: card.client_user_id,
    email: card.email,
  })

  let linkActive = false
  if (clientUserId) {
    const { data: link } = await admin
      .from('client_professional_links')
      .select('id')
      .eq('professional_id', professionalId)
      .eq('client_user_id', clientUserId)
      .eq('status', 'active')
      .limit(1)
    linkActive = (link ?? []).length > 0
  }

  if (opts.requireActiveLink && !linkActive) {
    return vietato(
      clientUserId
        ? 'Non hai un collegamento attivo con l\'account di questo cliente.'
        : 'Questo cliente non ha ancora un account app.',
    )
  }

  return {
    error: null,
    scope: {
      clientId: card.id,
      clientUserId,
      email: (card.email ?? '').trim().toLowerCase() || null,
      nome: card.nome,
      cognome: card.cognome,
      linkActive,
    },
  }
}
