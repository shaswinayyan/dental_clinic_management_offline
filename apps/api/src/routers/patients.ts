/**
 * Patients routes — /api/v2/patients
 *
 * GET    /                           — List patients (search, filter, paginate)
 * POST   /                           — Create patient [plan-gated]
 * GET    /:id                        — Get patient detail
 * PATCH  /:id                        — Update patient
 * DELETE /:id                        — Archive patient [clinic_owner only]
 *
 * GET    /:id/allergies               — List allergies
 * POST   /:id/allergies               — Add allergy
 * DELETE /:id/allergies/:allergyId    — Remove allergy
 *
 * GET    /:id/medications             — List medications
 * POST   /:id/medications             — Add medication
 * PATCH  /:id/medications/:medId      — Update medication
 * DELETE /:id/medications/:medId      — Remove medication
 *
 * GET    /:id/dental-chart            — Get dental chart entries
 * PUT    /:id/dental-chart            — Upsert tooth condition
 *
 * GET    /:id/assessments             — List clinical assessments
 * POST   /:id/assessments             — Create clinical assessment
 */
import { Hono }          from 'hono'
import { zValidator }    from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import {
  db, patients, allergies, medications, dentalChartEntries, clinicalAssessments,
  eq, and, isNull, ilike, or, desc, sql
} from '@vorsa/db'
import {
  CreatePatientSchema, UpdatePatientSchema
} from '@vorsa/validators'
import { requireAuth }    from '../middleware/auth'
import { requireMinRole } from '../middleware/rbac'
import { planGuard }      from '../middleware/planGuard'
import type { AppEnv }    from '../app'

const router = new Hono<AppEnv>()
router.use('*', requireAuth)

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', async (c) => {
  const clinicId = c.get('clinicId')
  const q        = c.req.query('q')?.trim()
  const page     = Math.max(1, Number(c.req.query('page') ?? 1))
  const limit    = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 20)))
  const offset   = (page - 1) * limit

  const baseWhere = and(
    eq(patients.clinic_id, clinicId),
    isNull(patients.archived_at),
    q ? or(
      ilike(patients.name, `%${q}%`),
      ilike(patients.phone, `%${q}%`),
    ) : undefined,
  )

  const [rows, countResult] = await Promise.all([
    db.select().from(patients)
      .where(baseWhere)
      .orderBy(desc(patients.created_at))
      .limit(limit)
      .offset(offset),
    db.select({ n: sql<number>`COUNT(*)` })
      .from(patients)
      .where(baseWhere)
      .then(r => Number(r[0]?.n ?? 0)),
  ])

  return c.json({
    success: true,
    data:    rows,
    meta:    { total: countResult, page, limit, pages: Math.ceil(countResult / limit) },
  })
})

// ── POST / ────────────────────────────────────────────────────────────────────

router.post('/',
  planGuard('patient'),
  zValidator('json', CreatePatientSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const body     = c.req.valid('json')

    const [patient] = await db.insert(patients)
      .values({ clinic_id: clinicId, ...body })
      .returning()

    return c.json({ success: true, data: patient }, 201)
  },
)

// ── GET /:id ──────────────────────────────────────────────────────────────────

router.get('/:id', async (c) => {
  const clinicId = c.get('clinicId')
  const id       = c.req.param('id')

  const row = await db.select().from(patients)
    .where(and(eq(patients.id, id), eq(patients.clinic_id, clinicId), isNull(patients.archived_at)))
    .limit(1)
    .then(r => r[0])

  if (!row) throw new HTTPException(404, { message: 'Patient not found' })
  return c.json({ success: true, data: row })
})

// ── PATCH /:id ────────────────────────────────────────────────────────────────

router.patch('/:id',
  zValidator('json', UpdatePatientSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const id       = c.req.param('id')
    const body     = c.req.valid('json')

    const [updated] = await db.update(patients)
      .set({ ...body, updated_at: new Date() })
      .where(and(eq(patients.id, id), eq(patients.clinic_id, clinicId)))
      .returning()

    if (!updated) throw new HTTPException(404, { message: 'Patient not found' })
    return c.json({ success: true, data: updated })
  },
)

// ── DELETE /:id ───────────────────────────────────────────────────────────────

router.delete('/:id', requireMinRole('clinic_owner'), async (c) => {
  const clinicId = c.get('clinicId')
  const id       = c.req.param('id')

  await db.update(patients)
    .set({ archived_at: new Date(), updated_at: new Date() })
    .where(and(eq(patients.id, id), eq(patients.clinic_id, clinicId)))

  return c.json({ success: true, data: null })
})

// ── GET /:id/allergies ────────────────────────────────────────────────────────

router.get('/:id/allergies', async (c) => {
  const clinicId  = c.get('clinicId')
  const patientId = c.req.param('id')

  const rows = await db.select().from(allergies)
    .where(and(eq(allergies.patient_id, patientId), eq(allergies.clinic_id, clinicId)))

  return c.json({ success: true, data: rows })
})

// ── POST /:id/allergies ───────────────────────────────────────────────────────

router.post('/:id/allergies', async (c) => {
  const clinicId  = c.get('clinicId')
  const patientId = c.req.param('id')
  const { name, severity, notes } = await c.req.json() as {
    name: string; severity?: string; notes?: string
  }

  if (!name?.trim()) throw new HTTPException(400, { message: 'Allergy name is required' })

  const [row] = await db.insert(allergies)
    .values({ patient_id: patientId, clinic_id: clinicId, name, severity, notes })
    .returning()

  return c.json({ success: true, data: row }, 201)
})

// ── DELETE /:id/allergies/:allergyId ─────────────────────────────────────────

router.delete('/:id/allergies/:allergyId', async (c) => {
  const clinicId  = c.get('clinicId')
  const patientId = c.req.param('id')
  const allergyId = c.req.param('allergyId')

  await db.delete(allergies)
    .where(and(
      eq(allergies.id, allergyId),
      eq(allergies.patient_id, patientId),
      eq(allergies.clinic_id, clinicId),
    ))

  return c.json({ success: true, data: null })
})

// ── GET /:id/medications ──────────────────────────────────────────────────────

router.get('/:id/medications', async (c) => {
  const clinicId  = c.get('clinicId')
  const patientId = c.req.param('id')

  const rows = await db.select().from(medications)
    .where(and(eq(medications.patient_id, patientId), eq(medications.clinic_id, clinicId)))

  return c.json({ success: true, data: rows })
})

// ── POST /:id/medications ─────────────────────────────────────────────────────

router.post('/:id/medications', async (c) => {
  const clinicId  = c.get('clinicId')
  const patientId = c.req.param('id')
  const body      = await c.req.json() as {
    name: string; dosage?: string; frequency?: string; notes?: string; is_active?: boolean
  }

  if (!body.name?.trim()) throw new HTTPException(400, { message: 'Medication name is required' })

  const [row] = await db.insert(medications)
    .values({ patient_id: patientId, clinic_id: clinicId, ...body })
    .returning()

  return c.json({ success: true, data: row }, 201)
})

// ── PATCH /:id/medications/:medId ─────────────────────────────────────────────

router.patch('/:id/medications/:medId', async (c) => {
  const clinicId  = c.get('clinicId')
  const patientId = c.req.param('id')
  const medId     = c.req.param('medId')
  const body      = await c.req.json() as Record<string, unknown>

  const [updated] = await db.update(medications)
    .set({ ...body, updated_at: new Date() })
    .where(and(
      eq(medications.id, medId),
      eq(medications.patient_id, patientId),
      eq(medications.clinic_id, clinicId),
    ))
    .returning()

  if (!updated) throw new HTTPException(404, { message: 'Medication not found' })
  return c.json({ success: true, data: updated })
})

// ── DELETE /:id/medications/:medId ────────────────────────────────────────────

router.delete('/:id/medications/:medId', async (c) => {
  const clinicId  = c.get('clinicId')
  const patientId = c.req.param('id')
  const medId     = c.req.param('medId')

  await db.delete(medications)
    .where(and(
      eq(medications.id, medId),
      eq(medications.patient_id, patientId),
      eq(medications.clinic_id, clinicId),
    ))

  return c.json({ success: true, data: null })
})

// ── GET /:id/dental-chart ─────────────────────────────────────────────────────

router.get('/:id/dental-chart', async (c) => {
  const clinicId  = c.get('clinicId')
  const patientId = c.req.param('id')

  const rows = await db.select().from(dentalChartEntries)
    .where(and(eq(dentalChartEntries.patient_id, patientId), eq(dentalChartEntries.clinic_id, clinicId)))

  return c.json({ success: true, data: rows })
})

// ── PUT /:id/dental-chart ─────────────────────────────────────────────────────

router.put('/:id/dental-chart', async (c) => {
  const clinicId  = c.get('clinicId')
  const patientId = c.req.param('id')
  const body      = await c.req.json() as {
    tooth_number: number; condition: string; notes?: string; surface?: string
  }

  if (!body.tooth_number || !body.condition) {
    throw new HTTPException(400, { message: 'tooth_number and condition are required' })
  }

  const [row] = await db.insert(dentalChartEntries)
    .values({ patient_id: patientId, clinic_id: clinicId, ...body })
    .onConflictDoUpdate({
      target: [dentalChartEntries.patient_id, dentalChartEntries.tooth_number],
      set:    { condition: body.condition, notes: body.notes, surface: body.surface, updated_at: new Date() },
    })
    .returning()

  return c.json({ success: true, data: row })
})

// ── GET /:id/assessments ──────────────────────────────────────────────────────

router.get('/:id/assessments', async (c) => {
  const clinicId  = c.get('clinicId')
  const patientId = c.req.param('id')

  const rows = await db.select().from(clinicalAssessments)
    .where(and(eq(clinicalAssessments.patient_id, patientId), eq(clinicalAssessments.clinic_id, clinicId)))
    .orderBy(desc(clinicalAssessments.created_at))

  return c.json({ success: true, data: rows })
})

// ── POST /:id/assessments ─────────────────────────────────────────────────────

router.post('/:id/assessments', async (c) => {
  const clinicId  = c.get('clinicId')
  const staffId   = c.get('staffId')
  const patientId = c.req.param('id')
  const body      = await c.req.json() as {
    chief_complaint?: string; clinical_notes?: string; diagnosis?: string; treatment_plan?: string
  }

  const [row] = await db.insert(clinicalAssessments)
    .values({
      patient_id:      patientId,
      clinic_id:       clinicId,
      recorded_by:     staffId,
      ...body,
    })
    .returning()

  return c.json({ success: true, data: row }, 201)
})

export default router
