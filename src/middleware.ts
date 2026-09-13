import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const SUSPENDED_PATH = '/area-professionisti/sospeso'

const PUBLIC_DASHBOARD_PATHS = [
  '/area-professionisti/login',
  '/area-professionisti/recupera-password',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/area-professionisti')) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

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
          response = NextResponse.next({ request })
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

  const isPublicDashboardPath = PUBLIC_DASHBOARD_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (!user && !isPublicDashboardPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/area-professionisti/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Stato dell'account (migration 024), letto a ogni richiesta: sospensione e
  // blocco valgono subito, senza rifare login. Se la RPC non esiste o fallisce
  // si prosegue come prima.
  if (user && !isPublicDashboardPath) {
    const { data, error } = await supabase.rpc('my_account_access')
    const stato = error ? null : ((data as { stato?: string } | null)?.stato ?? null)
    if (stato === 'bloccato') {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/area-professionisti/login'
      url.search = ''
      url.searchParams.set('stato', 'bloccato')
      const redirect = NextResponse.redirect(url)
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
      return redirect
    }
    if (stato === 'sospeso' && pathname !== SUSPENDED_PATH) {
      const url = request.nextUrl.clone()
      url.pathname = SUSPENDED_PATH
      url.search = ''
      const rewrite = NextResponse.rewrite(url, { request })
      response.cookies.getAll().forEach((c) => rewrite.cookies.set(c))
      return rewrite
    }
    if (stato !== 'sospeso' && pathname === SUSPENDED_PATH) {
      const url = request.nextUrl.clone()
      url.pathname = '/area-professionisti'
      return NextResponse.redirect(url)
    }
  }

  if (user && isPublicDashboardPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/area-professionisti'
    url.searchParams.delete('redirect')
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/area-professionisti/:path*'],
}
