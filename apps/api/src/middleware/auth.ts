/**
 * Supabase authentication middleware for Hono.
 *
 * How it works:
 *   1. Client sends `Authorization: Bearer <supabase_access_token>`
 *   2. requireAuth() calls supabaseAdmin.auth.getUser(token) to validate
 *   3. Maps the Supabase user.id → our staff row (clinicId, role, branchId)
 *   4. Sets typed context vars: staffId, clinicId, role, branchId
 */
import type { MiddlewareHandler } from 'hono'
import { HTTPException }          from 'hono/http-exception'
import { db, staff, eq }          from '@vorsa/db'
import { verifyToken }            from '../lib/supabase'
import type { AppEnv }            from '../app'

// ── requireAuth ───────────────────────────────────────────────────────────────

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const bearer = c.req.header('Authorization')
  if (!bearer?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Authentication required' })
  }

  const token = bearer.slice(7)
  let supabaseUserId: string

  try {
    const user    = await verifyToken(token)
    supabaseUserId = user.id
  } catch {
    throw new HTTPException(401, { message: 'Invalid or expired token' })
  }

  // Map Supabase user → staff record
  const staffRow = await db
    .select({
      id:        staff.id,
      clinic_id: staff.clinic_id,
      branch_id: staff.branch_id,
      role:      staff.role,
      is_active: staff.is_active,
    })
    .from(staff)
    .where(eq(staff.user_id, supabaseUserId))
    .limit(1)
    .then(r => r[0])

  if (!staffRow) {
    throw new HTTPException(401, { message: 'No staff account found. Please complete registration.' })
  }

  if (!staffRow.is_active) {
    throw new HTTPException(403, { message: 'Your account has been deactivated' })
  }

  c.set('staffId',  staffRow.id)
  c.set('clinicId', staffRow.clinic_id)
  c.set('role',     staffRow.role as AppEnv['Variables']['role'])
  c.set('branchId', staffRow.branch_id)

  await next()
}

// ── optionalAuth ──────────────────────────────────────────────────────────────

export const optionalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const bearer = c.req.header('Authorization')

  if (bearer?.startsWith('Bearer ')) {
    try {
      const user     = await verifyToken(bearer.slice(7))
      const staffRow = await db
        .select({ id: staff.id, clinic_id: staff.clinic_id, branch_id: staff.branch_id, role: staff.role })
        .from(staff)
        .where(eq(staff.user_id, user.id))
        .limit(1)
        .then(r => r[0])

      if (staffRow) {
        c.set('staffId',  staffRow.id)
        c.set('clinicId', staffRow.clinic_id)
        c.set('role',     staffRow.role as AppEnv['Variables']['role'])
        c.set('branchId', staffRow.branch_id)
      }
    } catch { /* ignore auth failures in optional mode */ }
  }

  await next()
}
