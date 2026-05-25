/**
 * Role-Based Access Control middleware for Hono.
 *
 * Role hierarchy (highest to lowest):
 *   clinic_owner (4) > branch_manager (3) > doctor (2) > receptionist (1)
 */
import type { MiddlewareHandler, Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { CloudRole }  from '@vorsa/types'
import type { AppEnv }     from '../app'

const ROLE_RANK: Record<CloudRole, number> = {
  clinic_owner:   4,
  branch_manager: 3,
  doctor:         2,
  receptionist:   1,
}

/**
 * Require the authenticated user to have one of the exact roles listed.
 */
export function requireRole(...allowed: CloudRole[]): MiddlewareHandler<AppEnv> {
  const allowedSet = new Set<string>(allowed)
  return async (c, next) => {
    const role = c.get('role')
    if (!role || !allowedSet.has(role)) {
      throw new HTTPException(403, {
        message: `Access denied. Required role: ${allowed.join(' or ')}`,
      })
    }
    await next()
  }
}

/**
 * Require the authenticated user to have AT LEAST the given role (hierarchy check).
 * E.g. requireMinRole('branch_manager') → allows branch_manager + clinic_owner
 */
export function requireMinRole(minRole: CloudRole): MiddlewareHandler<AppEnv> {
  const minRank = ROLE_RANK[minRole]
  return async (c, next) => {
    const role = c.get('role')
    if (!role || ROLE_RANK[role] < minRank) {
      throw new HTTPException(403, {
        message: `Access denied. Requires ${minRole} or higher.`,
      })
    }
    await next()
  }
}

/**
 * Enforce branch scope.
 * clinic_owner can pass ?branchId= to override.
 * Everyone else is automatically scoped to their assigned branch.
 */
export function requireBranchAccess(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const role = c.get('role')
    if (role !== 'clinic_owner') {
      // Non-owners can only see their own branch
      const staffBranchId = c.get('branchId')
      if (!staffBranchId) {
        throw new HTTPException(403, { message: 'No branch assigned to your account' })
      }
    }
    await next()
  }
}
