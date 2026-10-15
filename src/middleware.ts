import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import { routing, splitLocale, withLocale } from '@/i18n/routing'

// =============================================================================
// Middleware unico: routing per lingua (next-intl) + protezione di
// /area-professionisti (solo sessione Supabase e redirect).
// =============================================================================
//
// next-intl decide la lingua (prefisso URL, poi cookie NEXT_LOCALE, poi
// Accept-Language alla prima visita) e riscrive internamente /registrazione in
// /it/registrazione. La parte Supabase ragiona sul percorso SENZA prefisso e,
// quando deve reindirizzare, rimette il prefisso della lingua corrente.
//
// Audit QA 14/10/2026 (D7, E4): qui si fa il minimo. Nessuna query a tabelle o
// RPC: lo stato commerciale dell'account (sospeso, bloccato) lo controlla il
// layout dell'area con `getMyAccountAccess()`, memorizzata per richiesta.
// Prima la RPC `my_account_access` girava a ogni richiesta dell'area, anche sui
// prefetch, e Vercel registrava timeout dei 25 secondi sul middleware. Un
// refresh token non più valido (`refresh_token_not_found`) non è più
// un'eccezione: si cancellano i cookie di sessione e si torna al login.

const handleI18n = createIntlMiddleware(routing)

const DASHBOARD_PREFIX = '/area-professionisti'
const LOGIN_PATH = '/area-professionisti/login'

const PUBLIC_DASHBOARD_PATHS = [
  '/area-professionisti/login',
  '/area-professionisti/recupera-password',
]

export async function middleware(request: NextRequest) {
  const { locale, path } = splitLocale(request.nextUrl.pathname)

  // Prima il routing per lingua: la risposta (rewrite o redirect) è la base su
  // cui Supabase scrive i cookie di sessione aggiornati.
  const response = handleI18n(request)

  if (!path.startsWith(DASHBOARD_PREFIX)) {
    return response
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    // Configurazione mancante: meglio il login che un 500 del middleware.
    console.error('[middleware] NEXT_PUBLIC_SUPABASE_URL o ANON_KEY mancanti')
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const isPublicDashboardPath = PUBLIC_DASHBOARD_PATHS.some((p) => path === p || path.startsWith(p + '/'))

  // Redirect che conserva la lingua e i cookie già scritti sulla risposta.
  const redirectTo = (targetPath: string, mutate?: (url: URL) => void) => {
    const url = request.nextUrl.clone()
    url.pathname = withLocale(targetPath, locale)
    url.search = ''
    mutate?.(url)
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  // Cookie di sessione Supabase (`sb-<ref>-auth-token`, anche a pezzi `.0`, `.1`).
  const clearSessionCookies = (res: NextResponse) => {
    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith('sb-')) res.cookies.set(c.name, '', { path: '/', maxAge: 0 })
    }
    return res
  }

  let user: { id: string } | null = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      // Refresh token scaduto, revocato o assente: niente eccezione. Si pulisce
      // e si prosegue come utente anonimo (le pagine pubbliche restano
      // raggiungibili, le altre vanno al login).
      const sessionGone = /refresh_token|session|jwt|token/i.test(error.code ?? '') || /refresh token|session/i.test(error.message)
      if (!sessionGone) console.error('[middleware] getUser', error.code ?? error.message)
      const res = isPublicDashboardPath
        ? response
        : redirectTo(LOGIN_PATH, (url) => url.searchParams.set('redirect', path))
      return clearSessionCookies(res)
    }
    user = data.user
  } catch (e) {
    // Rete o GoTrue non raggiungibile: non si blocca la richiesta a vuoto.
    console.error('[middleware] getUser ha lanciato', e)
    return isPublicDashboardPath ? response : redirectTo(LOGIN_PATH, (url) => url.searchParams.set('redirect', path))
  }

  if (!user && !isPublicDashboardPath) {
    // Il parametro `redirect` è il percorso SENZA prefisso: il router i18n lo
    // rimette lui al momento del push dopo il login.
    return redirectTo(LOGIN_PATH, (url) => url.searchParams.set('redirect', path))
  }

  // Un utente loggato che arriva al login con `?stato=bloccato` ci viene
  // mandato dal layout dell'area (account bloccato): la pagina chiude la
  // sessione lato client. Non va rimbalzato alla dashboard.
  if (user && isPublicDashboardPath && request.nextUrl.searchParams.get('stato') !== 'bloccato') {
    return redirectTo('/area-professionisti')
  }

  return response
}

export const config = {
  // Tutto tranne API, asset di Next e file statici (con estensione).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
