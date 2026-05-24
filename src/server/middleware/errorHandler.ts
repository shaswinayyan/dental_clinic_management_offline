/**
 * Centralised JSON error handler.
 *
 * Must be registered LAST in the Express middleware chain:
 *   app.use(errorHandler)
 *
 * Catches errors thrown/passed to next() anywhere in the app and converts
 * them into consistent { success: false, error: string } JSON responses.
 * Sensitive details are never leaked to the client in production.
 */
import type { Request, Response, NextFunction } from 'express'
import { NODE_ENV } from '../config'

/** Shape every error response follows. */
interface ErrorBody {
  success: false
  error:   string
  /** Only present in development to ease debugging. */
  stack?:  string
}

/**
 * Known operational error that should map to a specific HTTP status.
 * Throw this inside route handlers instead of passing generic Errors.
 *
 * @example
 *   throw new AppError(404, 'Patient not found')
 *   throw new AppError(409, 'Email already registered')
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err:  unknown,
  req:  Request,
  res:  Response,
  _next: NextFunction,
): void {
  // Determine status code and message
  let status  = 500
  let message = 'Internal server error'

  if (err instanceof AppError) {
    status  = err.statusCode
    message = err.message
  } else if (err instanceof Error) {
    // Postgres unique-violation: code 23505
    if ((err as NodeJS.ErrnoException & { code?: string }).code === '23505') {
      status  = 409
      message = 'A record with that value already exists'
    } else if (NODE_ENV !== 'production') {
      message = err.message
    }
  }

  // Always log internal errors server-side
  if (status >= 500) {
    console.error('[ERROR]', req.method, req.path, err)
  }

  const body: ErrorBody = { success: false, error: message }

  if (NODE_ENV !== 'production' && err instanceof Error) {
    body.stack = err.stack
  }

  res.status(status).json(body)
}
