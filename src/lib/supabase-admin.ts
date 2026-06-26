import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

// Client Supabase con service_role — BYPASSA le RLS. USARE SOLO LATO SERVER,
// mai nel browser (la chiave NON ha il prefisso NEXT_PUBLIC_ apposta).
// Ogni route che lo usa DEVE prima verificare che il chiamante sia il superadmin
// (vedi requireSuperadmin in admin-guard.ts).
let cached: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY mancante: aggiungila in .env.local (Project Settings → API → service_role) per usare il pannello Super Admin.',
    )
  }
  if (cached) return cached
  cached = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}

// True se la service_role key è configurata (per mostrare un messaggio chiaro in UI).
export function hasServiceRole(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY
}
