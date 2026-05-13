import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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
