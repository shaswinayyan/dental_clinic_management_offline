import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareSupabase } from '@/lib/supabase'

const PUBLIC_PATHS = ['/sign-in', '/sign-up']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  // Refresh the Supabase session cookie on every request
  const supabase = createMiddlewareSupabase(request, response)
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  // Unauthenticated user trying to access a protected page → redirect to sign-in
  if (!user && !isPublic) {
    const signIn = new URL('/sign-in', request.url)
    signIn.searchParams.set('next', pathname)
    return NextResponse.redirect(signIn)
  }

  // Authenticated user visiting auth pages → send to dashboard
  if (user && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|[^?]*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
