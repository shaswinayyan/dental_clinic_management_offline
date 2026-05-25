/**
 * Supabase client factories for Next.js App Router.
 *
 * Two separate clients are needed:
 *   - Browser client  → for Client Components  (uses anon key, stores session in cookies)
 *   - Server client   → for Server Components  (reads cookies, cannot set them)
 *   - Middleware client → used in middleware.ts to refresh session cookies
 *
 * The @supabase/ssr package handles all cookie management correctly for
 * Next.js App Router (no localStorage — SSR-safe).
 */
import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── Browser client (Client Components) ───────────────────────────────────────

export function createBrowserSupabase() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

// ── Server client (Server Components) ────────────────────────────────────────

export async function createServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll:  () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // setAll can throw in Server Components — ignore (middleware handles refresh)
        }
      },
    },
  })
}

// ── Middleware client (middleware.ts) ─────────────────────────────────────────

export function createMiddlewareSupabase(request: NextRequest, response: NextResponse) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll:  () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })
}
