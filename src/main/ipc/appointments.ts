import { ipcMain } from 'electron'
import { getDb } from '../db'
import type { IpcResult, Appointment, AppointmentFormData, Chair, Treatment, DashboardStats } from '../../shared/types'
import { logAudit } from '../utils/audit'

export function registerAppointmentHandlers(): void {
  ipcMain.handle('appointments:listChairs', async (): Promise<IpcResult<Chair[]>> => {
    try {
      const db = getDb()
      return { success: true, data: db.prepare('SELECT * FROM chairs ORDER BY id').all() as Chair[] }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('appointments:listTreatments', async (): Promise<IpcResult<Treatment[]>> => {
    try {
      const db = getDb()
      return { success: true, data: db.prepare('SELECT * FROM treatments WHERE is_active=1 ORDER BY name').all() as Treatment[] }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('appointments:allTreatments', async (): Promise<IpcResult<Treatment[]>> => {
    try {
      const db = getDb()
      return { success: true, data: db.prepare('SELECT * FROM treatments ORDER BY name').all() as Treatment[] }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('appointments:createTreatment', async (_e, data: Omit<Treatment, 'id'>): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare(`INSERT INTO treatments(name,category,default_duration_minutes,default_price,applicable_chairs,is_active)
        VALUES (?,?,?,?,?,?)`).run(data.name, data.category, data.default_duration_minutes, data.default_price, data.applicable_chairs, data.is_active)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('appointments:updateTreatment', async (_e, id: number, data: Partial<Treatment>): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare(`UPDATE treatments SET name=?,category=?,default_duration_minutes=?,default_price=?,applicable_chairs=?,is_active=? WHERE id=?`).run(
        data.name, data.category, data.default_duration_minutes, data.default_price, data.applicable_chairs, data.is_active, id
      )
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('appointments:list', async (_e, filters?: {
    date?: string, chairId?: number, status?: string, patientId?: number, dateFrom?: string, dateTo?: string
  }): Promise<IpcResult<Appointment[]>> => {
    try {
      const db = getDb()
      let sql = `SELECT a.*, p.name as patient_name, p.op_id as patient_op_id,
        p.contact_number as patient_contact_number,
        c.name as chair_name, t.name as treatment_name
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id=p.id
        LEFT JOIN chairs c ON a.chair_id=c.id
        LEFT JOIN treatments t ON a.treatment_id=t.id
        WHERE 1=1`
      const params: unknown[] = []
      if (filters?.date) {
        sql += ' AND date(a.scheduled_at)=?'
        params.push(filters.date)
      }
      if (filters?.dateFrom) {
        sql += ' AND date(a.scheduled_at)>=?'
        params.push(filters.dateFrom)
      }
      if (filters?.dateTo) {
        sql += ' AND date(a.scheduled_at)<=?'
        params.push(filters.dateTo)
      }
      if (filters?.chairId) {
        sql += ' AND a.chair_id=?'
        params.push(filters.chairId)
      }
      if (filters?.status) {
        sql += ' AND a.status=?'
        params.push(filters.status)
      }
      if (filters?.patientId) {
        sql += ' AND a.patient_id=?'
        params.push(filters.patientId)
      }
      sql += ' ORDER BY a.scheduled_at ASC'
      return { success: true, data: db.prepare(sql).all(...params) as Appointment[] }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('appointments:get', async (_e, id: number): Promise<IpcResult<Appointment>> => {
    try {
      const db = getDb()
      const row = db.prepare(`SELECT a.*, p.name as patient_name, p.op_id as patient_op_id,
        p.contact_number as patient_contact_number,
        c.name as chair_name, t.name as treatment_name
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id=p.id
        LEFT JOIN chairs c ON a.chair_id=c.id
        LEFT JOIN treatments t ON a.treatment_id=t.id
        WHERE a.id=?`).get(id) as Appointment | undefined
      if (!row) return { success: false, error: 'Appointment not found' }
      return { success: true, data: row }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('appointments:create', async (_e, data: AppointmentFormData): Promise<IpcResult<number>> => {
    try {
      const db = getDb()
      // Conflict check
      const conflict = db.prepare(`SELECT id FROM appointments
        WHERE chair_id=? AND status NOT IN ('cancelled','rescheduled')
        AND (
          (scheduled_at <= ? AND datetime(scheduled_at, '+' || duration_minutes || ' minutes') > ?)
          OR
          (scheduled_at < datetime(?,'+' || ? || ' minutes') AND scheduled_at >= ?)
        )`).get(
          data.chair_id,
          data.scheduled_at, data.scheduled_at,
          data.scheduled_at, String(data.duration_minutes), data.scheduled_at
        )
      if (conflict) return { success: false, error: 'This time slot is already booked for the selected chair.' }

      const result = db.prepare(`INSERT INTO appointments(patient_id,chair_id,treatment_id,scheduled_at,duration_minutes,notes)
        VALUES (?,?,?,?,?,?)`).run(
        data.patient_id, data.chair_id, data.treatment_id,
        data.scheduled_at, data.duration_minutes, data.notes ?? null
      )
      logAudit(db, null, 'CREATE', 'appointment', result.lastInsertRowid as number, `Patient #${data.patient_id} at ${data.scheduled_at}`)
      return { success: true, data: result.lastInsertRowid as number }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('appointments:update', async (_e, id: number, data: Partial<AppointmentFormData>): Promise<IpcResult> => {
    try {
      const db = getDb()
      const existing = db.prepare('SELECT * FROM appointments WHERE id=?').get(id) as Appointment
      db.prepare(`UPDATE appointments SET
        scheduled_at=COALESCE(?,scheduled_at),
        duration_minutes=COALESCE(?,duration_minutes),
        treatment_id=COALESCE(?,treatment_id),
        chair_id=COALESCE(?,chair_id),
        notes=COALESCE(?,notes)
        WHERE id=?`).run(
        data.scheduled_at ?? null, data.duration_minutes ?? null,
        data.treatment_id ?? null, data.chair_id ?? null,
        data.notes ?? (existing.notes ?? null), id
      )
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('appointments:updateStatus', async (_e, id: number, status: string, confirmedBy?: number): Promise<IpcResult> => {
    try {
      const db = getDb()
      if (status === 'completed') {
        db.prepare(`UPDATE appointments SET status=?,completed_at=datetime('now','localtime'),confirmed_by=COALESCE(?,confirmed_by) WHERE id=?`).run(status, confirmedBy ?? null, id)
      } else {
        db.prepare(`UPDATE appointments SET status=?,confirmed_by=COALESCE(?,confirmed_by) WHERE id=?`).run(status, confirmedBy ?? null, id)
      }
      logAudit(db, confirmedBy ?? null, 'STATUS_CHANGE', 'appointment', id, status)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('appointments:reschedule', async (_e, id: number, newScheduledAt: string, newDuration: number): Promise<IpcResult<number>> => {
    try {
      const db = getDb()
      const original = db.prepare('SELECT * FROM appointments WHERE id=?').get(id) as Appointment
      if (!original) return { success: false, error: 'Appointment not found' }

      // Mark original as rescheduled
      db.prepare('UPDATE appointments SET status=? WHERE id=?').run('rescheduled', id)

      // Create new appointment
      const result = db.prepare(`INSERT INTO appointments(patient_id,chair_id,treatment_id,scheduled_at,duration_minutes,notes)
        VALUES (?,?,?,?,?,?)`).run(
        original.patient_id, original.chair_id, original.treatment_id,
        newScheduledAt, newDuration, original.notes ?? null
      )
      logAudit(db, null, 'RESCHEDULE', 'appointment', id, newScheduledAt)
      return { success: true, data: result.lastInsertRowid as number }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('appointments:updateChair', async (_e, chairId: number, slotMinutes: number): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare('UPDATE chairs SET default_slot_minutes=? WHERE id=?').run(slotMinutes, chairId)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('appointments:dashboard', async (): Promise<IpcResult<DashboardStats>> => {
    try {
      const db = getDb()
      const today = new Date().toISOString().slice(0, 10)
      const monthStart = today.slice(0, 7) + '-01'

      const todayAppts = (db.prepare(`SELECT COUNT(*) as c FROM appointments WHERE date(scheduled_at)=? AND status NOT IN ('cancelled')`).get(today) as { c: number }).c
      const confirmedAppts = (db.prepare(`SELECT COUNT(*) as c FROM appointments WHERE date(scheduled_at)=? AND status='confirmed'`).get(today) as { c: number }).c
      const pendingAppts = (db.prepare(`SELECT COUNT(*) as c FROM appointments WHERE date(scheduled_at)=? AND status='pending'`).get(today) as { c: number }).c
      const totalPatients = (db.prepare(`SELECT COUNT(*) as c FROM patients WHERE archived_at IS NULL`).get() as { c: number }).c
      const monthRevenue = (db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE date(paid_at)>=?`).get(monthStart) as { s: number }).s
      const outstanding = (db.prepare(`SELECT COALESCE(SUM(total_amount-amount_paid),0) as s FROM invoices WHERE status IN ('unpaid','partial')`).get() as { s: number }).s
      const lowStock = (db.prepare(`SELECT COUNT(*) as c FROM inventory_items WHERE is_active=1 AND (
        SELECT COALESCE(SUM(quantity),0) FROM inventory_transactions WHERE item_id=inventory_items.id
      ) <= minimum_stock_level`).get() as { c: number }).c

      const alertDays = (db.prepare(`SELECT value FROM app_settings WHERE key='expiry_alert_days'`).get() as { value: string } | undefined)?.value ?? '30'
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + parseInt(alertDays))
      const expiringItems = (db.prepare(`SELECT COUNT(DISTINCT item_id) as c FROM inventory_transactions WHERE expiry_date IS NOT NULL AND expiry_date<=? AND expiry_date>=?`).get(expiryDate.toISOString().slice(0, 10), today) as { c: number }).c

      return {
        success: true,
        data: {
          todayAppointments: todayAppts,
          confirmedAppointments: confirmedAppts,
          pendingAppointments: pendingAppts,
          totalPatients,
          monthRevenue,
          outstandingBalance: outstanding,
          lowStockCount: lowStock,
          expiringItemsCount: expiringItems
        }
      }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })
}
