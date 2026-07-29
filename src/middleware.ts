import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Create an initial response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. Initialize Supabase Client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // If cookies are updated, update the request and response
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          // If cookies are removed, update the request and response
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  /**
   * 3. REFRESH SESSION
   * IMPORTANT: Do not use supabase.auth.getSession(). 
   * getUser() is more secure as it re-validates the user against the database.
   */
  const { data: { user } } = await supabase.auth.getUser()

  /**
   * 4. PROTECT STUDIO ROUTES
   * If there is no active user session and the user is trying to access /studio,
   * redirect them to the home page or login page.
   */
  if (!user && request.nextUrl.pathname.startsWith('/studio')) {
    const url = request.nextUrl.clone()
    url.pathname = '/' // Redirect to home or login
    return NextResponse.redirect(url)
  }

  return response
}

/**
 * 5. CONFIGURE MATCHER
 * This ensures middleware runs on all routes except static assets.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}