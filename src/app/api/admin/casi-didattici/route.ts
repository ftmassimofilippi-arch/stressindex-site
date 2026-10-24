import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createClient } from '@/lib/supabase-server'
import { trainerPayloadHasForbiddenKeys, type TrainerSharedRow } from '@/lib/trainer-share'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =============================================================================
// Casi didattici: le misurazioni condivise con il formatore, pseudonimizzate.
// =============================================================================
//
// A differenza delle altre route /api/admin/* qui NON si usa la service_role:
// la lettura passa da `trainer_shared_measurements()` con la sessione del
// superadmin, perché è la funzione a decidere che cosa esce (solo condivisioni
// attive, solo colonne di misura, codice caso al posto dell'identità) e a
// scrivere la riga nel registro admin_audit_log. Nessuna lettura diretta delle
// tabelle: il blocco privacy del pannello resta com'è.

export async function GET() {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('trainer_shared_measurements')
  if (error) {
    if (/could not find the function|PGRST202/i.test(error.message)) return apiError('migration_required', 503, { migration: 'sito-051' })
    if (/not_superadmin/.test(error.message)) return apiError('forbidden', 403)
    console.error('[casi-didattici] trainer_shared_measurements', error.message)
    return apiError('generic', 500)
  }
  const rows = (data ?? []) as TrainerSharedRow[]
  // Cintura e bretelle: se una colonna vietata arrivasse dalla funzione, la
  // route non la inoltra e lo segnala.
  const leaked = trainerPayloadHasForbiddenKeys(rows)
  if (leaked) {
    console.error('[casi-didattici] campo vietato nel payload della funzione', leaked)
    return apiError('generic', 500)
  }
  return NextResponse.json({ rows })
}
