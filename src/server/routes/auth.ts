/**
 * Authentication routes — /api/v2/auth
 *
 * POST   /register   — Register a new clinic + owner account
 * POST   /login      — Email + password login; returns token pair
 * POST   /refresh    — Rotate refresh token; returns new access token
 * POST   /logout     — Revoke the current refresh token
 * GET    /me         — Return authenticated staff profile
 * PATCH  /me/password — Change own password
 */
import { Router } from 'express'
import { query, queryOne } from '../db/postgres'
import {
  issueTokenPair,
  verifyPassword,
  hashPassword,
  verifyRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
  revokeAllTokensForStaff,
} from '../services/authService'
import { registerClinic } from '../services/tenantService'
import { authenticate }   from '../middleware/auth'
import { validate }       from '../middleware/validate'
import { AppError }       from '../middleware/errorHandler'
import { auditFromRequest } from '../services/auditService'
import {
  RegisterClinicSchema,
  LoginSchema,
  RefreshTokenSchema,
  ChangePasswordSchema,
} from '../../shared/validationSchemas'
import type { CloudRole } from '../../shared/types'

const router = Router()

// ── POST /register ────────────────────────────────────────────────────────────

router.post('/register', validate(RegisterClinicSchema), async (req, res, next) => {
  try {
    const { clinicId, staffId } = await registerClinic(req.body)

    // Fetch the newly created staff member to build the session
    const staff = await queryOne<{
      id: string; clinic_id: string; branch_id: string | null; role: CloudRole
    }>(
      `SELECT id, clinic_id, branch_id, role FROM staff WHERE id = $1`,
      [staffId],
    )

    if (!staff) throw new AppError(500, 'Registration failed: staff not found after insert')

    const tokens = await issueTokenPair(staffId, clinicId, null, 'clinic_owner')

    void auditFromRequest(req, {
      clinicId,
      staffId,
      action:   'CREATE',
      entity:   'clinic',
      entityId: clinicId,
    })

    res.status(201).json({
      success: true,
      data:    { ...tokens, clinicId },
    })
  } catch (err) {
    // Postgres unique violation on slug
    if ((err as NodeJS.ErrnoException & { code?: string }).code === '23505') {
      next(new AppError(409, 'That clinic slug is already taken — please choose another'))
    } else {
      next(err)
    }
  }
})

// ── POST /login ───────────────────────────────────────────────────────────────

router.post('/login', validate(LoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as { email: string; password: string }

    const staff = await queryOne<{
      id: string; clinic_id: string; branch_id: string | null
      role: CloudRole; password_hash: string; is_active: boolean
    }>(
      `SELECT s.id, s.clinic_id, s.branch_id, s.role, s.password_hash, s.is_active
       FROM staff s
       JOIN clinics c ON c.id = s.clinic_id
       WHERE s.email = $1 AND c.is_active = true`,
      [email],
    )

    if (!staff || !(await verifyPassword(password, staff.password_hash))) {
      throw new AppError(401, 'Invalid email or password')
    }

    if (!staff.is_active) {
      throw new AppError(403, 'Account is deactivated — contact your clinic administrator')
    }

    const tokens = await issueTokenPair(
      staff.id,
      staff.clinic_id,
      staff.branch_id,
      staff.role,
    )

    void auditFromRequest(req, {
      clinicId: staff.clinic_id,
      staffId:  staff.id,
      action:   'LOGIN',
      entity:   'staff',
      entityId: staff.id,
    })

    res.json({ success: true, data: tokens })
  } catch (err) {
    next(err)
  }
})

// ── POST /refresh ─────────────────────────────────────────────────────────────

router.post('/refresh', validate(RefreshTokenSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string }

    let payload
    try {
      payload = verifyRefreshToken(refreshToken)
    } catch {
      throw new AppError(401, 'Invalid or expired refresh token')
    }

    const stored = await findValidRefreshToken(payload.jti)
    if (!stored) throw new AppError(401, 'Refresh token has been revoked')

    // Rotate — revoke old token and issue fresh pair
    await revokeRefreshToken(payload.jti)

    const staff = await queryOne<{
      id: string; clinic_id: string; branch_id: string | null; role: CloudRole; is_active: boolean
    }>(
      `SELECT id, clinic_id, branch_id, role, is_active FROM staff WHERE id = $1`,
      [payload.sub],
    )

    if (!staff || !staff.is_active) {
      throw new AppError(401, 'Account no longer active')
    }

    const tokens = await issueTokenPair(
      staff.id,
      staff.clinic_id,
      staff.branch_id,
      staff.role,
    )

    res.json({ success: true, data: tokens })
  } catch (err) {
    next(err)
  }
})

// ── POST /logout ──────────────────────────────────────────────────────────────

router.post('/logout', validate(RefreshTokenSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string }
    try {
      const payload = verifyRefreshToken(refreshToken)
      await revokeRefreshToken(payload.jti)
    } catch {
      // Best-effort — don't error if token is already invalid
    }
    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
})

// ── GET /me ───────────────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const staff = await queryOne(
      `SELECT id, clinic_id, branch_id, name, email, phone, role, designation, is_active, created_at
       FROM staff WHERE id = $1`,
      [req.staffId],
    )
    if (!staff) throw new AppError(404, 'Staff member not found')
    res.json({ success: true, data: staff })
  } catch (err) {
    next(err)
  }
})

// ── PATCH /me/password ────────────────────────────────────────────────────────

router.patch('/me/password', authenticate, validate(ChangePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string; newPassword: string
    }

    const staff = await queryOne<{ password_hash: string }>(
      `SELECT password_hash FROM staff WHERE id = $1`,
      [req.staffId],
    )
    if (!staff) throw new AppError(404, 'Staff member not found')

    if (!(await verifyPassword(currentPassword, staff.password_hash))) {
      throw new AppError(401, 'Current password is incorrect')
    }

    const newHash = await hashPassword(newPassword)
    await query(`UPDATE staff SET password_hash = $1 WHERE id = $2`, [newHash, req.staffId])

    // Revoke all refresh tokens so any other sessions are invalidated
    await revokeAllTokensForStaff(req.staffId)

    void auditFromRequest(req, {
      clinicId: req.clinicId,
      staffId:  req.staffId,
      action:   'PASSWORD_CHANGE',
      entity:   'staff',
      entityId: req.staffId,
    })

    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
})

export default router
