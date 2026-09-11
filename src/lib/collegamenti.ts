import type { SupabaseClient } from '@supabase/supabase-js'

// =============================================================================
// Collegamenti cliente↔professionista: helper condivisi dalle route admin.
// Ogni scrittura di un link passa dalla RPC link_client_to_professional
// (migration 019): nessuna route inserisce più righe in
// client_professional_links o scrive clients.client_user_id direttamente.
// =============================================================================

export type LinkRpcResult = {
  ok: boolean
  error?: string
  sqlstate?: string
  client_id?: string
  card_action?: string
  link_id?: string
  link_status?: string
  action?: string
  merged?: string[]
  warnings?: string[]
  source?: string
}

export type LinkOutcome =
  | { ok: true; result: LinkRpcResult }
  | { ok: false; error: string; status: number; result?: LinkRpcResult }

export async function linkViaRpc(admin: SupabaseClient, clientUserId: string, professionalId: string, source: string): Promise<LinkOutcome> {
  const { data, error } = await admin.rpc('link_client_to_professional', {
    p_client_user_id: clientUserId,
    p_professional_id: professionalId,
    p_source: source,
  })
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      return { ok: false, status: 501, error: 'Applica la migration 019 su Supabase (link_client_to_professional mancante).' }
    }
    return { ok: false, status: 500, error: error.message }
  }
  const result = (data ?? {}) as LinkRpcResult
  if (!result.ok) return { ok: false, status: 422, error: result.error ?? 'collegamento non riuscito', result }
  return { ok: true, result }
}

// Account del cliente a partire da una scheda: ponte esplicito, poi email
// (solo profili client; se ce n'è più d'uno con la stessa email, nessuno).
export async function resolveClientUserId(
  admin: SupabaseClient,
  card: { client_user_id: string | null; email: string | null },
): Promise<string | null> {
  if (card.client_user_id) return card.client_user_id
  const email = (card.email ?? '').trim().toLowerCase()
  if (!email) return null
  const { data } = await admin.from('profiles').select('id, role').ilike('email', email).limit(5)
  const rows = (data ?? []) as Array<{ id: string; role: string | null }>
  const clients = rows.filter((r) => r.role === 'client')
  if (clients.length === 1) return clients[0].id
  if (clients.length === 0 && rows.length === 1) return rows[0].id
  return null
}

// Id scheda nel formato dell'app (epoch millisecondi in TEXT): l'app carica le
// schede filtrando per id numerico e i vecchi id uuid del sito non le
// raggiungevano mai. Se l'id è già preso (due creazioni nello stesso ms) si
// incrementa.
export async function nextClientCardId(admin: SupabaseClient): Promise<string> {
  let id = Date.now()
  for (let i = 0; i < 5; i++) {
    const { data } = await admin.from('clients').select('id').eq('id', String(id)).maybeSingle()
    if (!data) return String(id)
    id += 1
  }
  return String(id)
}
