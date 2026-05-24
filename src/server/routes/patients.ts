/**
 * Patient routes — /api/v2/patients
 *
 * GET    /                     — Paginated list with search
 * POST   /                     — Create patient (auto-generates OP-ID)
 * GET    /:id                  — Get patient details + custom field values
 * PATCH  /:id                  — Update patient
 * DELETE /:id                  — Archive (soft delete)
 *
 * ── Sub-resources ──────────────────────────────────────────────────────────
 * GET/POST       /:id/allergies
 * PATCH/DELETE   /:id/allergies/:aid
 *
 * GET/POST       /:id/medications
 * PATCH/DELETE   /:id/medications/:mid
 *
 * GET/POST       /:id/dental-chart
 * PATCH/DELETE   /:id/dental-chart/:eid
 *
 * GET/POST       /:id/clinical-assessments
 * GET            /:id/clinical-assessments/:cid
 *
 * GET/POST       /:id/treatment-records
 *
 * GET/POST       /:id/images
 * DELETE         /:id/images/:iid
 *
 * GET/POST       /:id/prescriptions
 * GET            /:id/prescriptions/:pid
 */
import { Router }     from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, withTransaction } from '../db/postgres'
import { authenticate }     from '../middleware/auth'
import { requireMinRole }   from '../middleware/rbac'
import { planGuard }        from '../middleware/planGuard'
import { validate, paginationSchema } from '../middleware/validate'
import { AppError }         from '../middleware/errorHandler'
import { nextOpId }         from '../services/opIdService'
import { auditFromRequest } from '../services/auditService'
import {
  CreatePatientSchema,
  UpdatePatientSchema,
} from '../../shared/validationSchemas'

const router = Router()
router.use(authenticate)

// ── GET / — paginated list ────────────────────────────────────────────────────

router.get('/', validate(paginationSchema, { target: 'query' }), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number }
    const search    = (req.query['search'] as string | undefined)?.trim()
    const branchId  = req.query['branchId'] as string | undefined
    const offset    = (page - 1) * limit

    // branch_manager sees only their branch
    const effectiveBranchId =
      req.role === 'clinic_owner' ? branchId ?? null : req.branchId

    const rows = await query(
      `SELECT p.id, p.op_id, p.name, p.contact_number, p.gender,
              p.date_of_birth, p.address, p.created_at
       FROM patients p
       WHERE p.clinic_id = $1
         AND p.archived_at IS NULL
         AND ($2::uuid IS NULL OR p.branch_id = $2)
         AND ($3::text IS NULL OR
              p.name ILIKE '%' || $3 || '%' OR
              p.contact_number ILIKE '%' || $3 || '%' OR
              p.op_id ILIKE '%' || $3 || '%')
       ORDER BY p.created_at DESC
       LIMIT $4 OFFSET $5`,
      [req.clinicId, effectiveBranchId, search ?? null, limit, offset],
    )

    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM patients
       WHERE clinic_id = $1 AND archived_at IS NULL
         AND ($2::uuid IS NULL OR branch_id = $2)
         AND ($3::text IS NULL OR
              name ILIKE '%' || $3 || '%' OR
              contact_number ILIKE '%' || $3 || '%' OR
              op_id ILIKE '%' || $3 || '%')`,
      [req.clinicId, effectiveBranchId, search ?? null],
    )
    const total = parseInt(countRow?.count ?? '0', 10)

    res.json({
      success: true,
      data: rows,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (err) { next(err) }
})

// ── POST / ────────────────────────────────────────────────────────────────────

router.post('/', planGuard('patient'), validate(CreatePatientSchema), async (req, res, next) => {
  try {
    const {
      branch_id, name, contact_number, address, date_of_birth,
      gender, blood_group, emergency_contact, past_medical_history,
    } = req.body as {
      branch_id: string; name: string; contact_number: string; address?: string
      date_of_birth?: string; gender?: string; blood_group?: string
      emergency_contact?: string; past_medical_history?: string
    }

    const opId = await nextOpId(req.clinicId)
    const id   = randomUUID()

    const patient = await withTransaction(req.clinicId, async (client) => {
      const { rows } = await client.query<Record<string, unknown>>(
        `INSERT INTO patients
           (id, clinic_id, branch_id, op_id, name, contact_number, address,
            date_of_birth, gender, blood_group, emergency_contact, past_medical_history)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id, op_id, name, contact_number, address, date_of_birth,
                   gender, blood_group, emergency_contact, past_medical_history,
                   created_at`,
        [id, req.clinicId, branch_id, opId, name, contact_number,
         address ?? null, date_of_birth ?? null, gender ?? null,
         blood_group ?? null, emergency_contact ?? null,
         past_medical_history ?? null],
      )
      return rows[0]
    })

    void auditFromRequest(req, {
      clinicId: req.clinicId, staffId: req.staffId,
      action: 'CREATE', entity: 'patient', entityId: id,
    })
    res.status(201).json({ success: true, data: patient })
  } catch (err) { next(err) }
})

// ── GET /:id ──────────────────────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const patient = await queryOne(
      `SELECT p.*, array_agg(DISTINCT jsonb_build_object(
         'id', cfv.id, 'field_id', cfv.field_id,
         'label', cf.label, 'value', cfv.value
       )) FILTER (WHERE cfv.id IS NOT NULL) AS custom_fields
       FROM patients p
       LEFT JOIN custom_field_values cfv ON cfv.entity_id = p.id
       LEFT JOIN custom_fields cf ON cf.id = cfv.field_id
       WHERE p.id = $1 AND p.clinic_id = $2 AND p.archived_at IS NULL
       GROUP BY p.id`,
      [req.params['id'], req.clinicId],
    )
    if (!patient) throw new AppError(404, 'Patient not found')
    res.json({ success: true, data: patient })
  } catch (err) { next(err) }
})

// ── PATCH /:id ────────────────────────────────────────────────────────────────

router.patch('/:id', validate(UpdatePatientSchema), async (req, res, next) => {
  try {
    const {
      name, contact_number, address, date_of_birth,
      gender, blood_group, emergency_contact, past_medical_history,
    } = req.body as Partial<{
      name: string; contact_number: string; address: string; date_of_birth: string
      gender: string; blood_group: string; emergency_contact: string; past_medical_history: string
    }>

    const updated = await queryOne(
      `UPDATE patients SET
         name                 = COALESCE($1,  name),
         contact_number       = COALESCE($2,  contact_number),
         address              = COALESCE($3,  address),
         date_of_birth        = COALESCE($4,  date_of_birth),
         gender               = COALESCE($5,  gender),
         blood_group          = COALESCE($6,  blood_group),
         emergency_contact    = COALESCE($7,  emergency_contact),
         past_medical_history = COALESCE($8,  past_medical_history),
         updated_at           = now()
       WHERE id = $9 AND clinic_id = $10 AND archived_at IS NULL
       RETURNING id, op_id, name, contact_number, address, date_of_birth,
                 gender, blood_group, emergency_contact, past_medical_history,
                 created_at, updated_at`,
      [name, contact_number, address, date_of_birth,
       gender, blood_group, emergency_contact, past_medical_history,
       req.params['id'], req.clinicId],
    )
    if (!updated) throw new AppError(404, 'Patient not found')

    void auditFromRequest(req, {
      clinicId: req.clinicId, staffId: req.staffId,
      action: 'UPDATE', entity: 'patient', entityId: req.params['id'],
    })
    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

// ── DELETE /:id — soft archive ────────────────────────────────────────────────

router.delete('/:id', requireMinRole('branch_manager'), async (req, res, next) => {
  try {
    const archived = await queryOne(
      `UPDATE patients SET archived_at = now()
       WHERE id = $1 AND clinic_id = $2 AND archived_at IS NULL
       RETURNING id`,
      [req.params['id'], req.clinicId],
    )
    if (!archived) throw new AppError(404, 'Patient not found or already archived')

    void auditFromRequest(req, {
      clinicId: req.clinicId, staffId: req.staffId,
      action: 'DELETE', entity: 'patient', entityId: req.params['id'],
    })
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────────────────────────────────────
// ── Sub-resources ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ── Allergies ─────────────────────────────────────────────────────────────────

router.get('/:id/allergies', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, allergen_name, allergy_type, severity, reaction_description, noted_at
       FROM allergies WHERE patient_id = $1 AND clinic_id = $2 ORDER BY noted_at DESC`,
      [req.params['id'], req.clinicId],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

router.post('/:id/allergies', async (req, res, next) => {
  try {
    const { allergen_name, allergy_type, severity, reaction_description, noted_at } =
      req.body as {
        allergen_name: string; allergy_type: string; severity: string
        reaction_description?: string; noted_at?: string
      }
    const row = await queryOne(
      `INSERT INTO allergies
         (id, clinic_id, patient_id, allergen_name, allergy_type, severity,
          reaction_description, noted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, allergen_name, allergy_type, severity, reaction_description, noted_at`,
      [randomUUID(), req.clinicId, req.params['id'],
       allergen_name, allergy_type, severity,
       reaction_description ?? null, noted_at ?? null],
    )
    res.status(201).json({ success: true, data: row })
  } catch (err) { next(err) }
})

router.patch('/:id/allergies/:aid', async (req, res, next) => {
  try {
    const { allergen_name, allergy_type, severity, reaction_description } =
      req.body as Partial<{ allergen_name: string; allergy_type: string; severity: string; reaction_description: string }>
    const updated = await queryOne(
      `UPDATE allergies SET
         allergen_name        = COALESCE($1, allergen_name),
         allergy_type         = COALESCE($2, allergy_type),
         severity             = COALESCE($3, severity),
         reaction_description = COALESCE($4, reaction_description)
       WHERE id = $5 AND patient_id = $6 AND clinic_id = $7
       RETURNING id, allergen_name, allergy_type, severity, reaction_description, noted_at`,
      [allergen_name, allergy_type, severity, reaction_description,
       req.params['aid'], req.params['id'], req.clinicId],
    )
    if (!updated) throw new AppError(404, 'Allergy not found')
    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

router.delete('/:id/allergies/:aid', async (req, res, next) => {
  try {
    const deleted = await queryOne(
      `DELETE FROM allergies WHERE id = $1 AND patient_id = $2 AND clinic_id = $3 RETURNING id`,
      [req.params['aid'], req.params['id'], req.clinicId],
    )
    if (!deleted) throw new AppError(404, 'Allergy not found')
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

// ── Medications ───────────────────────────────────────────────────────────────

router.get('/:id/medications', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, medication_name, dosage, frequency, duration,
              prescribed_by, prescribed_on, reason, status
       FROM medications WHERE patient_id = $1 AND clinic_id = $2 ORDER BY prescribed_on DESC`,
      [req.params['id'], req.clinicId],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

router.post('/:id/medications', async (req, res, next) => {
  try {
    const { medication_name, dosage, frequency, duration, prescribed_by, prescribed_on, reason, status } =
      req.body as {
        medication_name: string; dosage?: string; frequency?: string; duration?: string
        prescribed_by?: string; prescribed_on?: string; reason?: string; status: string
      }
    const row = await queryOne(
      `INSERT INTO medications
         (id, clinic_id, patient_id, medication_name, dosage, frequency,
          duration, prescribed_by, prescribed_on, reason, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, medication_name, dosage, frequency, duration,
                 prescribed_by, prescribed_on, reason, status`,
      [randomUUID(), req.clinicId, req.params['id'],
       medication_name, dosage ?? null, frequency ?? null,
       duration ?? null, prescribed_by ?? null, prescribed_on ?? null,
       reason ?? null, status],
    )
    res.status(201).json({ success: true, data: row })
  } catch (err) { next(err) }
})

router.patch('/:id/medications/:mid', async (req, res, next) => {
  try {
    const body = req.body as Partial<{
      medication_name: string; dosage: string; frequency: string
      duration: string; reason: string; status: string
    }>
    const updated = await queryOne(
      `UPDATE medications SET
         medication_name = COALESCE($1, medication_name),
         dosage          = COALESCE($2, dosage),
         frequency       = COALESCE($3, frequency),
         duration        = COALESCE($4, duration),
         reason          = COALESCE($5, reason),
         status          = COALESCE($6, status)
       WHERE id = $7 AND patient_id = $8 AND clinic_id = $9
       RETURNING id, medication_name, dosage, frequency, duration,
                 prescribed_by, prescribed_on, reason, status`,
      [body.medication_name, body.dosage, body.frequency, body.duration,
       body.reason, body.status,
       req.params['mid'], req.params['id'], req.clinicId],
    )
    if (!updated) throw new AppError(404, 'Medication not found')
    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

router.delete('/:id/medications/:mid', async (req, res, next) => {
  try {
    const deleted = await queryOne(
      `DELETE FROM medications WHERE id = $1 AND patient_id = $2 AND clinic_id = $3 RETURNING id`,
      [req.params['mid'], req.params['id'], req.clinicId],
    )
    if (!deleted) throw new AppError(404, 'Medication not found')
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

// ── Dental chart ──────────────────────────────────────────────────────────────

router.get('/:id/dental-chart', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT dce.id, dce.tooth_number, dce.surface, dce.procedure_type,
              dce.status, dce.notes, dce.done_at, dce.created_at,
              s.name AS created_by_name
       FROM dental_chart_entries dce
       LEFT JOIN staff s ON s.id = dce.created_by
       WHERE dce.patient_id = $1 AND dce.clinic_id = $2
       ORDER BY dce.tooth_number, dce.created_at`,
      [req.params['id'], req.clinicId],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

router.post('/:id/dental-chart', async (req, res, next) => {
  try {
    const { tooth_number, surface, procedure_type, status, notes, done_at } =
      req.body as {
        tooth_number: string; surface: string; procedure_type: string
        status: string; notes?: string; done_at?: string
      }
    const row = await queryOne(
      `INSERT INTO dental_chart_entries
         (id, clinic_id, patient_id, tooth_number, surface, procedure_type,
          status, notes, done_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, tooth_number, surface, procedure_type, status, notes, done_at, created_at`,
      [randomUUID(), req.clinicId, req.params['id'],
       tooth_number, surface, procedure_type,
       status, notes ?? null, done_at ?? null, req.staffId],
    )
    res.status(201).json({ success: true, data: row })
  } catch (err) { next(err) }
})

router.patch('/:id/dental-chart/:eid', async (req, res, next) => {
  try {
    const { status, notes, done_at } = req.body as Partial<{
      status: string; notes: string; done_at: string
    }>
    const updated = await queryOne(
      `UPDATE dental_chart_entries SET
         status  = COALESCE($1, status),
         notes   = COALESCE($2, notes),
         done_at = COALESCE($3, done_at)
       WHERE id = $4 AND patient_id = $5 AND clinic_id = $6
       RETURNING id, tooth_number, surface, procedure_type, status, notes, done_at, created_at`,
      [status, notes, done_at,
       req.params['eid'], req.params['id'], req.clinicId],
    )
    if (!updated) throw new AppError(404, 'Chart entry not found')
    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

router.delete('/:id/dental-chart/:eid', requireMinRole('doctor'), async (req, res, next) => {
  try {
    const deleted = await queryOne(
      `DELETE FROM dental_chart_entries
       WHERE id = $1 AND patient_id = $2 AND clinic_id = $3 RETURNING id`,
      [req.params['eid'], req.params['id'], req.clinicId],
    )
    if (!deleted) throw new AppError(404, 'Chart entry not found')
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

// ── Clinical assessments ──────────────────────────────────────────────────────

router.get('/:id/clinical-assessments', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT ca.id, ca.appointment_id, ca.subjective, ca.objective,
              ca.assessment, ca.plan, ca.session_date, ca.created_at,
              s.name AS created_by_name
       FROM clinical_assessments ca
       LEFT JOIN staff s ON s.id = ca.created_by
       WHERE ca.patient_id = $1 AND ca.clinic_id = $2
       ORDER BY ca.session_date DESC`,
      [req.params['id'], req.clinicId],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

router.post('/:id/clinical-assessments', requireMinRole('doctor'), async (req, res, next) => {
  try {
    const { appointment_id, subjective, objective, assessment, plan, session_date } =
      req.body as {
        appointment_id?: string; subjective?: string; objective?: string
        assessment?: string; plan?: string; session_date: string
      }
    const row = await queryOne(
      `INSERT INTO clinical_assessments
         (id, clinic_id, patient_id, appointment_id, subjective, objective,
          assessment, plan, session_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, appointment_id, subjective, objective,
                 assessment, plan, session_date, created_at`,
      [randomUUID(), req.clinicId, req.params['id'],
       appointment_id ?? null, subjective ?? null, objective ?? null,
       assessment ?? null, plan ?? null, session_date, req.staffId],
    )
    res.status(201).json({ success: true, data: row })
  } catch (err) { next(err) }
})

// ── Treatment records ─────────────────────────────────────────────────────────

router.get('/:id/treatment-records', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT tr.id, tr.appointment_id, tr.treatment_id, t.name AS treatment_name,
              tr.tooth_area, tr.chair_id, c.name AS chair_name,
              tr.status, tr.notes, tr.treated_at,
              s.name AS doctor_name
       FROM treatment_records tr
       JOIN treatments t  ON t.id  = tr.treatment_id
       LEFT JOIN chairs c ON c.id  = tr.chair_id
       LEFT JOIN staff s  ON s.id  = tr.doctor_id
       WHERE tr.patient_id = $1 AND tr.clinic_id = $2
       ORDER BY tr.treated_at DESC`,
      [req.params['id'], req.clinicId],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

// ── Patient images ────────────────────────────────────────────────────────────

router.get('/:id/images', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, image_type, file_path, thumbnail_path, procedure_tag,
              tooth_number, notes, capture_date, uploaded_at
       FROM patient_images
       WHERE patient_id = $1 AND clinic_id = $2
       ORDER BY uploaded_at DESC`,
      [req.params['id'], req.clinicId],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

router.delete('/:id/images/:iid', requireMinRole('doctor'), async (req, res, next) => {
  try {
    const deleted = await queryOne(
      `DELETE FROM patient_images WHERE id = $1 AND patient_id = $2 AND clinic_id = $3 RETURNING id`,
      [req.params['iid'], req.params['id'], req.clinicId],
    )
    if (!deleted) throw new AppError(404, 'Image not found')
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

// ── Prescriptions ─────────────────────────────────────────────────────────────

router.get('/:id/prescriptions', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT pr.id, pr.appointment_id, pr.diagnosis, pr.notes,
              pr.status, pr.prescribed_at, pr.created_at,
              s.name AS prescribed_by_name
       FROM prescriptions pr
       LEFT JOIN staff s ON s.id = pr.prescribed_by
       WHERE pr.patient_id = $1 AND pr.clinic_id = $2
       ORDER BY pr.prescribed_at DESC`,
      [req.params['id'], req.clinicId],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

router.get('/:id/prescriptions/:pid', async (req, res, next) => {
  try {
    const prescription = await queryOne(
      `SELECT pr.*, s.name AS prescribed_by_name,
              json_agg(pi ORDER BY pi.id) AS items
       FROM prescriptions pr
       LEFT JOIN staff s ON s.id = pr.prescribed_by
       LEFT JOIN prescription_items pi ON pi.prescription_id = pr.id
       WHERE pr.id = $1 AND pr.patient_id = $2 AND pr.clinic_id = $3
       GROUP BY pr.id, s.name`,
      [req.params['pid'], req.params['id'], req.clinicId],
    )
    if (!prescription) throw new AppError(404, 'Prescription not found')
    res.json({ success: true, data: prescription })
  } catch (err) { next(err) }
})

export default router
