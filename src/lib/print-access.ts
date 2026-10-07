import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyPrintToken, type PrintKind } from '@/lib/print-token'
import { SUPERADMIN_VEDE_DATI_CLIENTI } from '@/lib/superadmin-scope'

// =============================================================================
// Chi può vedere una pagina di stampa.
// =============================================================================
//
// 1. Sessione del professionista (cookie): il client Supabase è quello
//    dell'utente. È la via usata dalla route PDF, che inoltra i cookie della
//    richiesta a Chrome headless.
// 2. Solo token firmato (nessuna sessione): client con service_role.
//
// In ENTRAMBE le vie la pagina verifica poi che l'utente sia il titolare della
// scheda (`assertOwnerOrSuperadmin`). La RLS non basta nemmeno nella prima: a
// un superadmin concede le schede di tutti, e la stampa di un cliente altrui
// usciva con un id nell'URL.

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

/**
 * Diritto di stampa: il titolare della scheda. Il superadmin passa solo quando
 * il consenso del cliente verso il Super Admin esiste (superadmin-scope.ts):
 * oggi no, quindi stampa le proprie schede come ogni professionista.
 */
export async function assertOwnerOrSuperadmin(admin: SupabaseClient, userId: string, ownerId: string | null | undefined): Promise<boolean> {
  if (ownerId && ownerId === userId) return true
  if (!SUPERADMIN_VEDE_DATI_CLIENTI) return false
  const { data } = await admin.from('profiles').select('is_superadmin').eq('id', userId).maybeSingle<{ is_superadmin: boolean | null }>()
  return !!data?.is_superadmin
}
