/**
 * Role-based access control (RBAC) middleware factory.
 *
 * Role hierarchy (higher rank ⊇ lower rank permissions):
 *   clinic_owner (4) > branch_manager (3) > doctor (2) > receptionist (1)
 *
 * Usage:
 *   router.delete('/branches/:id', authenticate, requireRole('clinic_owner'), handler)
 *   router.post('/staff',          authenticate, requireRole('clinic_owner', 'branch_manager'), handler)
 *   router.get('/appointments',    authenticate, requireMinRole('receptionist'), handler)
 */
import type { Request, Response, NextFunction } from 'express'
import type { CloudRole } from '../../shared/types'

/** Numeric rank per role — used for hierarchy comparisons. */
const ROLE_RANK: Record<CloudRole, number> = {
  clinic_owner:    4,
  branch_manager:  3,
  doctor:          2,
  receptionist:    1,
}

/**
 * Allow only the explicitly listed roles.
 * Attach **after** `authenticate` so req.role is guaranteed to be set.
 */
export function requireRole(...allowed: CloudRole[]) {
  const allowedSet = new Set(allowed)
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!allowedSet.has(req.role)) {
      res.status(403).json({ success: false, error: 'Forbidden: insufficient role' })
      return
    }
    next()
  }
}

/**
 * Allow any role whose rank is ≥ the minimum rank.
 * e.g. requireMinRole('doctor') allows doctor, branch_manager, clinic_owner.
 */
export function requireMinRole(minRole: CloudRole) {
  const minRank = ROLE_RANK[minRole]
  return (req: Request, res: Response, next: NextFunction): void => {
    if ((ROLE_RANK[req.role] ?? 0) < minRank) {
      res.status(403).json({ success: false, error: 'Forbidden: insufficient role' })
      return
    }
    next()
  }
}

/**
 * Ensure the authenticated staff member belongs to the branch referenced by
 * req.params.branchId (or req.body.branchId).  clinic_owner bypasses this
 * check since they have cross-branch visibility.
 */
export function requireBranchAccess(req: Request, res: Response, next: NextFunction): void {
  if (req.role === 'clinic_owner') {
    next()
    return
  }

  const targetBranchId = req.params['branchId'] ?? (req.body as Record<string, unknown>)['branchId']

  if (targetBranchId && req.branchId !== targetBranchId) {
    res.status(403).json({ success: false, error: 'Forbidden: branch access denied' })
    return
  }
  next()
}
