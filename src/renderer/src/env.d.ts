/// <reference types="vite/client" />

import type { API } from '../../preload/index'

// ── Vite environment variables (PRD §8 / cloud build target) ─────────────────

interface ImportMetaEnv {
  /** 'desktop' (Electron IPC) | 'web' (cloud SaaS HTTP) */
  readonly VITE_APP_MODE: 'desktop' | 'web'
  /** Base URL for the cloud API, e.g. https://api.vorsa.app/api/v2  */
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    api: API
  }
}
