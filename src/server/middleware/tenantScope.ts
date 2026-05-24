/**
 * Tenant-scope middleware.
 *
 * Sets the PostgreSQL session variable `app.clinic_id` so that all subsequent
 * queries on the same connection are automatically scoped to the authenticated
 * clinic via Row Level Security (RLS) policies.
 *
 * Must be placed AFTER `authenticate` in the middleware chain.
 * Not needed inside `withTransaction` — that helper sets the variable itself.
 *
 * Usage (on a router that already has `authenticate`):
 *   router.use(authenticate, tenantScope)
 */
import type { Request, Response, NextFunction } from 'express'
import { pool } from '../db/postgres'

export async function tenantScope(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.clinicId) {
    // Should not happen if authenticate ran first; guard defensively.
    res.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  // We cannot set a session variable on the pool level because the pool reuses
  // connections across requests.  For lightweight read-only handlers we attach
  // a single-use client to the request so the session variable is properly
  // scoped to this request only.
  //
  // Route handlers that need a transaction should use withTransaction() from
  // db/postgres.ts instead — it sets the variable inside its own transaction.
  const client = await pool.connect()

  try {
    await client.query(`SELECT set_config('app.clinic_id', $1, true)`, [req.clinicId])

    // Attach to req so handlers can use it for read queries.
    ;(req as Request & { dbClient: typeof client }).dbClient = client

    // Release the client after the response is sent.
    res.on('finish', () => client.release())
    res.on('close',  () => client.release())

    next()
  } catch (err) {
    client.release()
    next(err)
  }
}
