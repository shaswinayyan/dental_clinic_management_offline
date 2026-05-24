/**
 * Branch management routes — /api/v2/branches
 *
 * GET    /                     — List all branches for the clinic
 * POST   /                     — Create a new branch (clinic_owner only)
 * GET    /:id                  — Get a single branch
 * PATCH  /:id                  — Update branch details
 * DELETE /:id                  — Deactivate a branch
 *
 * GET    /:id/working-hours    — Get working hours for a branch
 * PUT    /:id/working-hours    — Bulk-replace working hours (7 days)
 *
 * GET    /:id/appt-config      — Get appointment configuration
 * PATCH  /:id/appt-config      — Update appointment configuration
 *
 * GET    /:id/chairs           — List chairs
 * POST   /:id/chairs           — Create a chair
 * PATCH  /:id/chairs/:chairId  — Update a chair
 * DELETE /:id/chairs/:chairId  — Delete a chair
 *
 * GET    /:id/custom-statuses  — List custom appointment statuses
 * POST   /:id/custom-statuses  — Create a custom status
 * PATCH  /:id/custom-statuses/:sid — Update a custom status
 * DELETE /:id/custom-statuses/:sid — Delete a custom status
 */
import { Router }        from 'express'
import { randomUUID }    from 'crypto'
import { query, queryOne, withTransaction } from '../db/postgres'
import { authenticate }  from '../middleware/auth'
import { requireRole, requireMinRole } from '../middleware/rbac'
import { planGuard }     from '../middleware/planGuard'
import { validate }      from '../middleware/validate'
import { AppError }      from '../middleware/errorHandler'
import { auditFromRequest } from '../services/auditService'
import {
  CreateBranchSchema,
  UpdateBranchSchema,
  BulkWorkingHoursSchema,
  UpdateApptConfigSchema,
  CreateCustomStatusSchema,
} from '../../shared/validationSchemas'

const router = Router()

// All branch routes require authentication
router.use(authenticate)

// ── Branch CRUD ───────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const branches = await query(
      `SELECT id, name, address, phone, is_active, created_at
       FROM branches WHERE clinic_id = $1 ORDER BY name`,
      [req.clinicId],
    )
    res.json({ success: true, data: branches })
  } catch (err) { next(err) }
})

router.post('/', requireRole('clinic_owner'), planGuard('branch'), validate(CreateBranchSchema), async (req, res, next) => {
  try {
    const id = randomUUID()
    const { name, address, phone, is_active } = req.body as {
      name: string; address?: string; phone?: string; is_active: boolean
    }

    const branch = await withTransaction(req.clinicId, async (client) => {
      const { rows } = await client.query<Record<string, unknown>>(
        `INSERT INTO branches (id, clinic_id, name, address, phone, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, address, phone, is_active, created_at`,
        [id, req.clinicId, name, address ?? null, phone ?? null, is_active],
      )
      return rows[0]
    })

    void auditFromRequest(req, {
      clinicId: req.clinicId, staffId: req.staffId,
      action: 'CREATE', entity: 'branch', entityId: id,
    })
    res.status(201).json({ success: true, data: branch })
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const branch = await queryOne(
      `SELECT id, name, address, phone, is_active, created_at
       FROM branches WHERE id = $1 AND clinic_id = $2`,
      [req.params['id'], req.clinicId],
    )
    if (!branch) throw new AppError(404, 'Branch not found')
    res.json({ success: true, data: branch })
  } catch (err) { next(err) }
})

router.patch('/:id', requireRole('clinic_owner'), validate(UpdateBranchSchema), async (req, res, next) => {
  try {
    const { name, address, phone, is_active } = req.body as Partial<{
      name: string; address: string; phone: string; is_active: boolean
    }>

    const existing = await queryOne(
      `SELECT id FROM branches WHERE id = $1 AND clinic_id = $2`,
      [req.params['id'], req.clinicId],
    )
    if (!existing) throw new AppError(404, 'Branch not found')

    const updated = await queryOne(
      `UPDATE branches
       SET name      = COALESCE($1, name),
           address   = COALESCE($2, address),
           phone     = COALESCE($3, phone),
           is_active = COALESCE($4, is_active)
       WHERE id = $5 AND clinic_id = $6
       RETURNING id, name, address, phone, is_active, created_at`,
      [name, address, phone, is_active, req.params['id'], req.clinicId],
    )

    void auditFromRequest(req, {
      clinicId: req.clinicId, staffId: req.staffId,
      action: 'UPDATE', entity: 'branch', entityId: req.params['id'],
    })
    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole('clinic_owner'), async (req, res, next) => {
  try {
    const updated = await queryOne(
      `UPDATE branches SET is_active = false
       WHERE id = $1 AND clinic_id = $2
       RETURNING id`,
      [req.params['id'], req.clinicId],
    )
    if (!updated) throw new AppError(404, 'Branch not found')

    void auditFromRequest(req, {
      clinicId: req.clinicId, staffId: req.staffId,
      action: 'DELETE', entity: 'branch', entityId: req.params['id'],
    })
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

// ── Working hours ─────────────────────────────────────────────────────────────

router.get('/:id/working-hours', async (req, res, next) => {
  try {
    const hours = await query(
      `SELECT id, day_of_week, open_time, close_time, is_open
       FROM branch_working_hours
       WHERE branch_id = $1 AND clinic_id = $2
       ORDER BY day_of_week`,
      [req.params['id'], req.clinicId],
    )
    res.json({ success: true, data: hours })
  } catch (err) { next(err) }
})

router.put(
  '/:id/working-hours',
  requireMinRole('branch_manager'),
  validate(BulkWorkingHoursSchema),
  async (req, res, next) => {
    try {
      const branchId = req.params['id']
      const days = req.body as Array<{
        day_of_week: number; open_time: string; close_time: string; is_open: boolean
      }>

      await withTransaction(req.clinicId, async (client) => {
        await client.query(
          `DELETE FROM branch_working_hours WHERE branch_id = $1 AND clinic_id = $2`,
          [branchId, req.clinicId],
        )
        for (const day of days) {
          await client.query(
            `INSERT INTO branch_working_hours
               (id, clinic_id, branch_id, day_of_week, open_time, close_time, is_open)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [randomUUID(), req.clinicId, branchId,
             day.day_of_week, day.open_time, day.close_time, day.is_open],
          )
        }
      })

      const updated = await query(
        `SELECT id, day_of_week, open_time, close_time, is_open
         FROM branch_working_hours WHERE branch_id = $1 ORDER BY day_of_week`,
        [branchId],
      )
      res.json({ success: true, data: updated })
    } catch (err) { next(err) }
  },
)

// ── Appointment configuration ─────────────────────────────────────────────────

router.get('/:id/appt-config', async (req, res, next) => {
  try {
    const config = await queryOne(
      `SELECT id, booking_mode, slot_duration_mins, advance_booking_days, allow_walk_in
       FROM appt_config WHERE branch_id = $1 AND clinic_id = $2`,
      [req.params['id'], req.clinicId],
    )
    if (!config) throw new AppError(404, 'Appointment config not found for this branch')
    res.json({ success: true, data: config })
  } catch (err) { next(err) }
})

router.patch(
  '/:id/appt-config',
  requireMinRole('branch_manager'),
  validate(UpdateApptConfigSchema),
  async (req, res, next) => {
    try {
      const { booking_mode, slot_duration_mins, advance_booking_days, allow_walk_in } = req.body as Partial<{
        booking_mode: string; slot_duration_mins: number; advance_booking_days: number; allow_walk_in: boolean
      }>

      const updated = await queryOne(
        `UPDATE appt_config
         SET booking_mode          = COALESCE($1, booking_mode),
             slot_duration_mins    = COALESCE($2, slot_duration_mins),
             advance_booking_days  = COALESCE($3, advance_booking_days),
             allow_walk_in         = COALESCE($4, allow_walk_in)
         WHERE branch_id = $5 AND clinic_id = $6
         RETURNING id, booking_mode, slot_duration_mins, advance_booking_days, allow_walk_in`,
        [booking_mode, slot_duration_mins, advance_booking_days, allow_walk_in,
         req.params['id'], req.clinicId],
      )
      if (!updated) throw new AppError(404, 'Appointment config not found')
      res.json({ success: true, data: updated })
    } catch (err) { next(err) }
  },
)

// ── Chairs ────────────────────────────────────────────────────────────────────

router.get('/:id/chairs', async (req, res, next) => {
  try {
    const chairs = await query(
      `SELECT id, name, is_active FROM chairs
       WHERE branch_id = $1 AND clinic_id = $2 ORDER BY name`,
      [req.params['id'], req.clinicId],
    )
    res.json({ success: true, data: chairs })
  } catch (err) { next(err) }
})

router.post('/:id/chairs', requireMinRole('branch_manager'), planGuard('chair'), async (req, res, next) => {
  try {
    const { name } = req.body as { name: string }
    if (!name?.trim()) throw new AppError(422, 'Chair name is required')

    const chair = await queryOne(
      `INSERT INTO chairs (id, clinic_id, branch_id, name, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, name, is_active`,
      [randomUUID(), req.clinicId, req.params['id'], name.trim()],
    )
    res.status(201).json({ success: true, data: chair })
  } catch (err) { next(err) }
})

router.patch('/:id/chairs/:chairId', requireMinRole('branch_manager'), async (req, res, next) => {
  try {
    const { name, is_active } = req.body as { name?: string; is_active?: boolean }
    const updated = await queryOne(
      `UPDATE chairs
       SET name      = COALESCE($1, name),
           is_active = COALESCE($2, is_active)
       WHERE id = $3 AND branch_id = $4 AND clinic_id = $5
       RETURNING id, name, is_active`,
      [name, is_active, req.params['chairId'], req.params['id'], req.clinicId],
    )
    if (!updated) throw new AppError(404, 'Chair not found')
    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

router.delete('/:id/chairs/:chairId', requireMinRole('branch_manager'), async (req, res, next) => {
  try {
    const deleted = await queryOne(
      `DELETE FROM chairs WHERE id = $1 AND branch_id = $2 AND clinic_id = $3 RETURNING id`,
      [req.params['chairId'], req.params['id'], req.clinicId],
    )
    if (!deleted) throw new AppError(404, 'Chair not found')
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

// ── Custom appointment statuses ───────────────────────────────────────────────

router.get('/:id/custom-statuses', async (req, res, next) => {
  try {
    const statuses = await query(
      `SELECT id, label, color, sort_order, is_default
       FROM appt_custom_statuses
       WHERE branch_id = $1 AND clinic_id = $2
       ORDER BY sort_order, label`,
      [req.params['id'], req.clinicId],
    )
    res.json({ success: true, data: statuses })
  } catch (err) { next(err) }
})

router.post(
  '/:id/custom-statuses',
  requireMinRole('branch_manager'),
  validate(CreateCustomStatusSchema),
  async (req, res, next) => {
    try {
      const { label, color, sort_order, is_default } = req.body as {
        label: string; color: string; sort_order: number; is_default: boolean
      }
      const status = await queryOne(
        `INSERT INTO appt_custom_statuses
           (id, clinic_id, branch_id, label, color, sort_order, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, label, color, sort_order, is_default`,
        [randomUUID(), req.clinicId, req.params['id'],
         label, color, sort_order, is_default],
      )
      res.status(201).json({ success: true, data: status })
    } catch (err) { next(err) }
  },
)

router.patch(
  '/:id/custom-statuses/:sid',
  requireMinRole('branch_manager'),
  validate(CreateCustomStatusSchema.partial()),
  async (req, res, next) => {
    try {
      const { label, color, sort_order, is_default } = req.body as Partial<{
        label: string; color: string; sort_order: number; is_default: boolean
      }>
      const updated = await queryOne(
        `UPDATE appt_custom_statuses
         SET label      = COALESCE($1, label),
             color      = COALESCE($2, color),
             sort_order = COALESCE($3, sort_order),
             is_default = COALESCE($4, is_default)
         WHERE id = $5 AND branch_id = $6 AND clinic_id = $7
         RETURNING id, label, color, sort_order, is_default`,
        [label, color, sort_order, is_default,
         req.params['sid'], req.params['id'], req.clinicId],
      )
      if (!updated) throw new AppError(404, 'Custom status not found')
      res.json({ success: true, data: updated })
    } catch (err) { next(err) }
  },
)

router.delete('/:id/custom-statuses/:sid', requireMinRole('branch_manager'), async (req, res, next) => {
  try {
    const deleted = await queryOne(
      `DELETE FROM appt_custom_statuses
       WHERE id = $1 AND branch_id = $2 AND clinic_id = $3
       RETURNING id`,
      [req.params['sid'], req.params['id'], req.clinicId],
    )
    if (!deleted) throw new AppError(404, 'Custom status not found')
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

export default router
