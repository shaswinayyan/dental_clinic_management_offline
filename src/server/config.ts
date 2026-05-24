/**
 * Server configuration — reads from environment variables with safe defaults
 * for local development.  In production these must be set as real secrets.
 */
import { config as loadEnv } from 'dotenv'
loadEnv()                              // load .env file if present

// ── Database ──────────────────────────────────────────────────────────────────
/**
 * DATABASE_URL  full PostgreSQL connection string
 *   postgresql://user:pass@host:5432/vorsa
 * Alternatively set individual vars: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
 */
export const DATABASE_URL = process.env.DATABASE_URL ?? ''

export const DB_CONFIG = {
  host:     process.env.PGHOST     ?? 'localhost',
  port:     Number(process.env.PGPORT ?? 5432),
  user:     process.env.PGUSER     ?? 'postgres',
  password: process.env.PGPASSWORD ?? 'postgres',
  database: process.env.PGDATABASE ?? 'vorsa',
  max:      Number(process.env.PG_POOL_MAX ?? 20),
  idleTimeoutMillis:    30_000,
  connectionTimeoutMillis: 5_000,
}

// ── JWT ───────────────────────────────────────────────────────────────────────
export const JWT_SECRET          = process.env.JWT_SECRET          ?? 'CHANGE_ME_IN_PRODUCTION_vorsa_access'
export const JWT_REFRESH_SECRET  = process.env.JWT_REFRESH_SECRET  ?? 'CHANGE_ME_IN_PRODUCTION_vorsa_refresh'
export const JWT_ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES  ?? '15m'
export const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES ?? '30d'

// ── Server ────────────────────────────────────────────────────────────────────
export const PORT        = Number(process.env.PORT        ?? 4000)
export const NODE_ENV    = process.env.NODE_ENV           ?? 'development'
export const CORS_ORIGIN = process.env.CORS_ORIGIN        ?? 'http://localhost:5173'

// ── Rate limiting ─────────────────────────────────────────────────────────────
export const RATE_LIMIT_WINDOW_MS  = Number(process.env.RATE_LIMIT_WINDOW_MS  ?? 15 * 60 * 1000) // 15 min
export const RATE_LIMIT_MAX        = Number(process.env.RATE_LIMIT_MAX        ?? 300)
export const AUTH_RATE_LIMIT_MAX   = Number(process.env.AUTH_RATE_LIMIT_MAX   ?? 20)   // stricter for auth

// ── File storage ──────────────────────────────────────────────────────────────
export const UPLOAD_DIR  = process.env.UPLOAD_DIR ?? './uploads'
export const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES ?? 10 * 1024 * 1024) // 10 MB
