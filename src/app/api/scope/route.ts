import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { getMyAccountAccess } from '@/lib/account-access'
import { SCOPE_COOKIE, isDataScope, puoCambiareScope } from '@/lib/data-scope'
import { apiError } from '@/lib/api-error'

// Interruttore "i miei dati / tutta la piattaforma" (data-scope.ts). Solo un
// superadmin può scrivere il cookie; per gli altri la lettura ignora comunque
// il valore, quindi qui si risponde 403 senza scrivere nulla.
export async function POST(req: NextRequest) {
  const access = await getMyAccountAccess()
  if (!access.userId) return apiError('unauthorized', 401)
  if (!puoCambiareScope(access.isSuperadmin)) return apiError('forbidden', 403)

  const body = await req.json().catch(() => ({}))
  const scope = (body as { scope?: unknown })?.scope
  if (!isDataScope(scope)) return apiError('invalid_scope', 400)

  const cookieStore = await cookies()
  cookieStore.set(SCOPE_COOKIE, scope, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
  })
  return NextResponse.json({ scope })
}
