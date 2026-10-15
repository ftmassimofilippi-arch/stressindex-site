import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireSuperadmin } from '@/lib/admin-guard'
import { getAdminClientDuplicates } from '@/lib/admin-data'
import { reportDataError } from '@/lib/data-error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/clients/duplicates — gruppi di schede `clients` non unite con
// stesso (nome, cognome, data di nascita) o stessa email, anche fra
// professionisti diversi. Solo lettura: l'unione passa da /api/admin/clients/merge.
// Nessun errore muto: un guasto risponde 500 con un codice, mai 200 con lista vuota.
export async function GET() {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  try {
    const groups = await getAdminClientDuplicates()
    return NextResponse.json({ groups, total: groups.length })
  } catch (e) {
    const err = reportDataError('api/admin/clients/duplicates', e instanceof Error ? e : { message: String(e) })
    return apiError('generic', 500, { detail: err.message })
  }
}
