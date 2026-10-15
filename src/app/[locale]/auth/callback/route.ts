import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { splitLocale, withLocale } from '@/i18n/routing'

// Callback PKCE dei link email Supabase (`?code=...`): lo scambio avviene qui,
// lato server, e la sessione finisce nei cookie prima di qualunque pagina.
// Audit QA 14/10/2026, punto D6. Il codice PKCE è legato al verifier salvato
// nel browser che ha chiesto il link: un prescanner non può spenderlo, ma un
// utente che apre il link in un altro browser vede l'errore spiegato da
// /imposta-password (che gestisce anche `?error=`).
//
// Parametri: `code` (obbligatorio), `type` (recovery | invite | signup | ...),
// `next` (percorso interno dove andare dopo, solo se inizia con "/").
export async function GET(req: NextRequest) {
  const { locale } = splitLocale(req.nextUrl.pathname)
  const code = req.nextUrl.searchParams.get('code')
  const type = (req.nextUrl.searchParams.get('type') ?? 'recovery').toLowerCase()
  const nextParam = req.nextUrl.searchParams.get('next')
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null

  const toSetPassword = (err?: string) => {
    const url = req.nextUrl.clone()
    url.pathname = withLocale('/imposta-password', locale)
    url.search = err ? `?error=${encodeURIComponent(err)}&error_code=${encodeURIComponent(err)}` : ''
    url.hash = ''
    return NextResponse.redirect(url)
  }

  if (!code) return toSetPassword('missing_code')

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth/callback] exchangeCodeForSession fallita', error.code ?? error.message)
    return toSetPassword(error.code ?? 'exchange_failed')
  }

  const url = req.nextUrl.clone()
  url.search = ''
  url.hash = ''
  url.pathname = withLocale(
    type === 'recovery' || type === 'invite' ? '/imposta-password' : (safeNext ?? '/area-professionisti'),
    locale,
  )
  return NextResponse.redirect(url)
}
