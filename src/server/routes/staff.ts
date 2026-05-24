/**
 * Staff management routes — /api/v2/staff
 *
 * GET    /          — List staff (optionally filtered by branchId query param)
 * POST   /          — Create staff member (clinic_owner / branch_manager)
 * GET    /:id       — Get a single staff member
 * PATCH  /:id       — Update staff member
 * DELETE /:id       — Deactivate staff member (clinic_owner only)
 */
import { Router }     from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, withTransaction } from '../db/postgres'
import { authenticate }  from '../middleware/auth'
import { requireRole, requireMinRole } from '../middleware/rbac'
import { planGuard }     from '../middleware/planGuard'
import { validate }      from '../middleware/validate'
import { AppError }      from '../middleware/errorHandler'
import { hashPassword }  from '../services/authService'
import { auditFromRequest } from '../services/auditService'
import {
  CreateStaffSchema,
  UpdateStaffSchema,
} from '../../shared/validationSchemas'

const router = Router()
router.use(authenticate)

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const branchId = req.query['branchId'] as string | undefined

    // branch_manager can only see staff in their own branch
    const effectiveBranchId =
      req.role === 'clinic_owner'
        ? branchId ?? null
        : req.branchId

    const rows = await query(
      `SELECT id, clinic_id, branch_id, name, email, phone, role,
              designation, is_active, created_at
       FROM staff
       WHERE clinic_id   = $1
         AND ($2::uuid IS NULL OR branch_id = $2)
         AND is_active   = true
       ORDER BY name`,
      [req.clinicId, effectiveBranchId],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

// ── POST / ────────────────────────────────────────────────────────────────────

router.post('/', requireMinRole('branch_manager'), planGuard('doctor'), validate(CreateStaffSchema), async (req, res, next) => {
  try {
    const {
      branch_id, name, email, password, phone,
      role, designation, is_active,
    } = req.body as {
      branch_id: string | null; name: string; email: string; password: string
      phone?: string; role: string; designation?: string; is_active: boolean
    }

    // branch_manager can only create staff for their own branch
    if (req.role === 'branch_manager') {
      if (role === 'clinic_owner' || role === 'branch_manager') {
        throw new AppError(403, 'Branch managers cannot create owner or manager accounts')
      }
      if (branch_id && branch_id !== req.branchId) {
        throw new AppError(403, 'Branch managers can only add staff to their own branch')
      }
    }

    const passwordHash = await hashPassword(password)
    const id = randomUUID()

    const staff = await withTransaction(req.clinicId, async (client) => {
      const { rows } = await client.query<Record<string, unknown>>(
        `INSERT INTO staff
           (id, clinic_id, branch_id, name, email, phone, role,
            designation, password_hash, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, clinic_id, branch_id, name, email, phone,
                   role, designation, is_active, created_at`,
        [id, req.clinicId, branch_id ?? null, name, email,
         phone ?? null, role, designation ?? null, passwordHash, is_active],
      )
      return rows[0]
    })

    void auditFromRequest(req, {
      clinicId: req.clinicId, staffId: req.staffId,
      action: 'CREATE', entity: 'staff', entityId: id,
    })

    res.status(201).json({ success: true, data: staff })
  } catch (err) {
    if ((err as NodeJS.ErrnoException & { code?: string }).code === '23505') {
      next(new AppError(409, 'A staff member with that email already exists'))
    } else {
      next(err)
    }
  }
})

// ── GET /:id ──────────────────────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const staff = await queryOne(
      `SELECT id, clinic_id, branch_id, name, email, phone, role,
              designation, is_active, created_at
       FROM staff WHERE id = $1 AND clinic_id = $2`,
      [req.params['id'], req.clinicId],
    )
    if (!staff) throw new AppError(404, 'Staff member not found')

    // branch_manager can only see their own branch's staff
    const staffRow = staff as Record<string, unknown>
    if (
      req.role === 'branch_manager' &&
      staffRow['branch_id'] !== req.branchId &&
      staffRow['id'] !== req.staffId
    ) {
      throw new AppError(403, 'Forbidden: branch access denied')
    }

    res.json({ success: true, data: staff })
  } catch (err) { next(err) }
})

// ── PATCH /:id ────────────────────────────────────────────────────────────────

router.patch('/:id', requireMinRole('branch_manager'), validate(UpdateStaffSchema), async (req, res, next) => {
  try {
    const { name, branch_id, phone, role, designation, is_active } = req.body as Partial<{
      name: string; branch_id: string | null; phone: string; role: string
      designation: string; is_active: boolean
    }>

    // Prevent branch_manager from promoting someone to a higher/equal role
    if (req.role === 'branch_manager') {
      if (role === 'clinic_owner' || role === 'branch_manager') {
        throw new AppError(403, 'Branch managers cannot assign owner or manager roles')
      }
    }

    const updated = await queryOne(
      `UPDATE staff
       SET name        = COALESCE($1, name),
           branch_id   = COALESCE($2, branch_id),
           phone       = COALESCE($3, phone),
           role        = COALESCE($4, role),
           designation = COALESCE($5, designation),
           is_active   = COALESCE($6, is_active)
       WHERE id = $7 AND clinic_id = $8
       RETURNING id, clinic_id, branch_id, name, email, phone,
                 role, designation, is_active, created_at`,
      [name, branch_id, phone, role, designation, is_active,
       req.params['id'], req.clinicId],
    )
    if (!updated) throw new AppError(404, 'Staff member not found')

    void auditFromRequest(req, {
      clinicId: req.clinicId, staffId: req.staffId,
      action: 'UPDATE', entity: 'staff', entityId: req.params['id'],
    })

    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

// ── DELETE /:id ───────────────────────────────────────────────────────────────

router.delete('/:id', requireRole('clinic_owner'), async (req, res, next) => {
  try {
    if (req.params['id'] === req.staffId) {
      throw new AppError(400, 'Cannot deactivate your own account')
    }

    const updated = await queryOne(
      `UPDATE staff SET is_active = false
       WHERE id = $1 AND clinic_id = $2
       RETURNING id`,
      [req.params['id'], req.clinicId],
    )
    if (!updated) throw new AppError(404, 'Staff member not found')

    void auditFromRequest(req, {
      clinicId: req.clinicId, staffId: req.staffId,
      action: 'DELETE', entity: 'staff', entityId: req.params['id'],
    })
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

export default router
