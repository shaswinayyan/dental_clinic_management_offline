import { ipcMain } from 'electron'
import { getDb } from '../db'
import type { IpcResult, Patient, PatientFormData, Allergy, Medication, DentalChartEntry, ClinicalAssessment, TreatmentRecord, Prescription, PrescriptionItem } from '../../shared/types'
import { generateOpId } from '../utils/helpers'
import { logAudit } from '../utils/audit'

export function registerPatientHandlers(): void {
  // ── List / Search ────────────────────────────────────────────────────────
  ipcMain.handle('patients:list', async (_e, search?: string, includeArchived = false): Promise<IpcResult<Patient[]>> => {
    try {
      const db = getDb()
      let sql = 'SELECT * FROM patients WHERE 1=1'
      const params: unknown[] = []
      if (!includeArchived) { sql += ' AND archived_at IS NULL' }
      if (search) {
        sql += ' AND (name LIKE ? OR contact_number LIKE ? OR op_id LIKE ?)'
        const s = `%${search}%`
        params.push(s, s, s)
      }
      sql += ' ORDER BY created_at DESC'
      const rows = db.prepare(sql).all(...params) as Patient[]
      return { success: true, data: rows }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:get', async (_e, id: number): Promise<IpcResult<Patient>> => {
    try {
      const db = getDb()
      const row = db.prepare('SELECT * FROM patients WHERE id=?').get(id) as Patient | undefined
      if (!row) return { success: false, error: 'Patient not found' }
      return { success: true, data: row }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:getByOpId', async (_e, opId: string): Promise<IpcResult<Patient>> => {
    try {
      const db = getDb()
      const row = db.prepare('SELECT * FROM patients WHERE op_id=?').get(opId) as Patient | undefined
      if (!row) return { success: false, error: 'Patient not found' }
      return { success: true, data: row }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  // ── Create / Update / Archive ─────────────────────────────────────────────
  ipcMain.handle('patients:create', async (_e, data: PatientFormData): Promise<IpcResult<Patient>> => {
    try {
      const db = getDb()
      const opId = generateOpId(db)
      db.prepare(`INSERT INTO patients(op_id,name,contact_number,address,date_of_birth,gender,blood_group,emergency_contact,past_medical_history)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(
        opId, data.name, data.contact_number,
        data.address ?? null, data.date_of_birth ?? null,
        data.gender ?? null, data.blood_group ?? null,
        data.emergency_contact ?? null, data.past_medical_history ?? null
      )
      const created = db.prepare('SELECT * FROM patients WHERE op_id=?').get(opId) as Patient
      logAudit(db, null, 'CREATE', 'patient', created.id, created.name)
      return { success: true, data: created }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:update', async (_e, id: number, data: PatientFormData): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare(`UPDATE patients SET name=?,contact_number=?,address=?,date_of_birth=?,gender=?,
        blood_group=?,emergency_contact=?,past_medical_history=?,updated_at=datetime('now','localtime') WHERE id=?`).run(
        data.name, data.contact_number,
        data.address ?? null, data.date_of_birth ?? null,
        data.gender ?? null, data.blood_group ?? null,
        data.emergency_contact ?? null, data.past_medical_history ?? null, id
      )
      logAudit(db, null, 'UPDATE', 'patient', id, data.name)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:archive', async (_e, id: number): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare(`UPDATE patients SET archived_at=datetime('now','localtime') WHERE id=?`).run(id)
      logAudit(db, null, 'ARCHIVE', 'patient', id)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:restore', async (_e, id: number): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare(`UPDATE patients SET archived_at=NULL WHERE id=?`).run(id)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  // ── Allergies ─────────────────────────────────────────────────────────────
  ipcMain.handle('patients:listAllergies', async (_e, patientId: number): Promise<IpcResult<Allergy[]>> => {
    try {
      const db = getDb()
      const rows = db.prepare('SELECT * FROM allergies WHERE patient_id=? ORDER BY noted_at DESC').all(patientId) as Allergy[]
      return { success: true, data: rows }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:addAllergy', async (_e, data: Omit<Allergy, 'id'>): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare(`INSERT INTO allergies(patient_id,allergen_name,allergy_type,severity,reaction_description,noted_at)
        VALUES (?,?,?,?,?,?)`).run(data.patient_id, data.allergen_name, data.allergy_type, data.severity, data.reaction_description ?? null, data.noted_at ?? null)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:deleteAllergy', async (_e, id: number): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare('DELETE FROM allergies WHERE id=?').run(id)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  // ── Medications ───────────────────────────────────────────────────────────
  ipcMain.handle('patients:listMedications', async (_e, patientId: number): Promise<IpcResult<Medication[]>> => {
    try {
      const db = getDb()
      const rows = db.prepare('SELECT * FROM medications WHERE patient_id=? ORDER BY prescribed_on DESC').all(patientId) as Medication[]
      return { success: true, data: rows }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:addMedication', async (_e, data: Omit<Medication, 'id'>): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare(`INSERT INTO medications(patient_id,medication_name,dosage,frequency,duration,prescribed_by,prescribed_on,reason,status)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(
        data.patient_id, data.medication_name, data.dosage ?? null, data.frequency ?? null,
        data.duration ?? null, data.prescribed_by ?? null, data.prescribed_on ?? null,
        data.reason ?? null, data.status
      )
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:updateMedicationStatus', async (_e, id: number, status: string): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare('UPDATE medications SET status=? WHERE id=?').run(status, id)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  // ── Dental Chart ──────────────────────────────────────────────────────────
  ipcMain.handle('patients:getDentalChart', async (_e, patientId: number): Promise<IpcResult<DentalChartEntry[]>> => {
    try {
      const db = getDb()
      const rows = db.prepare(`SELECT dce.*, u.username as created_by_name
        FROM dental_chart_entries dce
        LEFT JOIN users u ON dce.created_by=u.id
        WHERE dce.patient_id=?
        ORDER BY dce.created_at DESC`).all(patientId) as DentalChartEntry[]
      return { success: true, data: rows }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:addChartEntry', async (_e, data: Omit<DentalChartEntry, 'id' | 'created_at' | 'created_by_name'>): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare(`INSERT INTO dental_chart_entries(patient_id,tooth_number,surface,procedure_type,status,notes,done_at,created_by)
        VALUES (?,?,?,?,?,?,?,?)`).run(
        data.patient_id, data.tooth_number, data.surface, data.procedure_type,
        data.status, data.notes ?? null, data.done_at ?? null, data.created_by
      )
      logAudit(db, data.created_by, 'ADD_CHART_ENTRY', 'dental_chart', data.patient_id, `Tooth ${data.tooth_number}: ${data.procedure_type}`)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:updateChartEntry', async (_e, id: number, data: Partial<DentalChartEntry>): Promise<IpcResult> => {
    try {
      const db = getDb()
      if (data.status) db.prepare('UPDATE dental_chart_entries SET status=?,notes=?,done_at=? WHERE id=?').run(data.status, data.notes ?? null, data.done_at ?? null, id)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  // ── Clinical Assessment ───────────────────────────────────────────────────
  ipcMain.handle('patients:listAssessments', async (_e, patientId: number): Promise<IpcResult<ClinicalAssessment[]>> => {
    try {
      const db = getDb()
      const rows = db.prepare('SELECT * FROM clinical_assessments WHERE patient_id=? ORDER BY session_date DESC').all(patientId) as ClinicalAssessment[]
      return { success: true, data: rows }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:upsertAssessment', async (_e, data: Omit<ClinicalAssessment, 'id' | 'created_at'>): Promise<IpcResult> => {
    try {
      const db = getDb()
      const existing = db.prepare('SELECT id FROM clinical_assessments WHERE patient_id=? AND appointment_id IS ? AND session_date=?')
        .get(data.patient_id, data.appointment_id ?? null, data.session_date)
      if (existing) {
        db.prepare('UPDATE clinical_assessments SET subjective=?,objective=?,assessment=?,plan=? WHERE id=?').run(
          data.subjective ?? null, data.objective ?? null, data.assessment ?? null, data.plan ?? null, (existing as { id: number }).id
        )
      } else {
        db.prepare(`INSERT INTO clinical_assessments(patient_id,appointment_id,subjective,objective,assessment,plan,session_date,created_by)
          VALUES (?,?,?,?,?,?,?,?)`).run(
          data.patient_id, data.appointment_id ?? null, data.subjective ?? null,
          data.objective ?? null, data.assessment ?? null, data.plan ?? null,
          data.session_date, data.created_by
        )
      }
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  // ── Treatment Records ─────────────────────────────────────────────────────
  ipcMain.handle('patients:listTreatments', async (_e, patientId: number): Promise<IpcResult<TreatmentRecord[]>> => {
    try {
      const db = getDb()
      const rows = db.prepare(`SELECT tr.*, t.name as treatment_name, c.name as chair_name,
          COALESCE(u.full_name, u.username) as doctor_name
        FROM treatment_records tr
        LEFT JOIN treatments t ON tr.treatment_id=t.id
        LEFT JOIN chairs c ON tr.chair_id=c.id
        LEFT JOIN users u ON tr.created_by=u.id
        WHERE tr.patient_id=?
        ORDER BY tr.treated_at DESC`).all(patientId) as TreatmentRecord[]
      return { success: true, data: rows }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:addTreatmentRecord', async (_e, data: {
    patient_id: number, appointment_id?: number, treatment_id: number,
    tooth_area?: string, chair_id?: number, status: string, notes?: string,
    treated_at: string, created_by: number
  }): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare(`INSERT INTO treatment_records(patient_id,appointment_id,treatment_id,tooth_area,chair_id,status,notes,treated_at,created_by)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(
        data.patient_id, data.appointment_id ?? null, data.treatment_id,
        data.tooth_area ?? null, data.chair_id ?? null, data.status,
        data.notes ?? null, data.treated_at, data.created_by
      )

      // ── Auto-sync to dental chart when tooth number is specified ────────────
      if (data.tooth_area) {
        const treatment = db.prepare('SELECT name FROM treatments WHERE id=?').get(data.treatment_id) as { name: string } | undefined
        const procType = treatment?.name ?? 'Treatment'
        const chartStatus = data.status === 'completed' ? 'completed' : data.status === 'ongoing' ? 'ongoing' : 'planned'
        // Extract FDI tooth numbers: 2-digit numbers where first digit 1-8 and second digit 1-8
        const toothMatches = data.tooth_area.match(/\b([1-8][1-8])\b/g)
        if (toothMatches) {
          const chartStmt = db.prepare(`INSERT INTO dental_chart_entries(patient_id,tooth_number,surface,procedure_type,status,notes,done_at,created_by)
            VALUES (?,?,'full',?,?,?,?,?)`)
          for (const tn of [...new Set(toothMatches)]) {
            chartStmt.run(
              data.patient_id, tn, procType, chartStatus,
              data.notes ?? null,
              data.status === 'completed' ? data.treated_at : null,
              data.created_by
            )
          }
        }
      }

      logAudit(db, data.created_by, 'ADD_TREATMENT', 'treatment_record', data.patient_id, data.status)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  // ── Images ────────────────────────────────────────────────────────────────
  ipcMain.handle('patients:listImages', async (_e, patientId: number): Promise<IpcResult<import('../../shared/types').PatientImage[]>> => {
    try {
      const db = getDb()
      const rows = db.prepare(`SELECT pi.*, t.name as treatment_name
        FROM patient_images pi
        LEFT JOIN treatments t ON pi.treatment_id=t.id
        WHERE pi.patient_id=?
        ORDER BY pi.capture_date DESC, pi.uploaded_at DESC`).all(patientId) as import('../../shared/types').PatientImage[]
      return { success: true, data: rows }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:addImage', async (_e, data: Omit<import('../../shared/types').PatientImage, 'id' | 'uploaded_at' | 'treatment_name'>): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare(`INSERT INTO patient_images(patient_id,treatment_id,appointment_id,file_path,thumbnail_path,image_type,procedure_tag,tooth_number,notes,capture_date,uploaded_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        data.patient_id, data.treatment_id ?? null, data.appointment_id ?? null,
        data.file_path, data.thumbnail_path ?? null, data.image_type,
        data.procedure_tag ?? null, data.tooth_number ?? null, data.notes ?? null,
        data.capture_date ?? null, data.uploaded_by
      )
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:deleteImage', async (_e, id: number): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare('DELETE FROM patient_images WHERE id=?').run(id)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  // ── Timeline ──────────────────────────────────────────────────────────────
  ipcMain.handle('patients:getTimeline', async (_e, patientId: number): Promise<IpcResult<unknown[]>> => {
    try {
      const db = getDb()
      const records = db.prepare(`SELECT tr.*, t.name as treatment_name, c.name as chair_name, u.username as doctor_name
        FROM treatment_records tr
        LEFT JOIN treatments t ON tr.treatment_id=t.id
        LEFT JOIN chairs c ON tr.chair_id=c.id
        LEFT JOIN users u ON tr.created_by=u.id
        WHERE tr.patient_id=?
        ORDER BY tr.treated_at DESC`).all(patientId) as TreatmentRecord[]

      const images = db.prepare(`SELECT * FROM patient_images WHERE patient_id=?`).all(patientId) as import('../../shared/types').PatientImage[]
      const assessments = db.prepare('SELECT * FROM clinical_assessments WHERE patient_id=?').all(patientId) as ClinicalAssessment[]
      const invoices = db.prepare(`SELECT i.*, p.name as patient_name FROM invoices i
        LEFT JOIN patients p ON i.patient_id=p.id
        WHERE i.patient_id=?`).all(patientId)

      const timeline = records.map(r => ({
        ...r,
        images: images.filter(img => img.appointment_id === r.appointment_id || img.treatment_id === r.treatment_id),
        assessment: assessments.find(a => a.appointment_id === r.appointment_id),
        invoice: (invoices as Array<{ appointment_id?: number }>).find(inv => inv.appointment_id === r.appointment_id)
      }))

      return { success: true, data: timeline }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  // ── Stats ────────────────────────────────────────────────────────────────
  ipcMain.handle('patients:count', async (): Promise<IpcResult<number>> => {
    try {
      const db = getDb()
      const r = db.prepare('SELECT COUNT(*) as c FROM patients WHERE archived_at IS NULL').get() as { c: number }
      return { success: true, data: r.c }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:checkDuplicateContact', async (_e, contact: string, excludeId?: number): Promise<IpcResult<boolean>> => {
    try {
      const db = getDb()
      let sql = 'SELECT COUNT(*) as c FROM patients WHERE contact_number=? AND archived_at IS NULL'
      const params: unknown[] = [contact]
      if (excludeId) { sql += ' AND id!=?'; params.push(excludeId) }
      const r = db.prepare(sql).get(...params) as { c: number }
      return { success: true, data: r.c > 0 }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  // ── Prescriptions ─────────────────────────────────────────────────────────
  ipcMain.handle('patients:listPrescriptions', async (_e, patientId: number): Promise<IpcResult<Prescription[]>> => {
    try {
      const db = getDb()
      const rows = db.prepare(`SELECT p.*, u.username as prescribed_by_name FROM prescriptions p
        LEFT JOIN users u ON p.prescribed_by=u.id WHERE p.patient_id=? ORDER BY p.prescribed_at DESC`).all(patientId) as Prescription[]
      for (const rx of rows) {
        rx.items = db.prepare('SELECT * FROM prescription_items WHERE prescription_id=? ORDER BY id').all(rx.id) as PrescriptionItem[]
      }
      return { success: true, data: rows }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:createPrescription', async (_e, data: {
    patient_id: number; appointment_id?: number; prescribed_by: number;
    diagnosis?: string; notes?: string;
    items: Array<{ medicine_name: string; dosage?: string; frequency?: string; duration?: string; quantity: number; unit_price: number; instructions?: string }>
  }): Promise<IpcResult<number>> => {
    try {
      const db = getDb()
      const result = db.prepare(`INSERT INTO prescriptions(patient_id,appointment_id,prescribed_by,diagnosis,notes)
        VALUES (?,?,?,?,?)`).run(data.patient_id, data.appointment_id ?? null, data.prescribed_by, data.diagnosis ?? null, data.notes ?? null)
      const rxId = result.lastInsertRowid as number
      for (const item of data.items) {
        db.prepare(`INSERT INTO prescription_items(prescription_id,medicine_name,dosage,frequency,duration,quantity,unit_price,instructions)
          VALUES (?,?,?,?,?,?,?,?)`).run(rxId, item.medicine_name, item.dosage ?? null, item.frequency ?? null, item.duration ?? null, item.quantity, item.unit_price, item.instructions ?? null)
      }
      logAudit(db, data.prescribed_by, 'CREATE', 'prescription', rxId, `Patient #${data.patient_id}`)
      return { success: true, data: rxId }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('patients:updatePrescriptionStatus', async (_e, id: number, status: string, userId: number): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare('UPDATE prescriptions SET status=? WHERE id=?').run(status, id)
      logAudit(db, userId, 'UPDATE_STATUS', 'prescription', id, status)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })
}
