/**
 * Settings routes — /api/v2/settings
 *
 * GET    /clinic           — Get all clinic key-value settings
 * PATCH  /clinic           — Bulk-update clinic settings (clinic_owner only)
 *
 * GET    /treatments       — List treatment catalogue
 * POST   /treatments       — Create treatment
 * PATCH  /treatments/:id   — Update treatment
 * DELETE /treatments/:id   — Deactivate treatment
 *
 * GET    /custom-fields    — List patient custom fields
 * POST   /custom-fields    — Create / update a patient custom field
 * DELETE /custom-fields/:id — Delete a patient custom field
 *
 * GET    /audit-log        — Recent audit log entries (clinic_owner only)
 */
import { Router }     from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, withTransaction } from '../db/postgres'
import { authenticate }   from '../middleware/auth'
import { requireRole, requireMinRole } from '../middleware/rbac'
import { validate }       from '../middleware/validate'
import { AppError }       from '../middleware/errorHandler'
import { UpsertCustomFieldSchema } from '../../shared/validationSchemas'

const router = Router()
router.use(authenticate)

// ── Clinic settings ───────────────────────────────────────────────────────────

router.get('/clinic', async (req, res, next) => {
  try {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM clinic_settings WHERE clinic_id = $1
       AND key NOT LIKE '%_seq'
       ORDER BY key`,
      [req.clinicId],
    )
    // Transform array to plain object for convenience
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    res.json({ success: true, data: settings })
  } catch (err) { next(err) }
})

router.patch('/clinic', requireRole('clinic_owner'), async (req, res, next) => {
  try {
    const updates = req.body as Record<string, string>
    if (!updates || typeof updates !== 'object') {
      throw new AppError(422, 'Body must be a key-value object')
    }

    // Blocklist — these are system-managed counters, never user-editable
    const blocklist = new Set(['op_id_seq', 'invoice_seq'])
    const entries   = Object.entries(updates).filter(([k]) => !blocklist.has(k))

    await withTransaction(req.clinicId, async (client) => {
      for (const [key, value] of entries) {
        await client.query(
          `INSERT INTO clinic_settings (id, clinic_id, key, value)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (clinic_id, key) DO UPDATE SET value = EXCLUDED.value`,
          [randomUUID(), req.clinicId, key, String(value)],
        )
      }
    })

    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM clinic_settings WHERE clinic_id = $1 AND key NOT LIKE '%_seq'`,
      [req.clinicId],
    )
    res.json({
      success: true,
      data: Object.fromEntries(rows.map((r) => [r.key, r.value])),
    })
  } catch (err) { next(err) }
})

// ── Treatment catalogue ───────────────────────────────────────────────────────

router.get('/treatments', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, name, category, default_duration_minutes,
              default_price, is_active
       FROM treatments
       WHERE clinic_id = $1
       ORDER BY category, name`,
      [req.clinicId],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

router.post('/treatments', requireMinRole('branch_manager'), async (req, res, next) => {
  try {
    const { name, category, default_duration_minutes, default_price } = req.body as {
      name: string; category: string; default_duration_minutes: number; default_price: number
    }
    if (!name?.trim()) throw new AppError(422, 'Treatment name is required')

    const row = await queryOne(
      `INSERT INTO treatments
         (id, clinic_id, name, category, default_duration_minutes, default_price, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true)
       RETURNING id, name, category, default_duration_minutes, default_price, is_active`,
      [randomUUID(), req.clinicId, name.trim(), category,
       default_duration_minutes ?? 30, default_price ?? 0],
    )
    res.status(201).json({ success: true, data: row })
  } catch (err) { next(err) }
})

router.patch('/treatments/:id', requireMinRole('branch_manager'), async (req, res, next) => {
  try {
    const { name, category, default_duration_minutes, default_price, is_active } = req.body as Partial<{
      name: string; category: string; default_duration_minutes: number
      default_price: number; is_active: boolean
    }>

    const updated = await queryOne(
      `UPDATE treatments SET
         name                     = COALESCE($1, name),
         category                 = COALESCE($2, category),
         default_duration_minutes = COALESCE($3, default_duration_minutes),
         default_price            = COALESCE($4, default_price),
         is_active                = COALESCE($5, is_active)
       WHERE id = $6 AND clinic_id = $7
       RETURNING id, name, category, default_duration_minutes, default_price, is_active`,
      [name, category, default_duration_minutes, default_price, is_active,
       req.params['id'], req.clinicId],
    )
    if (!updated) throw new AppError(404, 'Treatment not found')
    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

router.delete('/treatments/:id', requireMinRole('branch_manager'), async (req, res, next) => {
  try {
    const deleted = await queryOne(
      `UPDATE treatments SET is_active = false WHERE id = $1 AND clinic_id = $2 RETURNING id`,
      [req.params['id'], req.clinicId],
    )
    if (!deleted) throw new AppError(404, 'Treatment not found')
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

// ── Patient custom fields ─────────────────────────────────────────────────────

router.get('/custom-fields', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, entity_type, label, field_type, options,
              is_required, sort_order, is_active
       FROM custom_fields
       WHERE clinic_id = $1 AND entity_type = 'patient'
       ORDER BY sort_order, label`,
      [req.clinicId],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

router.post(
  '/custom-fields',
  requireMinRole('branch_manager'),
  validate(UpsertCustomFieldSchema),
  async (req, res, next) => {
    try {
      const { label, field_type, options, is_required, sort_order, is_active } = req.body as {
        entity_type: string; label: string; field_type: string
        options?: string[]; is_required: boolean; sort_order: number; is_active: boolean
      }
      const row = await queryOne(
        `INSERT INTO custom_fields
           (id, clinic_id, entity_type, label, field_type, options,
            is_required, sort_order, is_active)
         VALUES ($1,$2,'patient',$3,$4,$5,$6,$7,$8)
         RETURNING id, entity_type, label, field_type, options,
                   is_required, sort_order, is_active`,
        [randomUUID(), req.clinicId, label, field_type,
         options ? JSON.stringify(options) : null,
         is_required, sort_order, is_active],
      )
      res.status(201).json({ success: true, data: row })
    } catch (err) { next(err) }
  },
)

router.delete('/custom-fields/:id', requireMinRole('branch_manager'), async (req, res, next) => {
  try {
    const deleted = await queryOne(
      `DELETE FROM custom_fields WHERE id = $1 AND clinic_id = $2 AND entity_type = 'patient' RETURNING id`,
      [req.params['id'], req.clinicId],
    )
    if (!deleted) throw new AppError(404, 'Custom field not found')
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

// ── Audit log ─────────────────────────────────────────────────────────────────

router.get('/audit-log', requireRole('clinic_owner'), async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt((req.query['limit'] as string) ?? '100', 10), 500)
    const offset = parseInt((req.query['offset'] as string) ?? '0', 10)

    const rows = await query(
      `SELECT al.id, al.action, al.entity, al.entity_id,
              al.diff, al.ip_address, al.created_at,
              s.name AS staff_name, s.role AS staff_role
       FROM audit_logs al
       LEFT JOIN staff s ON s.id = al.staff_id
       WHERE al.clinic_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.clinicId, limit, offset],
    )

    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_logs WHERE clinic_id = $1`,
      [req.clinicId],
    )

    res.json({
      success: true,
      data: rows,
      meta: { total: parseInt(countRow?.count ?? '0', 10), limit, offset },
    })
  } catch (err) { next(err) }
})

export default router
