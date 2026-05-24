/**
 * Augment Express.Request with fields injected by auth middleware.
 * Every authenticated route handler can access req.clinicId, req.staffId etc.
 */
import type { CloudRole } from '../../shared/types'

declare global {
  namespace Express {
    interface Request {
      /** UUID of the authenticated clinic (tenant) */
      clinicId: string
      /** UUID of the authenticated staff member */
      staffId: string
      /** Role of the authenticated staff member */
      role: CloudRole
      /** UUID of the branch this staff member belongs to (null for clinic_owner) */
      branchId: string | null
    }
  }
}
