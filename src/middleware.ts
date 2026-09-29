import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import { routing, splitLocale, withLocale } from '@/i18n/routing'

// =============================================================================
// Middleware unico: routing per lingua (next-intl) + protezione di
// /area-professionisti (Supabase Auth + stato commerciale dell'account).
// =============================================================================
//
// next-intl decide la lingua (prefisso URL, poi cookie NEXT_LOCALE, poi
// Accept-Language alla prima visita) e riscrive internamente /registrazione in
// /it/registrazione. La parte Supabase ragiona sul percorso SENZA prefisso e,
// quando deve reindirizzare, rimette il prefisso della lingua corrente.

const handleI18n = createIntlMiddleware(routing)

const DASHBOARD_PREFIX = '/area-professionisti'
const SUSPENDED_PATH = '/area-professionisti/sospeso'

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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  if (!user && !isPublicDashboardPath) {
    // Il parametro `redirect` è il percorso SENZA prefisso: il router i18n lo
    // rimette lui al momento del push dopo il login.
    return redirectTo('/area-professionisti/login', (url) => url.searchParams.set('redirect', path))
  }

  // Stato dell'account (migration 024), letto a ogni richiesta: sospensione e
  // blocco valgono subito, senza rifare login. Se la RPC non esiste o fallisce
  // si prosegue come prima.
  if (user && !isPublicDashboardPath) {
    const { data, error } = await supabase.rpc('my_account_access')
    const stato = error ? null : ((data as { stato?: string } | null)?.stato ?? null)
    if (stato === 'bloccato') {
      await supabase.auth.signOut()
      return redirectTo('/area-professionisti/login', (url) => url.searchParams.set('stato', 'bloccato'))
    }
    if (stato === 'sospeso' && path !== SUSPENDED_PATH) {
      const url = request.nextUrl.clone()
      url.pathname = `/${locale}${SUSPENDED_PATH}`
      url.search = ''
      const rewrite = NextResponse.rewrite(url, { request })
      response.cookies.getAll().forEach((c) => rewrite.cookies.set(c))
      return rewrite
    }
    if (stato !== 'sospeso' && path === SUSPENDED_PATH) {
      return redirectTo('/area-professionisti')
    }
  }

  if (user && isPublicDashboardPath) {
    return redirectTo('/area-professionisti')
  }

  return response
}

export const config = {
  // Tutto tranne API, asset di Next e file statici (con estensione).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
