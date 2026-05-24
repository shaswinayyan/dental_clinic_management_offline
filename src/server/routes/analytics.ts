/**
 * Analytics routes — /api/v2/analytics  (PRD §9.5)
 * Available on Business and Enterprise plans.
 *
 * GET /revenue          — Daily/weekly/monthly revenue by branch, doctor, category
 * GET /appointments     — Chair utilisation, no-show rates, cancellation rates
 * GET /patients         — New vs returning, visit frequency, lapsed patients
 * GET /procedures       — Top procedures by volume and revenue
 * GET /doctors          — Doctor performance metrics
 * GET /inventory        — Material cost per procedure, stock turnover
 * GET /dashboard        — Summary stats for the main analytics dashboard
 */
import { Router } from 'express'
import { query, queryOne } from '../db/postgres'
import { authenticate }    from '../middleware/auth'
import { requireMinRole }  from '../middleware/rbac'
import { requirePlan }     from '../middleware/planGuard'
import { AppError }        from '../middleware/errorHandler'

const router = Router()

// All analytics require auth + Business/Enterprise plan
router.use(authenticate, requirePlan('business', 'enterprise'))

// ── Helper: parse date range query params ─────────────────────────────────────

function parseDateRange(query: Record<string, string | undefined>): { from: string; to: string } {
  const to   = query['to']   ?? new Date().toISOString().slice(0, 10)
  const from = query['from'] ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  return { from, to }
}

// ── GET /dashboard — summary KPIs ─────────────────────────────────────────────

router.get('/dashboard', async (req, res, next) => {
  try {
    const branchId = req.query['branchId'] as string | undefined
    const effectiveBranchId =
      req.role === 'clinic_owner' ? branchId ?? null : req.branchId

    const [revenue, appts, patients] = await Promise.all([
      queryOne<{
        today: string; this_month: string; last_month: string; outstanding: string
      }>(
        `SELECT
           COALESCE(SUM(py.amount) FILTER (WHERE py.paid_at::date = CURRENT_DATE), 0)::text AS today,
           COALESCE(SUM(py.amount) FILTER (WHERE DATE_TRUNC('month', py.paid_at) = DATE_TRUNC('month', now())), 0)::text AS this_month,
           COALESCE(SUM(py.amount) FILTER (WHERE DATE_TRUNC('month', py.paid_at) = DATE_TRUNC('month', now() - INTERVAL '1 month')), 0)::text AS last_month,
           COALESCE(SUM(i.total_amount - i.amount_paid) FILTER (WHERE i.status IN ('unpaid','partial')), 0)::text AS outstanding
         FROM payments py
         JOIN invoices i ON i.id = py.invoice_id
         WHERE py.clinic_id = $1 AND ($2::uuid IS NULL OR i.branch_id = $2)`,
        [req.clinicId, effectiveBranchId],
      ),
      queryOne<{
        today: string; confirmed: string; completed: string; cancelled: string
        no_show_rate: string
      }>(
        `SELECT
           COUNT(*) FILTER (WHERE a.scheduled_at::date = CURRENT_DATE)::text AS today,
           COUNT(*) FILTER (WHERE a.status = 'confirmed')::text AS confirmed,
           COUNT(*) FILTER (WHERE a.status = 'completed' AND DATE_TRUNC('month', a.scheduled_at) = DATE_TRUNC('month', now()))::text AS completed,
           COUNT(*) FILTER (WHERE a.status = 'cancelled' AND DATE_TRUNC('month', a.scheduled_at) = DATE_TRUNC('month', now()))::text AS cancelled,
           ROUND(
             100.0 * COUNT(*) FILTER (WHERE a.status = 'cancelled' AND DATE_TRUNC('month', a.scheduled_at) = DATE_TRUNC('month', now())) /
             NULLIF(COUNT(*) FILTER (WHERE DATE_TRUNC('month', a.scheduled_at) = DATE_TRUNC('month', now())), 0),
           1)::text AS no_show_rate
         FROM appointments a
         WHERE a.clinic_id = $1 AND ($2::uuid IS NULL OR a.branch_id = $2)`,
        [req.clinicId, effectiveBranchId],
      ),
      queryOne<{ total: string; new_this_month: string; lapsed_count: string }>(
        `SELECT
           COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', now()))::text AS new_this_month,
           COUNT(*) FILTER (WHERE p.id NOT IN (
             SELECT DISTINCT patient_id FROM appointments
             WHERE clinic_id = p.clinic_id AND scheduled_at > now() - INTERVAL '6 months'
           ))::text AS lapsed_count
         FROM patients p
         WHERE p.clinic_id = $1 AND p.archived_at IS NULL
           AND ($2::uuid IS NULL OR p.branch_id = $2)`,
        [req.clinicId, effectiveBranchId],
      ),
    ])

    res.json({
      success: true,
      data: {
        revenue: {
          today:       parseFloat(revenue?.today ?? '0'),
          this_month:  parseFloat(revenue?.this_month ?? '0'),
          last_month:  parseFloat(revenue?.last_month ?? '0'),
          outstanding: parseFloat(revenue?.outstanding ?? '0'),
          growth_pct:  revenue?.last_month && parseFloat(revenue.last_month) > 0
            ? Math.round((parseFloat(revenue.this_month ?? '0') - parseFloat(revenue.last_month)) / parseFloat(revenue.last_month) * 100)
            : null,
        },
        appointments: {
          today:         parseInt(appts?.today ?? '0', 10),
          confirmed:     parseInt(appts?.confirmed ?? '0', 10),
          completed:     parseInt(appts?.completed ?? '0', 10),
          cancelled:     parseInt(appts?.cancelled ?? '0', 10),
          cancellation_rate: parseFloat(appts?.no_show_rate ?? '0'),
        },
        patients: {
          total:          parseInt(patients?.total ?? '0', 10),
          new_this_month: parseInt(patients?.new_this_month ?? '0', 10),
          lapsed:         parseInt(patients?.lapsed_count ?? '0', 10),
        },
      },
    })
  } catch (err) { next(err) }
})

// ── GET /revenue — revenue breakdown ─────────────────────────────────────────

router.get('/revenue', async (req, res, next) => {
  try {
    const { from, to }  = parseDateRange(req.query as Record<string, string | undefined>)
    const groupBy       = (req.query['groupBy'] as string) ?? 'day'   // day | week | month
    const branchId      = req.query['branchId'] as string | undefined
    const effectiveBranch = req.role === 'clinic_owner' ? branchId ?? null : req.branchId

    const truncFn = groupBy === 'month' ? 'month' : groupBy === 'week' ? 'week' : 'day'

    const rows = await query(
      `SELECT
         DATE_TRUNC($1, py.paid_at)::date AS period,
         b.name AS branch_name,
         COALESCE(SUM(py.amount), 0) AS revenue,
         COUNT(DISTINCT py.invoice_id) AS invoice_count
       FROM payments py
       JOIN invoices i ON i.id = py.invoice_id
       JOIN branches b ON b.id = i.branch_id
       WHERE py.clinic_id = $2
         AND py.paid_at::date BETWEEN $3 AND $4
         AND ($5::uuid IS NULL OR i.branch_id = $5)
       GROUP BY 1, 2
       ORDER BY 1, 2`,
      [truncFn, req.clinicId, from, to, effectiveBranch],
    )

    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

// ── GET /appointments — utilisation & cancellation metrics ────────────────────

router.get('/appointments', async (req, res, next) => {
  try {
    const { from, to }  = parseDateRange(req.query as Record<string, string | undefined>)
    const branchId      = req.query['branchId'] as string | undefined
    const effectiveBranch = req.role === 'clinic_owner' ? branchId ?? null : req.branchId

    const rows = await query(
      `SELECT
         a.scheduled_at::date AS date,
         c.name AS chair_name,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE a.status = 'completed') AS completed,
         COUNT(*) FILTER (WHERE a.status = 'cancelled') AS cancelled,
         ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'completed') / NULLIF(COUNT(*),0), 1) AS utilisation_pct,
         SUM(a.duration_minutes) AS total_minutes_booked
       FROM appointments a
       JOIN chairs c ON c.id = a.chair_id
       WHERE a.clinic_id = $1
         AND a.scheduled_at::date BETWEEN $2 AND $3
         AND ($4::uuid IS NULL OR a.branch_id = $4)
       GROUP BY 1, 2
       ORDER BY 1, 2`,
      [req.clinicId, from, to, effectiveBranch],
    )

    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

// ── GET /patients — retention metrics ────────────────────────────────────────

router.get('/patients', async (req, res, next) => {
  try {
    const { from, to } = parseDateRange(req.query as Record<string, string | undefined>)

    // New vs returning per month
    const cohorts = await query(
      `SELECT
         DATE_TRUNC('month', a.scheduled_at)::date AS month,
         COUNT(DISTINCT CASE WHEN p.created_at >= a.scheduled_at - INTERVAL '30 days' THEN p.id END) AS new_patients,
         COUNT(DISTINCT CASE WHEN p.created_at <  a.scheduled_at - INTERVAL '30 days' THEN p.id END) AS returning_patients
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       WHERE a.clinic_id = $1
         AND a.scheduled_at::date BETWEEN $2 AND $3
         AND a.status = 'completed'
       GROUP BY 1
       ORDER BY 1`,
      [req.clinicId, from, to],
    )

    // Lapsed patients (no appointment in 6 months)
    const lapsed = await query(
      `SELECT p.id, p.op_id, p.name, p.contact_number,
              MAX(a.scheduled_at)::date AS last_visit
       FROM patients p
       LEFT JOIN appointments a ON a.patient_id = p.id AND a.status = 'completed'
       WHERE p.clinic_id = $1 AND p.archived_at IS NULL
       GROUP BY p.id, p.op_id, p.name, p.contact_number
       HAVING MAX(a.scheduled_at) < now() - INTERVAL '6 months'
          OR MAX(a.scheduled_at) IS NULL
       ORDER BY last_visit NULLS FIRST
       LIMIT 100`,
      [req.clinicId],
    )

    res.json({ success: true, data: { cohorts, lapsed } })
  } catch (err) { next(err) }
})

// ── GET /procedures — procedure mix ──────────────────────────────────────────

router.get('/procedures', async (req, res, next) => {
  try {
    const { from, to } = parseDateRange(req.query as Record<string, string | undefined>)

    const rows = await query(
      `SELECT
         t.name AS treatment_name,
         t.category,
         COUNT(tr.id) AS volume,
         COALESCE(SUM(ii.total_price), 0) AS revenue,
         ROUND(AVG(ii.unit_price), 2) AS avg_price
       FROM treatment_records tr
       JOIN treatments t ON t.id = tr.treatment_id
       LEFT JOIN invoice_items ii ON ii.treatment_id = tr.treatment_id
       LEFT JOIN invoices inv ON inv.id = ii.invoice_id
         AND inv.clinic_id = $1
         AND inv.created_at::date BETWEEN $2 AND $3
       WHERE tr.clinic_id = $1
         AND tr.treated_at::date BETWEEN $2 AND $3
       GROUP BY t.id, t.name, t.category
       ORDER BY volume DESC
       LIMIT 20`,
      [req.clinicId, from, to],
    )

    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

// ── GET /doctors — doctor performance ────────────────────────────────────────

router.get('/doctors', async (req, res, next) => {
  try {
    // Only clinic_owner can see all doctors; doctors see only themselves
    if (req.role === 'doctor') {
      throw new AppError(403, 'Doctors can only view their own dashboard via /auth/me')
    }

    const { from, to } = parseDateRange(req.query as Record<string, string | undefined>)

    const rows = await query(
      `SELECT
         s.id AS doctor_id,
         s.name AS doctor_name,
         s.designation,
         COUNT(a.id) FILTER (WHERE a.status = 'completed') AS completed,
         COUNT(a.id) FILTER (WHERE a.status = 'cancelled') AS cancelled,
         COUNT(DISTINCT a.patient_id) AS unique_patients,
         COALESCE(SUM(ii.total_price), 0) AS revenue_generated
       FROM staff s
       LEFT JOIN appointments a ON a.doctor_id = s.id
         AND a.scheduled_at::date BETWEEN $2 AND $3
       LEFT JOIN treatment_records tr ON tr.appointment_id = a.id
       LEFT JOIN invoice_items ii ON ii.treatment_id = tr.treatment_id
       WHERE s.clinic_id = $1 AND s.role = 'doctor' AND s.is_active = true
       GROUP BY s.id, s.name, s.designation
       ORDER BY completed DESC`,
      [req.clinicId, from, to],
    )

    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

// ── GET /inventory — stock cost & turnover ────────────────────────────────────

router.get('/inventory', async (req, res, next) => {
  try {
    const { from, to } = parseDateRange(req.query as Record<string, string | undefined>)
    const branchId      = req.query['branchId'] as string | undefined
    const effectiveBranch = req.role === 'clinic_owner' ? branchId ?? null : req.branchId

    const rows = await query(
      `SELECT
         ii.item_name, ii.category,
         ii.current_stock, ii.unit_cost,
         ii.current_stock * ii.unit_cost AS stock_value,
         COALESCE(SUM(it.quantity) FILTER (WHERE it.transaction_type LIKE 'stock_out%' AND it.transaction_date::date BETWEEN $3 AND $4), 0) AS consumed_qty,
         COALESCE(SUM(it.quantity * it.unit_cost) FILTER (WHERE it.transaction_type LIKE 'stock_out%' AND it.transaction_date::date BETWEEN $3 AND $4), 0) AS consumed_cost
       FROM inventory_items ii
       LEFT JOIN inventory_transactions it ON it.item_id = ii.id
       WHERE ii.clinic_id = $1
         AND ii.is_active = true
         AND ($2::uuid IS NULL OR ii.branch_id = $2)
       GROUP BY ii.id, ii.item_name, ii.category, ii.current_stock, ii.unit_cost
       ORDER BY consumed_cost DESC`,
      [req.clinicId, effectiveBranch, from, to],
    )

    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

export default router
