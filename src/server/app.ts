/**
 * Express application factory.
 *
 * Keeps app creation separate from server startup so the same app can be
 * imported by integration tests without binding to a port.
 */
import express from 'express'
import cors    from 'cors'
import helmet  from 'helmet'
import morgan  from 'morgan'
import rateLimit from 'express-rate-limit'

import {
  NODE_ENV,
  CORS_ORIGIN,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_MAX,
} from './config'
import apiRouter     from './routes'
import { errorHandler } from './middleware/errorHandler'

export function createApp(): express.Application {
  const app = express()

  // ── Security headers ───────────────────────────────────────────────────────
  app.use(helmet())

  // ── CORS ───────────────────────────────────────────────────────────────────
  app.use(cors({
    origin:      CORS_ORIGIN,
    credentials: true,
    methods:     ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))

  // ── Request logging ────────────────────────────────────────────────────────
  if (NODE_ENV !== 'test') {
    app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'))
  }

  // ── Body parsing ───────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: false }))

  // ── Global rate limiter ────────────────────────────────────────────────────
  app.use(
    rateLimit({
      windowMs: RATE_LIMIT_WINDOW_MS,
      max:      RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders:   false,
      message: { success: false, error: 'Too many requests, please slow down' },
    }),
  )

  // ── Stricter limiter for auth endpoints ────────────────────────────────────
  app.use(
    '/api/v2/auth',
    rateLimit({
      windowMs: RATE_LIMIT_WINDOW_MS,
      max:      AUTH_RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders:   false,
      message: { success: false, error: 'Too many authentication attempts, try again later' },
    }),
  )

  // ── API routes ─────────────────────────────────────────────────────────────
  app.use('/api/v2', apiRouter)

  // ── Health check — no auth required ───────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() })
  })

  // ── 404 for unmatched routes ───────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' })
  })

  // ── Centralised error handler (must be last) ───────────────────────────────
  app.use(errorHandler)

  return app
}
