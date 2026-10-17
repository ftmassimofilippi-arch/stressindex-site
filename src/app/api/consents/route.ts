import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { apiError } from '@/lib/api-error'
import { locales, type Locale } from '@/i18n/routing'
import { EMPTY_PRO_CONSENTS, PRO_OPTIONAL, PRO_REQUIRED, type ProConsents } from '@/lib/consents'
import { recordProConsents } from '@/lib/consents-server'

// Accettazione dei documenti 2.1 dalla schermata di riaccettazione dell'area
// professionisti. Scrive con la sessione dell'utente (RLS: solo righe proprie,
// solo insert). IP e user agent dagli header della richiesta.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('unauthorized', 401)

  const body = (await req.json().catch(() => ({}))) as { consents?: Partial<ProConsents>; lang?: string }
  const consents: ProConsents = { ...EMPTY_PRO_CONSENTS }
  for (const k of [...PRO_REQUIRED, ...PRO_OPTIONAL]) consents[k] = body.consents?.[k] === true
  const lang: Locale = (locales as readonly string[]).includes(body.lang ?? '') ? (body.lang as Locale) : 'it'

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
  const res = await recordProConsents({
    userId: user.id,
    consents,
    lang,
    ip,
    userAgent: req.headers.get('user-agent'),
  })
  if (!res.ok) return apiError(res.error ?? 'insert_failed', res.error === 'required_missing' ? 400 : 500)
  return NextResponse.json({ ok: true })
}
