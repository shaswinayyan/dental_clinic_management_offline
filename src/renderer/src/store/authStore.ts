/**
 * Auth store — Zustand store for authentication state.
 *
 * Supports both:
 *  - Desktop (Electron) mode: stores a local User + simple token
 *  - Cloud (SaaS/web) mode:   stores access/refresh tokens + StaffMember profile
 *
 * Cloud tokens are persisted to sessionStorage so they survive a hot-reload
 * but are cleared when the browser tab closes (more secure than localStorage).
 */
import { create } from 'zustand'
import type { User, StaffMember, CloudRole } from '../../../shared/types'

// ── Session storage keys ──────────────────────────────────────────────────────

const STORAGE_KEY_ACCESS  = 'vorsa_access_token'
const STORAGE_KEY_REFRESH = 'vorsa_refresh_token'

function readStorage(key: string): string | null {
  try { return sessionStorage.getItem(key) } catch { return null }
}
function writeStorage(key: string, val: string): void {
  try { sessionStorage.setItem(key, val) } catch { /* ignore */ }
}
function clearStorage(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY_ACCESS)
    sessionStorage.removeItem(STORAGE_KEY_REFRESH)
  } catch { /* ignore */ }
}

// ── Store types ───────────────────────────────────────────────────────────────

/** Which mode the app is currently running in. */
export type AppMode = 'desktop' | 'cloud'

interface AuthState {
  // ── Common ─────────────────────────────────────────────────────────────────
  /** Whether any user (desktop or cloud) is authenticated. */
  isAuthenticated: boolean
  /** App mode — set once during bootstrap, never changes at runtime. */
  mode: AppMode

  // ── Desktop mode ───────────────────────────────────────────────────────────
  /** Desktop user (Electron IPC). Null in cloud mode. */
  user: User | null

  // ── Cloud mode ─────────────────────────────────────────────────────────────
  /** Cloud staff profile. Null in desktop mode. */
  staff:        StaffMember | null
  accessToken:  string | null
  refreshToken: string | null
  clinicId:     string | null
  branchId:     string | null
  role:         CloudRole | null

  // ── Actions ────────────────────────────────────────────────────────────────
  /** Desktop login. */
  login:        (user: User) => void

  /** Cloud login — stores tokens + profile. */
  cloudLogin: (params: {
    staff:        StaffMember
    accessToken:  string
    refreshToken: string
    expiresIn:    number
  }) => void

  /** Update the access token in-place (called by silent refresh). */
  setAccessToken: (token: string) => void

  /** Clear all auth state — used by both modes. */
  logout: () => void

  /** Set the app mode at bootstrap. */
  setMode: (mode: AppMode) => void
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  mode:            'desktop',

  // Desktop
  user: null,

  // Cloud — rehydrate tokens from sessionStorage on load
  staff:        null,
  accessToken:  readStorage(STORAGE_KEY_ACCESS),
  refreshToken: readStorage(STORAGE_KEY_REFRESH),
  clinicId:     null,
  branchId:     null,
  role:         null,

  // ── Actions ────────────────────────────────────────────────────────────────

  setMode: (mode) => set({ mode }),

  login: (user) => set({ user, isAuthenticated: true }),

  cloudLogin: ({ staff, accessToken, refreshToken }) => {
    writeStorage(STORAGE_KEY_ACCESS,  accessToken)
    writeStorage(STORAGE_KEY_REFRESH, refreshToken)
    set({
      isAuthenticated: true,
      staff,
      accessToken,
      refreshToken,
      clinicId: staff.clinic_id,
      branchId: staff.branch_id,
      role:     staff.role,
    })
  },

  setAccessToken: (token) => {
    writeStorage(STORAGE_KEY_ACCESS, token)
    set({ accessToken: token })
  },

  logout: () => {
    clearStorage()
    set({
      isAuthenticated: false,
      user:            null,
      staff:           null,
      accessToken:     null,
      refreshToken:    null,
      clinicId:        null,
      branchId:        null,
      role:            null,
    })
  },
}))

// ── TokenStore adapter ────────────────────────────────────────────────────────
// Passed to createFetchApi() so the HTTP client can read / update tokens.

export const authTokenStore = {
  getAccessToken:  () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  setAccessToken:  (token: string) => useAuthStore.getState().setAccessToken(token),
  clearTokens:     () => useAuthStore.getState().logout(),
}
