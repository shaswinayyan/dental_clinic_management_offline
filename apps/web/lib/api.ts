/**
 * API client for the Vorsa Hono API.
 * Uses fetch() with Clerk session tokens injected via getToken().
 */
import { useAuth } from '@clerk/nextjs'
import { useCallback } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v2'

// ── Server-side (App Router server components / route handlers) ───────────────

/**
 * Server-side fetch — pass a Clerk token (from auth().getToken()).
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...init } = options
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', 'application/json')

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; message?: string }
    throw new ApiError(res.status, body.error ?? body.message ?? res.statusText)
  }

  return res.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Client-side hook ──────────────────────────────────────────────────────────

export function useApi() {
  const { getToken } = useAuth()

  const request = useCallback(
    async <T>(path: string, options: RequestInit = {}): Promise<T> => {
      const token   = await getToken()
      const headers = new Headers(options.headers)
      if (token) headers.set('Authorization', `Bearer ${token}`)
      headers.set('Content-Type', 'application/json')

      const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; message?: string }
        throw new ApiError(res.status, body.error ?? body.message ?? res.statusText)
      }

      return res.json() as Promise<T>
    },
    [getToken],
  )

  return {
    get:    <T>(path: string)                      => request<T>(path),
    post:   <T>(path: string, body: unknown)       => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
    patch:  <T>(path: string, body: unknown)       => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
    put:    <T>(path: string, body: unknown)       => request<T>(path, { method: 'PUT',   body: JSON.stringify(body) }),
    delete: <T>(path: string)                      => request<T>(path, { method: 'DELETE' }),
  }
}
