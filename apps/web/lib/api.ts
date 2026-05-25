/**
 * API client for the Vorsa Hono API.
 * Uses fetch() with Supabase session tokens injected automatically.
 */
import { useCallback }   from 'react'
import { useSupabase }   from '@/components/providers'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v2'

// ── Shared error class ────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Shared fetch helper ───────────────────────────────────────────────────────

async function doFetch<T>(path: string, token: string | undefined, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', 'application/json')

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; message?: string }
    throw new ApiError(res.status, body.error ?? body.message ?? res.statusText)
  }

  return res.json() as Promise<T>
}

// ── Client-side hook (Client Components) ──────────────────────────────────────

export function useApi() {
  const { session } = useSupabase()

  const request = useCallback(
    <T>(path: string, options: RequestInit = {}): Promise<T> =>
      doFetch<T>(path, session?.access_token, options),
    [session],
  )

  return {
    get:    <T>(path: string)                => request<T>(path),
    post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
    patch:  <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
    put:    <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
    delete: <T>(path: string)                => request<T>(path, { method: 'DELETE' }),
  }
}

// ── Server-side helper (Server Components / Route Handlers) ──────────────────

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...init } = options
  return doFetch<T>(path, token, init)
}
