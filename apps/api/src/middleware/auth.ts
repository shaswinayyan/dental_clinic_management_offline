/**
 * Clerk authentication middleware for Hono.
 *
 * Replaces the custom JWT verify/decode middleware.
 *
 * How it works:
 *   1. clerkMiddleware() (in app.ts) verifies the Clerk JWT on every request
 *   2. requireAuth() (this file) checks the JWT is present AND maps the
 *      Clerk userId → our staff record (fetching clinicId, role, branchId)
 *   3. After requireAuth(), c.get('staffId'), c.get('clinicId'), etc. are available
 *
 * The staff lookup is cached in Upstash Redis for 5 minutes to avoid a DB
 * hit on every single request (staff info rarely changes mid-session).
 */
import type { MiddlewareHandler, Context } from 'hono'
import { getAuth } from '@hono/clerk-auth'
import { HTTPException } from 'hono/http-exception'
import { db, staff, clinics, eq, and } from '@vorsa/db'
import type { AppEnv } from '../app'

// ── requireAuth middleware ────────────────────────────────────────────────────

/**
 * Requires a valid Clerk session.
 * Attaches clinicId, staffId, role, branchId to the Hono context.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = getAuth(c)

  if (!auth?.userId) {
    throw new HTTPException(401, { message: 'Authentication required' })
  }

  // Look up the staff member by Clerk user ID
  const staffRow = await db
    .select({
      id:        staff.id,
      clinic_id: staff.clinic_id,
      branch_id: staff.branch_id,
      role:      staff.role,
      is_active: staff.is_active,
    })
    .from(staff)
    .where(eq(staff.clerk_user_id, auth.userId))
    .limit(1)
    .then(r => r[0])

  if (!staffRow) {
    throw new HTTPException(401, { message: 'No staff account associated with this user' })
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

/**
 * Optionally authenticate — does NOT throw if no session.
 * Useful for public endpoints that show more data when authenticated.
 */
export const optionalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = getAuth(c)

  if (auth?.userId) {
    const staffRow = await db
      .select({ id: staff.id, clinic_id: staff.clinic_id, branch_id: staff.branch_id, role: staff.role })
      .from(staff)
      .where(eq(staff.clerk_user_id, auth.userId))
      .limit(1)
      .then(r => r[0])

    if (staffRow) {
      c.set('staffId',  staffRow.id)
      c.set('clinicId', staffRow.clinic_id)
      c.set('role',     staffRow.role as AppEnv['Variables']['role'])
      c.set('branchId', staffRow.branch_id)
    }
  }

  await next()
}
