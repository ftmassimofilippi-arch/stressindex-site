import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyPrintToken, type PrintKind } from '@/lib/print-token'

// =============================================================================
// Chi può vedere una pagina di stampa.
// =============================================================================
//
// 1. Sessione del professionista (cookie): il client Supabase è quello
//    dell'utente e la RLS decide cosa può leggere (proprietario, team,
//    superadmin in sola lettura). È la via usata dalla route PDF, che inoltra
//    i cookie della richiesta a Chrome headless.
// 2. Solo token firmato (nessuna sessione): client con service_role, ma la
//    pagina deve poi verificare che l'utente del token sia il proprietario
//    della risorsa o un superadmin (`assertOwnerOrSuperadmin`).

export type PrintAccess =
  | { ok: true; supabase: SupabaseClient; userId: string; viaToken: boolean }
  | { ok: false }

export async function resolvePrintAccess(token: string | null | undefined, expected: { kind: PrintKind; id: string }): Promise<PrintAccess> {
  const claims = verifyPrintToken(token, expected)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    // Con sessione, il token (se presente) deve essere dello stesso utente.
    if (claims && claims.userId !== user.id) return { ok: false }
    return { ok: true, supabase, userId: user.id, viaToken: false }
  }

  if (claims) {
    return { ok: true, supabase: createAdminClient() as unknown as SupabaseClient, userId: claims.userId, viaToken: true }
  }
  return { ok: false }
}

/** Nella via "solo token" i dati passano dalla service_role: qui si verifica il diritto di lettura. */
export async function assertOwnerOrSuperadmin(admin: SupabaseClient, userId: string, ownerId: string | null | undefined): Promise<boolean> {
  if (ownerId && ownerId === userId) return true
  const { data } = await admin.from('profiles').select('is_superadmin').eq('id', userId).maybeSingle<{ is_superadmin: boolean | null }>()
  return !!data?.is_superadmin
}
