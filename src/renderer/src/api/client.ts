/**
 * API client factory — detects app mode and returns the right implementation.
 *
 * In Electron (desktop mode): delegates to window.api (IPC bridge).
 * In web/SaaS mode:           uses createFetchApi (HTTP REST).
 *
 * The returned client satisfies the ApiClient interface so all consumers are
 * mode-agnostic.
 */
import type { ApiClient } from '../../../shared/types'
import { createFetchApi, type TokenStore } from './fetchApi'

// ── Mode detection ────────────────────────────────────────────────────────────

/**
 * Returns true when running as a web app (Vite env var set at build time).
 * Falls back to checking whether window.api exists (Electron IPC bridge).
 */
export function isWebMode(): boolean {
  // VITE_APP_MODE=web is set in the web build config
  if (typeof import.meta !== 'undefined' && (import.meta as Record<string, unknown>).env) {
    const env = (import.meta as unknown as { env: Record<string, string> }).env
    if (env['VITE_APP_MODE'] === 'web') return true
  }
  // No IPC bridge means we're in a browser
  return typeof window !== 'undefined' && !('api' in window)
}

// ── Base URL for HTTP mode ────────────────────────────────────────────────────

function getBaseUrl(): string {
  if (typeof import.meta !== 'undefined') {
    const env = (import.meta as unknown as { env: Record<string, string> }).env
    return (env['VITE_API_BASE_URL'] ?? 'http://localhost:4000/api/v2')
  }
  return 'http://localhost:4000/api/v2'
}

// ── Singleton client ──────────────────────────────────────────────────────────

let _client: ApiClient | null = null

/**
 * Initialise (or replace) the singleton API client.
 *
 * Call this once during app bootstrap:
 *   - Web mode:      initApiClient(tokenStore)
 *   - Electron mode: initApiClient()  — uses window.api
 */
export function initApiClient(tokenStore?: TokenStore): void {
  if (isWebMode()) {
    if (!tokenStore) {
      throw new Error('initApiClient: tokenStore is required in web mode')
    }
    _client = createFetchApi(getBaseUrl(), tokenStore)
  } else {
    // Electron IPC bridge — already satisfies ApiClient (partially).
    // The Electron preload exposes window.api which provides all methods.
    _client = (window as unknown as { api: ApiClient }).api
  }
}

/**
 * Get the singleton API client.
 * Throws if initApiClient has not been called.
 */
export function getApiClient(): ApiClient {
  if (!_client) {
    throw new Error(
      'API client not initialised. Call initApiClient() during app bootstrap.',
    )
  }
  return _client
}
