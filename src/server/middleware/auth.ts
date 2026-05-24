/**
 * JWT authentication middleware.
 * Verifies the Bearer token, decodes the payload, and attaches
 * clinicId / staffId / role / branchId to req for use by all downstream handlers.
 */
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config'
import type { CloudRole } from '../../shared/types'

interface JwtPayload {
  sub: string          // staffId (UUID)
  clinicId: string
  branchId: string | null
  role: CloudRole
  iat: number
  exp: number
}

/**
 * Full authentication — requires a valid, non-expired access token.
 * Populates req.staffId, req.clinicId, req.branchId, req.role.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
    req.staffId  = payload.sub
    req.clinicId = payload.clinicId
    req.branchId = payload.branchId
    req.role     = payload.role
    next()
  } catch (err) {
    const message =
      err instanceof jwt.TokenExpiredError ? 'Token expired' :
      err instanceof jwt.JsonWebTokenError ? 'Invalid token' :
      'Authentication failed'
    res.status(401).json({ success: false, error: message })
  }
}

/**
 * Optional authentication — does not fail if no token is present.
 * Useful for public routes that behave differently for authenticated users.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET) as JwtPayload
      req.staffId  = payload.sub
      req.clinicId = payload.clinicId
      req.branchId = payload.branchId
      req.role     = payload.role
    } catch {
      // Ignore invalid token for optional auth
    }
  }
  next()
}
