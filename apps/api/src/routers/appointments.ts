/**
 * Appointments routes — /api/v2/appointments
 *
 * GET    /                        — List appointments (date range, branch, doctor filters)
 * POST   /                        — Create appointment
 * GET    /:id                     — Get appointment detail
 * PATCH  /:id                     — Update appointment
 * DELETE /:id                     — Cancel appointment
 *
 * GET    /slots                   — Get available slots for a doctor/branch/date
 *
 * GET    /treatments               — List treatment catalogue
 * POST   /treatments               — Create treatment [branch_manager+]
 * PATCH  /treatments/:treatId      — Update treatment [branch_manager+]
 *
 * GET    /:id/treatment-records    — List treatment records for appointment
 * POST   /:id/treatment-records    — Add treatment record
 *
 * GET    /custom-fields            — List custom field definitions
 * POST   /custom-fields            — Create custom field [branch_manager+]
 */
import { Hono }          from 'hono'
import { zValidator }    from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import {
  db, appointments, treatments, treatmentRecords, customFields,
  branchWorkingHours, apptConfig, staff,
  eq, and, gte, lte, desc, sql
} from '@vorsa/db'
import {
  CreateAppointmentSchema, UpdateAppointmentSchema
} from '@vorsa/validators'
import { requireAuth }    from '../middleware/auth'
import { requireMinRole } from '../middleware/rbac'
import type { AppEnv }    from '../app'

const router = new Hono<AppEnv>()
router.use('*', requireAuth)

// ── GET /slots ────────────────────────────────────────────────────────────────

router.get('/slots', async (c) => {
  const clinicId = c.get('clinicId')
  const doctorId = c.req.query('doctorId')
  const branchId = c.req.query('branchId')
  const date     = c.req.query('date') // YYYY-MM-DD

  if (!doctorId || !branchId || !date) {
    throw new HTTPException(400, { message: 'doctorId, branchId, and date are required' })
  }

  const dateObj    = new Date(date)
  const dayOfWeek  = dateObj.getDay() // 0=Sun … 6=Sat

  // Get branch working hours for that day
  const wh = await db.select().from(branchWorkingHours)
    .where(and(
      eq(branchWorkingHours.branch_id, branchId),
      eq(branchWorkingHours.day_of_week, dayOfWeek),
    ))
    .limit(1)
    .then(r => r[0])

  if (!wh?.is_open || !wh.open_time || !wh.close_time) {
    return c.json({ success: true, data: [] })
  }

  // Get appt config for slot duration
  const config = await db.select().from(apptConfig)
    .where(eq(apptConfig.branch_id, branchId))
    .limit(1)
    .then(r => r[0])

  const slotMinutes = config?.default_slot_minutes ?? 30

  // Get existing appointments for this doctor on this date
  const startOfDay = new Date(`${date}T00:00:00.000Z`)
  const endOfDay   = new Date(`${date}T23:59:59.999Z`)

  const booked = await db.select({
    start_time: appointments.start_time,
    end_time:   appointments.end_time,
  })
    .from(appointments)
    .where(and(
      eq(appointments.clinic_id, clinicId),
      eq(appointments.doctor_id, doctorId),
      eq(appointments.branch_id, branchId),
      gte(appointments.start_time, startOfDay),
      lte(appointments.start_time, endOfDay),
    ))

  // Generate slots
  const [openH, openM]   = wh.open_time.split(':').map(Number)
  const [closeH, closeM] = wh.close_time.split(':').map(Number)

  const slots: { start: string; end: string; available: boolean }[] = []
  let currentMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  while (currentMinutes + slotMinutes <= closeMinutes) {
    const startH   = Math.floor(currentMinutes / 60)
    const startMin = currentMinutes % 60
    const endMin   = currentMinutes + slotMinutes
    const endH     = Math.floor(endMin / 60)
    const endMinR  = endMin % 60

    const slotStart = `${String(startH).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`
    const slotEnd   = `${String(endH).padStart(2, '0')}:${String(endMinR).padStart(2, '0')}`

    const slotStartDt = new Date(`${date}T${slotStart}:00.000Z`)
    const slotEndDt   = new Date(`${date}T${slotEnd}:00.000Z`)

    const isBooked = booked.some(b =>
      b.start_time < slotEndDt && b.end_time > slotStartDt
    )

    slots.push({ start: slotStart, end: slotEnd, available: !isBooked })
    currentMinutes += slotMinutes
  }

  return c.json({ success: true, data: slots })
})

// ── GET /treatments ────────────────────────────────────────────────────────────

router.get('/treatments', async (c) => {
  const clinicId = c.get('clinicId')

  const rows = await db.select().from(treatments)
    .where(eq(treatments.clinic_id, clinicId))

  return c.json({ success: true, data: rows })
})

// ── POST /treatments ───────────────────────────────────────────────────────────

router.post('/treatments',
  requireMinRole('branch_manager'),
  async (c) => {
    const clinicId = c.get('clinicId')
    const body     = await c.req.json() as {
      name: string; code?: string; default_price?: string; duration_minutes?: number; category?: string; description?: string
    }

    if (!body.name?.trim()) throw new HTTPException(400, { message: 'Treatment name is required' })

    const [row] = await db.insert(treatments)
      .values({ clinic_id: clinicId, ...body })
      .returning()

    return c.json({ success: true, data: row }, 201)
  },
)

// ── PATCH /treatments/:treatId ────────────────────────────────────────────────

router.patch('/treatments/:treatId',
  requireMinRole('branch_manager'),
  async (c) => {
    const clinicId = c.get('clinicId')
    const treatId  = c.req.param('treatId')
    const body     = await c.req.json() as Record<string, unknown>

    const [updated] = await db.update(treatments)
      .set({ ...body, updated_at: new Date() })
      .where(and(eq(treatments.id, treatId), eq(treatments.clinic_id, clinicId)))
      .returning()

    if (!updated) throw new HTTPException(404, { message: 'Treatment not found' })
    return c.json({ success: true, data: updated })
  },
)

// ── GET /custom-fields ─────────────────────────────────────────────────────────

router.get('/custom-fields', async (c) => {
  const clinicId = c.get('clinicId')

  const rows = await db.select().from(customFields)
    .where(eq(customFields.clinic_id, clinicId))

  return c.json({ success: true, data: rows })
})

// ── POST /custom-fields ────────────────────────────────────────────────────────

router.post('/custom-fields',
  requireMinRole('branch_manager'),
  async (c) => {
    const clinicId = c.get('clinicId')
    const body     = await c.req.json() as {
      label: string; field_type: string; is_required?: boolean; options?: string[]; sort_order?: number
    }

    if (!body.label?.trim() || !body.field_type) {
      throw new HTTPException(400, { message: 'label and field_type are required' })
    }

    const [row] = await db.insert(customFields)
      .values({ clinic_id: clinicId, ...body })
      .returning()

    return c.json({ success: true, data: row }, 201)
  },
)

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', async (c) => {
  const clinicId  = c.get('clinicId')
  const role      = c.get('role')
  const myBranchId = c.get('branchId')

  const branchId = role === 'clinic_owner'
    ? c.req.query('branchId')
    : myBranchId ?? undefined

  const doctorId  = c.req.query('doctorId')
  const dateFrom  = c.req.query('dateFrom')
  const dateTo    = c.req.query('dateTo')
  const patientId = c.req.query('patientId')

  const conditions = [eq(appointments.clinic_id, clinicId)]

  if (branchId)  conditions.push(eq(appointments.branch_id, branchId))
  if (doctorId)  conditions.push(eq(appointments.doctor_id, doctorId))
  if (patientId) conditions.push(eq(appointments.patient_id, patientId))
  if (dateFrom)  conditions.push(gte(appointments.start_time, new Date(dateFrom)))
  if (dateTo)    conditions.push(lte(appointments.start_time, new Date(dateTo)))

  const rows = await db.select().from(appointments)
    .where(and(...conditions))
    .orderBy(desc(appointments.start_time))
    .limit(200)

  return c.json({ success: true, data: rows })
})

// ── POST / ────────────────────────────────────────────────────────────────────

router.post('/',
  zValidator('json', CreateAppointmentSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const body     = c.req.valid('json')

    const [appt] = await db.insert(appointments)
      .values({ clinic_id: clinicId, ...body })
      .returning()

    return c.json({ success: true, data: appt }, 201)
  },
)

// ── GET /:id ──────────────────────────────────────────────────────────────────

router.get('/:id', async (c) => {
  const clinicId = c.get('clinicId')
  const id       = c.req.param('id')

  const row = await db.select().from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.clinic_id, clinicId)))
    .limit(1)
    .then(r => r[0])

  if (!row) throw new HTTPException(404, { message: 'Appointment not found' })
  return c.json({ success: true, data: row })
})

// ── PATCH /:id ────────────────────────────────────────────────────────────────

router.patch('/:id',
  zValidator('json', UpdateAppointmentSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const id       = c.req.param('id')
    const body     = c.req.valid('json')

    const [updated] = await db.update(appointments)
      .set({ ...body, updated_at: new Date() })
      .where(and(eq(appointments.id, id), eq(appointments.clinic_id, clinicId)))
      .returning()

    if (!updated) throw new HTTPException(404, { message: 'Appointment not found' })
    return c.json({ success: true, data: updated })
  },
)

// ── DELETE /:id ────────────────────────────────────────────────────────────────

router.delete('/:id', async (c) => {
  const clinicId = c.get('clinicId')
  const id       = c.req.param('id')

  const [updated] = await db.update(appointments)
    .set({ status: 'cancelled', updated_at: new Date() })
    .where(and(eq(appointments.id, id), eq(appointments.clinic_id, clinicId)))
    .returning()

  if (!updated) throw new HTTPException(404, { message: 'Appointment not found' })
  return c.json({ success: true, data: updated })
})

// ── GET /:id/treatment-records ────────────────────────────────────────────────

router.get('/:id/treatment-records', async (c) => {
  const clinicId = c.get('clinicId')
  const apptId   = c.req.param('id')

  const rows = await db.select().from(treatmentRecords)
    .where(and(
      eq(treatmentRecords.appointment_id, apptId),
      eq(treatmentRecords.clinic_id, clinicId),
    ))

  return c.json({ success: true, data: rows })
})

// ── POST /:id/treatment-records ───────────────────────────────────────────────

router.post('/:id/treatment-records', async (c) => {
  const clinicId = c.get('clinicId')
  const apptId   = c.req.param('id')
  const body     = await c.req.json() as {
    treatment_id: string; tooth_number?: number; surface?: string; notes?: string; price?: string
  }

  if (!body.treatment_id) {
    throw new HTTPException(400, { message: 'treatment_id is required' })
  }

  const [row] = await db.insert(treatmentRecords)
    .values({ appointment_id: apptId, clinic_id: clinicId, ...body })
    .returning()

  return c.json({ success: true, data: row }, 201)
})

export default router
