import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase-server'
import { getRequestLocale } from '@/lib/i18n-server'
import { trainerConsentHash, trainerShareCandidates } from '@/lib/trainer-share-server'
import { normalizeClientIds, type TrainerShare } from '@/lib/trainer-share'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =============================================================================
// Condivisione con il formatore: il professionista loggato sceglie, condivide,
// revoca. Tutto passa dalle funzioni della sito-051 con la sessione dell'utente:
// la proprietà dei clienti e il consenso li controlla il database. Il codice
// del consenso (sha256 del testo mostrato) lo calcola il server, non il browser.
// =============================================================================

// Codici delle eccezioni delle funzioni SQL → codici API (errors.api.*).
function rpcErrorCode(message: string): { code: string; status: number } {
  if (/trainer_share_client_not_owned/.test(message)) return { code: 'trainer_share_client_not_owned', status: 403 }
  if (/trainer_share_not_found/.test(message)) return { code: 'trainer_share_not_found', status: 404 }
  if (/trainer_share_missing_consent/.test(message)) return { code: 'trainer_share_missing_consent', status: 400 }
  if (/not_authenticated/.test(message)) return { code: 'unauthorized', status: 401 }
  if (/could not find the function|PGRST202/i.test(message)) return { code: 'migration_required', status: 503 }
  return { code: 'generic', status: 500 }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('unauthorized', 401)
  const { rows, error } = await trainerShareCandidates()
  if (error) {
    const e = rpcErrorCode(error)
    return apiError(e.code, e.status, e.code === 'migration_required' ? { migration: 'sito-051' } : { detail: error })
  }
  return NextResponse.json({ candidates: rows })
}

/** Condivide i soggetti scelti. Body: `{ clientIds: (string | null)[], consent: true }`. */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('unauthorized', 401)

  const body = await req.json().catch(() => null) as { clientIds?: unknown; consent?: unknown } | null
  const clientIds = normalizeClientIds(body?.clientIds)
  if (!clientIds || clientIds.length === 0) return apiError('invalid_body', 400)
  if (body?.consent !== true) return apiError('trainer_share_missing_consent', 400)

  const lang = await getRequestLocale(req)
  const sha = await trainerConsentHash(lang)

  const shares: TrainerShare[] = []
  for (const clientId of clientIds) {
    const { data, error } = await supabase.rpc('trainer_share_grant', {
      p_client_id: clientId,
      p_text_sha256: sha,
      p_text_lang: lang,
    })
    if (error) {
      const e = rpcErrorCode(error.message)
      // Quelle già fatte restano: si dice al chiamante dove si è fermato.
      return apiError(e.code, e.status, { done: shares.length, failedClientId: clientId })
    }
    shares.push(data as TrainerShare)
  }
  return NextResponse.json({ ok: true, shares })
}

/** Revoca una condivisione. Body: `{ shareId: string }`. */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('unauthorized', 401)

  const body = await req.json().catch(() => null) as { shareId?: unknown } | null
  const shareId = typeof body?.shareId === 'string' ? body.shareId.trim() : ''
  if (!/^[0-9a-f-]{36}$/i.test(shareId)) return apiError('invalid_body', 400)

  const { data, error } = await supabase.rpc('trainer_share_revoke', { p_share_id: shareId })
  if (error) {
    const e = rpcErrorCode(error.message)
    return apiError(e.code, e.status)
  }
  return NextResponse.json({ ok: true, share: data as TrainerShare })
}
