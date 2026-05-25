/**
 * Global Hono error handler.
 *
 * Replaces the Express errorHandler middleware.
 * In Hono, errors are handled via app.onError(handler).
 */
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import { env } from '../env'

/** Structured error thrown by application code. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(err: Error, c: Context) {
  // ── Hono's own HTTP exceptions ────────────────────────────────────────────
  if (err instanceof HTTPException) {
    return c.json({ success: false, error: err.message }, err.status)
  }

  // ── Application errors ────────────────────────────────────────────────────
  if (err instanceof AppError) {
    return c.json({ success: false, error: err.message }, err.statusCode as never)
  }

  // ── Zod validation errors ─────────────────────────────────────────────────
  if (err instanceof ZodError) {
    return c.json({
      success: false,
      error:   'Validation failed',
      issues:  err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
    }, 400)
  }

  // ── PostgreSQL constraint violations ──────────────────────────────────────
  const pgErr = err as { code?: string; detail?: string; constraint?: string }
  if (pgErr.code === '23505') {
    const field = pgErr.detail?.match(/\(([^)]+)\)/)?.[1] ?? 'field'
    return c.json({ success: false, error: `Duplicate value for ${field}` }, 409)
  }
  if (pgErr.code === '23503') {
    return c.json({ success: false, error: 'Referenced record not found' }, 400)
  }

  // ── Unexpected errors ─────────────────────────────────────────────────────
  console.error('Unhandled error:', err)
  return c.json(
    {
      success: false,
      error:   env.isProduction ? 'An internal error occurred' : err.message,
      ...(env.isDevelopment && { stack: err.stack }),
    },
    500,
  )
}
