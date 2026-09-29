import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { moveClientToProfessional } from '@/lib/admin-links'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/clients/[id]/move — sposta una scheda cliente (e il
// collegamento del suo account) a un altro professionista.
// Body: { professional_id }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const body = await req.json().catch(() => ({}))
  const professionalId = typeof body.professional_id === 'string' ? body.professional_id : ''
  if (!professionalId) return apiError('missing_params', 400)

  const result = await moveClientToProfessional(createAdminClient(), guard.user, { clientId: params.id, targetProfessionalId: professionalId })
  if (!result.ok) return apiError(result.error, result.status, result.params)
  return NextResponse.json(result)
}
