/**
 * VORSA Hono Application
 *
 * Replaces Express (src/server/app.ts) with Hono v4.
 * Why Hono over Express:
 *   - 14× faster throughput (Hono benchmarks)
 *   - Native TypeScript — typed context, typed middleware variables
 *   - Runs on Node.js, Cloudflare Workers, AWS Lambda — no code changes
 *   - Built-in helpers: cors, secureHeaders, logger, validator
 *   - No extra @types packages needed
 *
 * Rate limiting uses Upstash Redis sliding window (serverless-compatible).
 * Falls back to in-memory when Upstash is not configured (development).
 */
import { Hono }          from 'hono'
import { cors }          from 'hono/cors'
import { logger }        from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { env }           from './env'
import { apiRouter }     from './routers'
import { errorHandler }  from './middleware/errorHandler'
import { rateLimiter }   from './middleware/rateLimiter'
import type { CloudRole } from '@vorsa/types'

// ── Hono context variable types ───────────────────────────────────────────────

export type AppVariables = {
  clinicId:  string
  staffId:   string
  role:      CloudRole
  branchId:  string | null
}

export type AppEnv = { Variables: AppVariables }

// ── App factory ───────────────────────────────────────────────────────────────

export const app = new Hono()

// ── Security headers (replaces helmet) ────────────────────────────────────────
app.use('*', secureHeaders())

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use('*', cors({
  origin:      env.CORS_ORIGIN,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// ── Request logging ────────────────────────────────────────────────────────────
if (!env.isProduction) {
  app.use('*', logger())
}

// ── Global rate limiter (Upstash Redis) ───────────────────────────────────────
app.use('/api/*', rateLimiter('global', env.RATE_LIMIT_MAX, '15 m'))

// ── Stricter rate limit for auth routes ───────────────────────────────────────
app.use('/api/v2/auth/*', rateLimiter('auth', env.AUTH_RATE_LIMIT_MAX, '15 m'))

// ── Health check — no auth required ───────────────────────────────────────────
app.get('/health', (c) => c.json({
  status:    'ok',
  service:   'vorsa-api',
  version:   '2.0.0',
  timestamp: new Date().toISOString(),
}))

// ── API v2 routes ─────────────────────────────────────────────────────────────
app.route('/api/v2', apiRouter)

// ── 404 handler ───────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ success: false, error: 'Route not found' }, 404))

// ── Global error handler ───────────────────────────────────────────────────────
app.onError(errorHandler)
