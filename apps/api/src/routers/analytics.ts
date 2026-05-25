/**
 * Analytics routes — /api/v2/analytics  [Business + Enterprise plans only]
 *
 * GET  /revenue       — Revenue summary (total, by method, by period)
 * GET  /appointments  — Appointment stats (total, by status, by doctor)
 * GET  /patients      — Patient stats (new, returning, total)
 * GET  /procedures    — Top treatments by revenue + volume
 * GET  /doctors       — Per-doctor performance summary
 * GET  /overview      — Combined KPI dashboard snapshot
 */
import { Hono }     from 'hono'
import { HTTPException } from 'hono/http-exception'
import {
  db, payments, appointments, patients, invoices, treatments, treatmentRecords, staff,
  eq, and, gte, lte, desc, sql, isNull
} from '@vorsa/db'
import { requireAuth }   from '../middleware/auth'
import { requirePlan }   from '../middleware/planGuard'
import type { AppEnv }   from '../app'

const router = new Hono<AppEnv>()
router.use('*', requireAuth)
router.use('*', requirePlan('business', 'enterprise'))

/** Parse query date range, defaulting to current month */
function getDateRange(c: Parameters<typeof router.get>[1] extends (...args: infer A) => unknown ? A[0] : never) {
  const now      = new Date()
  const dateFrom = c.req.query('dateFrom') ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const dateTo   = c.req.query('dateTo')   ?? now.toISOString()
  return { from: new Date(dateFrom), to: new Date(dateTo) }
}

// ── GET /revenue ───────────────────────────────────────────────────────────────

router.get('/revenue', async (c) => {
  const clinicId = c.get('clinicId')
  const { from, to } = getDateRange(c)

  const [byMethod, daily] = await Promise.all([
    // Revenue grouped by payment method
    db.select({
      method: payments.payment_method,
      total:  sql<string>`SUM(${payments.amount})`,
      count:  sql<number>`COUNT(*)`,
    })
      .from(payments)
      .where(and(
        eq(payments.clinic_id, clinicId),
        gte(payments.paid_at, from),
        lte(payments.paid_at, to),
      ))
      .groupBy(payments.payment_method),

    // Daily revenue trend
    db.select({
      date:  sql<string>`DATE(${payments.paid_at})`,
      total: sql<string>`SUM(${payments.amount})`,
    })
      .from(payments)
      .where(and(
        eq(payments.clinic_id, clinicId),
        gte(payments.paid_at, from),
        lte(payments.paid_at, to),
      ))
      .groupBy(sql`DATE(${payments.paid_at})`)
      .orderBy(sql`DATE(${payments.paid_at})`),
  ])

  const grandTotal = byMethod.reduce((s, r) => s + parseFloat(r.total ?? '0'), 0)

  return c.json({
    success: true,
    data: {
      grand_total: grandTotal.toFixed(2),
      by_method:   byMethod,
      daily_trend: daily,
      date_from:   from,
      date_to:     to,
    },
  })
})

// ── GET /appointments ─────────────────────────────────────────────────────────

router.get('/appointments', async (c) => {
  const clinicId = c.get('clinicId')
  const { from, to } = getDateRange(c)

  const [byStatus, byDoctor] = await Promise.all([
    db.select({
      status: appointments.status,
      count:  sql<number>`COUNT(*)`,
    })
      .from(appointments)
      .where(and(
        eq(appointments.clinic_id, clinicId),
        gte(appointments.start_time, from),
        lte(appointments.start_time, to),
      ))
      .groupBy(appointments.status),

    db.select({
      doctor_id: appointments.doctor_id,
      count:     sql<number>`COUNT(*)`,
    })
      .from(appointments)
      .where(and(
        eq(appointments.clinic_id, clinicId),
        gte(appointments.start_time, from),
        lte(appointments.start_time, to),
      ))
      .groupBy(appointments.doctor_id),
  ])

  const total = byStatus.reduce((s, r) => s + Number(r.count), 0)

  return c.json({
    success: true,
    data: {
      total,
      by_status: byStatus,
      by_doctor: byDoctor,
      date_from: from,
      date_to:   to,
    },
  })
})

// ── GET /patients ─────────────────────────────────────────────────────────────

router.get('/patients', async (c) => {
  const clinicId = c.get('clinicId')
  const { from, to } = getDateRange(c)

  const [total, newPatients] = await Promise.all([
    db.select({ n: sql<number>`COUNT(*)` })
      .from(patients)
      .where(and(eq(patients.clinic_id, clinicId), isNull(patients.archived_at)))
      .then(r => Number(r[0]?.n ?? 0)),

    db.select({ n: sql<number>`COUNT(*)` })
      .from(patients)
      .where(and(
        eq(patients.clinic_id, clinicId),
        isNull(patients.archived_at),
        gte(patients.created_at, from),
        lte(patients.created_at, to),
      ))
      .then(r => Number(r[0]?.n ?? 0)),
  ])

  return c.json({
    success: true,
    data: {
      total,
      new_in_period: newPatients,
      returning:     total - newPatients,
      date_from:     from,
      date_to:       to,
    },
  })
})

// ── GET /procedures ────────────────────────────────────────────────────────────

router.get('/procedures', async (c) => {
  const clinicId = c.get('clinicId')
  const { from, to } = getDateRange(c)

  const rows = await db.select({
    treatment_id:   treatmentRecords.treatment_id,
    count:          sql<number>`COUNT(*)`,
    revenue:        sql<string>`SUM(${treatmentRecords.price})`,
  })
    .from(treatmentRecords)
    .where(and(
      eq(treatmentRecords.clinic_id, clinicId),
      gte(treatmentRecords.created_at, from),
      lte(treatmentRecords.created_at, to),
    ))
    .groupBy(treatmentRecords.treatment_id)
    .orderBy(desc(sql`SUM(${treatmentRecords.price})`))
    .limit(20)

  return c.json({ success: true, data: { top_procedures: rows, date_from: from, date_to: to } })
})

// ── GET /doctors ───────────────────────────────────────────────────────────────

router.get('/doctors', async (c) => {
  const clinicId = c.get('clinicId')
  const { from, to } = getDateRange(c)

  const apptStats = await db.select({
    doctor_id:  appointments.doctor_id,
    appt_count: sql<number>`COUNT(*)`,
    completed:  sql<number>`COUNT(*) FILTER (WHERE ${appointments.status} = 'completed')`,
  })
    .from(appointments)
    .where(and(
      eq(appointments.clinic_id, clinicId),
      gte(appointments.start_time, from),
      lte(appointments.start_time, to),
    ))
    .groupBy(appointments.doctor_id)

  // Enrich with doctor names
  const doctorIds = apptStats.map(r => r.doctor_id).filter(Boolean) as string[]
  const doctorMap = doctorIds.length > 0
    ? await db.select({ id: staff.id, name: staff.name })
        .from(staff)
        .where(eq(staff.clinic_id, clinicId))
        .then(rows => Object.fromEntries(rows.map(r => [r.id, r.name])))
    : {}

  const data = apptStats.map(r => ({
    ...r,
    doctor_name: r.doctor_id ? doctorMap[r.doctor_id] ?? 'Unknown' : 'Unassigned',
  }))

  return c.json({ success: true, data: { doctors: data, date_from: from, date_to: to } })
})

// ── GET /overview ──────────────────────────────────────────────────────────────

router.get('/overview', async (c) => {
  const clinicId = c.get('clinicId')
  const now      = new Date()
  const from     = new Date(now.getFullYear(), now.getMonth(), 1)

  const [revenue, apptCount, patientCount, newPatients] = await Promise.all([
    db.select({ total: sql<string>`COALESCE(SUM(${payments.amount}), '0')` })
      .from(payments)
      .where(and(eq(payments.clinic_id, clinicId), gte(payments.paid_at, from)))
      .then(r => r[0]?.total ?? '0'),

    db.select({ n: sql<number>`COUNT(*)` })
      .from(appointments)
      .where(and(
        eq(appointments.clinic_id, clinicId),
        gte(appointments.start_time, from),
      ))
      .then(r => Number(r[0]?.n ?? 0)),

    db.select({ n: sql<number>`COUNT(*)` })
      .from(patients)
      .where(and(eq(patients.clinic_id, clinicId), isNull(patients.archived_at)))
      .then(r => Number(r[0]?.n ?? 0)),

    db.select({ n: sql<number>`COUNT(*)` })
      .from(patients)
      .where(and(
        eq(patients.clinic_id, clinicId),
        isNull(patients.archived_at),
        gte(patients.created_at, from),
      ))
      .then(r => Number(r[0]?.n ?? 0)),
  ])

  return c.json({
    success: true,
    data: {
      month_revenue:       revenue,
      month_appointments:  apptCount,
      total_patients:      patientCount,
      new_patients_month:  newPatients,
      period_start:        from,
    },
  })
})

export default router
