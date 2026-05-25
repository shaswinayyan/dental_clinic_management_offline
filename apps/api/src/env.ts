/**
 * Environment variable validation — all vars declared here, accessed nowhere else.
 * Fail fast at startup if required vars are missing.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '../../.env' })

function required(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required environment variable: ${key}`)
  return val
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

export const env = {
  // ── Server ────────────────────────────────────────────────────────────────
  PORT:     parseInt(optional('PORT', '4000'), 10),
  NODE_ENV: optional('NODE_ENV', 'development') as 'development' | 'production' | 'test',
  CORS_ORIGIN: optional('CORS_ORIGIN', 'http://localhost:3000'),

  // ── Database (Supabase PostgreSQL) ────────────────────────────────────────
  DATABASE_URL: required('DATABASE_URL'),

  // ── Supabase Auth ──────────────────────────────────────────────────────────
  // supabase.com → project → Settings → API
  SUPABASE_URL:              required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),

  // ── Upstash Redis (rate limiting + config cache) ───────────────────────────
  // Sign up at upstash.com → create a Redis DB → copy REST credentials
  UPSTASH_REDIS_REST_URL:   optional('UPSTASH_REDIS_REST_URL', ''),
  UPSTASH_REDIS_REST_TOKEN: optional('UPSTASH_REDIS_REST_TOKEN', ''),

  // ── Cloudflare R2 (patient images, PDFs) ──────────────────────────────────
  R2_ACCOUNT_ID:       optional('R2_ACCOUNT_ID', ''),
  R2_ACCESS_KEY_ID:    optional('R2_ACCESS_KEY_ID', ''),
  R2_SECRET_ACCESS_KEY:optional('R2_SECRET_ACCESS_KEY', ''),
  R2_BUCKET:           optional('R2_BUCKET', 'vorsa-files'),
  R2_PUBLIC_URL:       optional('R2_PUBLIC_URL', ''),

  // ── Rate limiting ──────────────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: parseInt(optional('RATE_LIMIT_WINDOW_MS', String(15 * 60 * 1000)), 10),
  RATE_LIMIT_MAX:       parseInt(optional('RATE_LIMIT_MAX', '300'), 10),
  AUTH_RATE_LIMIT_MAX:  parseInt(optional('AUTH_RATE_LIMIT_MAX', '20'), 10),

  get isProduction()  { return this.NODE_ENV === 'production' },
  get isDevelopment() { return this.NODE_ENV === 'development' },
  get hasUpstash()    { return Boolean(this.UPSTASH_REDIS_REST_URL) },
} as const
