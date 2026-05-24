/**
 * Appointment routes — /api/v2/appointments
 *
 * GET    /             — List appointments (filterable by date/branch/doctor/status)
 * POST   /             — Create appointment
 * GET    /:id          — Get single appointment with custom field values
 * PATCH  /:id          — Update appointment (status, notes, reschedule, custom fields)
 * DELETE /:id          — Cancel / delete appointment
 *
 * GET    /slots        — Available time slots for a branch/chair/date (slot mode)
 * GET    /token-count  — Current token count for a branch/date (token mode)
 *
 * GET    /custom-fields — List custom appointment fields for the clinic
 * POST   /custom-fields — Create / update a custom field
 * DELETE /custom-fields/:fid — Delete a custom field
 */
import { Router }     from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, withTransaction } from '../db/postgres'
import { authenticate }     from '../middleware/auth'
import { requireMinRole }   from '../middleware/rbac'
import { validate }         from '../middleware/validate'
import { AppError }         from '../middleware/errorHandler'
import { auditFromRequest } from '../services/auditService'
import {
  CreateAppointmentSchema,
  UpdateAppointmentSchema,
  UpsertCustomFieldSchema,
} from '../../shared/validationSchemas'

const router = Router()
router.use(authenticate)

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const {
      date, branchId, doctorId, status,
    } = req.query as Record<string, string | undefined>

    // branch_manager / doctor / receptionist scoped to their branch
    const effectiveBranchId =
      req.role === 'clinic_owner' ? branchId ?? null : req.branchId

    const rows = await query(
      `SELECT a.id, a.branch_id, b.name AS branch_name,
              a.patient_id, p.name AS patient_name, p.op_id AS patient_op_id,
              p.contact_number AS patient_contact_number,
              a.chair_id, c.name AS chair_name,
              a.treatment_id, t.name AS treatment_name,
              a.doctor_id, s.name AS doctor_name,
              a.scheduled_at, a.duration_minutes,
              a.status, a.custom_status, a.notes, a.created_at
       FROM appointments a
       JOIN branches  b ON b.id = a.branch_id
       JOIN patients  p ON p.id = a.patient_id
       JOIN chairs    c ON c.id = a.chair_id
       JOIN treatments t ON t.id = a.treatment_id
       LEFT JOIN staff s ON s.id = a.doctor_id
       WHERE a.clinic_id = $1
         AND ($2::uuid IS NULL OR a.branch_id = $2)
         AND ($3::date IS NULL OR a.scheduled_at::date = $3::date)
         AND ($4::uuid IS NULL OR a.doctor_id  = $4)
         AND ($5::text IS NULL OR a.status     = $5)
       ORDER BY a.scheduled_at`,
      [req.clinicId, effectiveBranchId, date ?? null, doctorId ?? null, status ?? null],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

// ── GET /slots — available slots for slot-mode booking ────────────────────────

router.get('/slots', async (req, res, next) => {
  try {
    const { branchId, chairId, date } = req.query as Record<string, string>
    if (!branchId || !chairId || !date) {
      throw new AppError(422, 'branchId, chairId, and date are required')
    }

    const config = await queryOne<{
      booking_mode: string; slot_duration_mins: number; open_time?: string; close_time?: string
    }>(
      `SELECT ac.booking_mode, ac.slot_duration_mins,
              wh.open_time, wh.close_time
       FROM appt_config ac
       LEFT JOIN branch_working_hours wh
         ON wh.branch_id = ac.branch_id
        AND wh.clinic_id = ac.clinic_id
        AND wh.day_of_week = EXTRACT(DOW FROM $3::date)::int
        AND wh.is_open = true
       WHERE ac.branch_id = $1 AND ac.clinic_id = $2`,
      [branchId, req.clinicId, date],
    )

    if (!config || config.booking_mode !== 'slot') {
      throw new AppError(400, 'This branch does not use slot-based booking')
    }
    if (!config.open_time || !config.close_time) {
      res.json({ success: true, data: [] }) // closed day
      return
    }

    // Fetch booked slots for this chair/date
    const booked = await query<{ scheduled_at: string; duration_minutes: number }>(
      `SELECT scheduled_at, duration_minutes FROM appointments
       WHERE clinic_id = $1 AND chair_id = $2
         AND scheduled_at::date = $3::date
         AND status NOT IN ('cancelled')`,
      [req.clinicId, chairId, date],
    )

    const slots = generateSlots(
      date,
      config.open_time,
      config.close_time,
      config.slot_duration_mins,
      booked,
    )
    res.json({ success: true, data: slots })
  } catch (err) { next(err) }
})

// ── GET /token-count ──────────────────────────────────────────────────────────

router.get('/token-count', async (req, res, next) => {
  try {
    const { branchId, date } = req.query as Record<string, string>
    if (!branchId || !date) throw new AppError(422, 'branchId and date are required')

    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM appointments
       WHERE clinic_id = $1 AND branch_id = $2
         AND scheduled_at::date = $3::date
         AND status NOT IN ('cancelled')`,
      [req.clinicId, branchId, date],
    )
    res.json({ success: true, data: { count: parseInt(row?.count ?? '0', 10) } })
  } catch (err) { next(err) }
})

// ── GET /custom-fields ────────────────────────────────────────────────────────

router.get('/custom-fields', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, entity_type, label, field_type, options, is_required, sort_order, is_active
       FROM custom_fields
       WHERE clinic_id = $1 AND entity_type = 'appointment' AND is_active = true
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
         VALUES ($1,$2,'appointment',$3,$4,$5,$6,$7,$8)
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

router.delete('/custom-fields/:fid', requireMinRole('branch_manager'), async (req, res, next) => {
  try {
    const deleted = await queryOne(
      `DELETE FROM custom_fields WHERE id = $1 AND clinic_id = $2 AND entity_type = 'appointment' RETURNING id`,
      [req.params['fid'], req.clinicId],
    )
    if (!deleted) throw new AppError(404, 'Custom field not found')
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

// ── POST / ────────────────────────────────────────────────────────────────────

router.post('/', validate(CreateAppointmentSchema), async (req, res, next) => {
  try {
    const {
      branch_id, patient_id, chair_id, treatment_id, doctor_id,
      scheduled_at, duration_minutes, notes, custom_status, custom_fields,
    } = req.body as {
      branch_id: string; patient_id: string; chair_id: string; treatment_id: string
      doctor_id: string; scheduled_at: string; duration_minutes: number; notes?: string
      custom_status?: string; custom_fields?: Record<string, unknown>
    }

    const id = randomUUID()

    const appt = await withTransaction(req.clinicId, async (client) => {
      const { rows } = await client.query<Record<string, unknown>>(
        `INSERT INTO appointments
           (id, clinic_id, branch_id, patient_id, chair_id, treatment_id,
            doctor_id, scheduled_at, duration_minutes, status,
            custom_status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'scheduled',$10,$11)
         RETURNING id, patient_id, chair_id, treatment_id, doctor_id,
                   scheduled_at, duration_minutes, status,
                   custom_status, notes, created_at`,
        [id, req.clinicId, branch_id, patient_id, chair_id, treatment_id,
         doctor_id, scheduled_at, duration_minutes,
         custom_status ?? null, notes ?? null],
      )

      // Persist any custom field values
      if (custom_fields) {
        for (const [fieldId, value] of Object.entries(custom_fields)) {
          await client.query(
            `INSERT INTO custom_field_values
               (id, clinic_id, field_id, entity_id, value)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (field_id, entity_id) DO UPDATE SET value = EXCLUDED.value`,
            [randomUUID(), req.clinicId, fieldId, id, String(value)],
          )
        }
      }
      return rows[0]
    })

    void auditFromRequest(req, {
      clinicId: req.clinicId, staffId: req.staffId,
      action: 'CREATE', entity: 'appointment', entityId: id,
    })
    res.status(201).json({ success: true, data: appt })
  } catch (err) { next(err) }
})

// ── GET /:id ──────────────────────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const appt = await queryOne(
      `SELECT a.*,
              p.name AS patient_name, p.op_id AS patient_op_id,
              p.contact_number AS patient_contact_number,
              c.name AS chair_name, t.name AS treatment_name,
              s.name AS doctor_name,
              array_agg(DISTINCT jsonb_build_object(
                'field_id', cfv.field_id,
                'label', cf.label,
                'value', cfv.value
              )) FILTER (WHERE cfv.id IS NOT NULL) AS custom_fields
       FROM appointments a
       JOIN patients p   ON p.id = a.patient_id
       JOIN chairs c     ON c.id = a.chair_id
       JOIN treatments t ON t.id = a.treatment_id
       LEFT JOIN staff s ON s.id = a.doctor_id
       LEFT JOIN custom_field_values cfv ON cfv.entity_id = a.id
       LEFT JOIN custom_fields cf ON cf.id = cfv.field_id
       WHERE a.id = $1 AND a.clinic_id = $2
       GROUP BY a.id, p.name, p.op_id, p.contact_number,
                c.name, t.name, s.name`,
      [req.params['id'], req.clinicId],
    )
    if (!appt) throw new AppError(404, 'Appointment not found')
    res.json({ success: true, data: appt })
  } catch (err) { next(err) }
})

// ── PATCH /:id ────────────────────────────────────────────────────────────────

router.patch('/:id', validate(UpdateAppointmentSchema), async (req, res, next) => {
  try {
    const {
      status, notes, scheduled_at, duration_minutes,
      chair_id, doctor_id, custom_status, custom_fields,
    } = req.body as Partial<{
      status: string; notes: string; scheduled_at: string; duration_minutes: number
      chair_id: string; doctor_id: string; custom_status: string
      custom_fields: Record<string, unknown>
    }>

    const updated = await withTransaction(req.clinicId, async (client) => {
      const { rows } = await client.query<Record<string, unknown>>(
        `UPDATE appointments SET
           status           = COALESCE($1, status),
           notes            = COALESCE($2, notes),
           scheduled_at     = COALESCE($3, scheduled_at),
           duration_minutes = COALESCE($4, duration_minutes),
           chair_id         = COALESCE($5, chair_id),
           doctor_id        = COALESCE($6, doctor_id),
           custom_status    = COALESCE($7, custom_status),
           completed_at     = CASE WHEN $1 = 'completed' THEN now() ELSE completed_at END
         WHERE id = $8 AND clinic_id = $9
         RETURNING id, patient_id, chair_id, treatment_id, doctor_id,
                   scheduled_at, duration_minutes, status,
                   custom_status, notes, created_at, completed_at`,
        [status, notes, scheduled_at, duration_minutes, chair_id, doctor_id,
         custom_status, req.params['id'], req.clinicId],
      )

      if (custom_fields) {
        for (const [fieldId, value] of Object.entries(custom_fields)) {
          await client.query(
            `INSERT INTO custom_field_values (id, clinic_id, field_id, entity_id, value)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (field_id, entity_id) DO UPDATE SET value = EXCLUDED.value`,
            [randomUUID(), req.clinicId, fieldId, req.params['id'], String(value)],
          )
        }
      }
      return rows[0]
    })

    if (!updated) throw new AppError(404, 'Appointment not found')

    void auditFromRequest(req, {
      clinicId: req.clinicId, staffId: req.staffId,
      action: 'UPDATE', entity: 'appointment', entityId: req.params['id'],
      diff: { status },
    })
    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

// ── DELETE /:id ───────────────────────────────────────────────────────────────

router.delete('/:id', requireMinRole('branch_manager'), async (req, res, next) => {
  try {
    const deleted = await queryOne(
      `UPDATE appointments SET status = 'cancelled'
       WHERE id = $1 AND clinic_id = $2
       RETURNING id`,
      [req.params['id'], req.clinicId],
    )
    if (!deleted) throw new AppError(404, 'Appointment not found')

    void auditFromRequest(req, {
      clinicId: req.clinicId, staffId: req.staffId,
      action: 'DELETE', entity: 'appointment', entityId: req.params['id'],
    })
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

// ── Utility: slot generator ───────────────────────────────────────────────────

function generateSlots(
  date:       string,
  openTime:   string,
  closeTime:  string,
  durationMin: number,
  booked:     Array<{ scheduled_at: string; duration_minutes: number }>,
): Array<{ time: string; available: boolean }> {
  const [openH, openM]   = openTime.split(':').map(Number)
  const [closeH, closeM] = closeTime.split(':').map(Number)

  const openMinutes  = openH  * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  // Build a set of busy minute ranges
  const busyRanges = booked.map((b) => {
    const d     = new Date(b.scheduled_at)
    const start = d.getHours() * 60 + d.getMinutes()
    return { start, end: start + b.duration_minutes }
  })

  const slots: Array<{ time: string; available: boolean }> = []

  for (let m = openMinutes; m + durationMin <= closeMinutes; m += durationMin) {
    const h  = Math.floor(m / 60)
    const mm = m % 60
    const time = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`

    const available = !busyRanges.some(
      (r) => m < r.end && m + durationMin > r.start,
    )
    slots.push({ time, available })
  }

  return slots
}

export default router
