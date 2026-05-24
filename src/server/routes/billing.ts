/**
 * Billing routes — /api/v2/billing
 *
 * GET    /invoices              — Paginated invoice list
 * POST   /invoices              — Create invoice (auto-generates invoice number)
 * GET    /invoices/:id          — Invoice detail with items + payments
 * POST   /invoices/:id/payments — Record a payment
 * POST   /invoices/:id/void     — Void an invoice
 *
 * GET    /ledger                — Patient ledger (all transactions for a patient)
 * GET    /summary               — Revenue summary (day / month / year)
 */
import { Router }     from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, withTransaction } from '../db/postgres'
import { authenticate }     from '../middleware/auth'
import { requireMinRole }   from '../middleware/rbac'
import { validate, paginationSchema } from '../middleware/validate'
import { AppError }         from '../middleware/errorHandler'
import { nextInvoiceNumber } from '../services/opIdService'
import { auditFromRequest }  from '../services/auditService'
import {
  CreateInvoiceSchema,
  RecordPaymentSchema,
  VoidInvoiceSchema,
} from '../../shared/validationSchemas'

const router = Router()
router.use(authenticate)

// ── GET /invoices ─────────────────────────────────────────────────────────────

router.get('/invoices', validate(paginationSchema, { target: 'query' }), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number }
    const { patientId, status } = req.query as Record<string, string | undefined>
    const offset = (page - 1) * limit

    const rows = await query(
      `SELECT i.id, i.invoice_number, i.patient_id,
              p.name AS patient_name, p.op_id AS patient_op_id,
              i.billing_type, i.subtotal, i.discount_amount,
              i.tax_amount, i.total_amount, i.amount_paid, i.status,
              i.created_at
       FROM invoices i
       JOIN patients p ON p.id = i.patient_id
       WHERE i.clinic_id = $1
         AND ($2::uuid IS NULL OR i.patient_id = $2)
         AND ($3::text IS NULL OR i.status     = $3)
       ORDER BY i.created_at DESC
       LIMIT $4 OFFSET $5`,
      [req.clinicId, patientId ?? null, status ?? null, limit, offset],
    )

    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM invoices
       WHERE clinic_id = $1
         AND ($2::uuid IS NULL OR patient_id = $2)
         AND ($3::text IS NULL OR status     = $3)`,
      [req.clinicId, patientId ?? null, status ?? null],
    )
    const total = parseInt(countRow?.count ?? '0', 10)

    res.json({
      success: true,
      data: rows,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (err) { next(err) }
})

// ── POST /invoices ────────────────────────────────────────────────────────────

router.post('/invoices', validate(CreateInvoiceSchema), async (req, res, next) => {
  try {
    const {
      patient_id, appointment_id, billing_type,
      items, discount_amount, discount_reason, tax_amount,
    } = req.body as {
      patient_id: string; appointment_id?: string; billing_type: string
      items: Array<{ treatment_id?: string; description: string; quantity: number; unit_price: number }>
      discount_amount: number; discount_reason?: string; tax_amount: number
    }

    // Calculate totals server-side — never trust client-sent totals
    const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
    const total    = subtotal - discount_amount + tax_amount
    const invoiceNumber = await nextInvoiceNumber(req.clinicId)
    const invoiceId     = randomUUID()

    const invoice = await withTransaction(req.clinicId, async (client) => {
      const { rows } = await client.query<Record<string, unknown>>(
        `INSERT INTO invoices
           (id, clinic_id, invoice_number, patient_id, appointment_id,
            billing_type, subtotal, discount_amount, discount_reason,
            tax_amount, total_amount, amount_paid, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,'unpaid',$12)
         RETURNING id, invoice_number, patient_id, billing_type,
                   subtotal, discount_amount, tax_amount, total_amount,
                   amount_paid, status, created_at`,
        [invoiceId, req.clinicId, invoiceNumber, patient_id,
         appointment_id ?? null, billing_type, subtotal,
         discount_amount, discount_reason ?? null, tax_amount, total, req.staffId],
      )

      for (const item of items) {
        await client.query(
          `INSERT INTO invoice_items
             (id, clinic_id, invoice_id, treatment_id, description,
              quantity, unit_price, total_price)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [randomUUID(), req.clinicId, invoiceId,
           item.treatment_id ?? null, item.description,
           item.quantity, item.unit_price, item.quantity * item.unit_price],
        )
      }
      return rows[0]
    })

    void auditFromRequest(req, {
      clinicId: req.clinicId, staffId: req.staffId,
      action: 'CREATE', entity: 'invoice', entityId: invoiceId,
    })
    res.status(201).json({ success: true, data: invoice })
  } catch (err) { next(err) }
})

// ── GET /invoices/:id ─────────────────────────────────────────────────────────

router.get('/invoices/:id', async (req, res, next) => {
  try {
    const invoice = await queryOne(
      `SELECT i.*, p.name AS patient_name, p.op_id AS patient_op_id,
              json_agg(DISTINCT ii.*) AS items,
              json_agg(DISTINCT jsonb_build_object(
                'id', py.id, 'amount', py.amount, 'method', py.method,
                'reference_number', py.reference_number,
                'paid_at', py.paid_at, 'notes', py.notes,
                'recorded_by_name', rs.name
              )) FILTER (WHERE py.id IS NOT NULL) AS payments
       FROM invoices i
       JOIN patients p ON p.id = i.patient_id
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       LEFT JOIN payments py ON py.invoice_id = i.id
       LEFT JOIN staff rs ON rs.id = py.recorded_by
       WHERE i.id = $1 AND i.clinic_id = $2
       GROUP BY i.id, p.name, p.op_id`,
      [req.params['id'], req.clinicId],
    )
    if (!invoice) throw new AppError(404, 'Invoice not found')
    res.json({ success: true, data: invoice })
  } catch (err) { next(err) }
})

// ── POST /invoices/:id/payments ───────────────────────────────────────────────

router.post('/invoices/:id/payments', validate(RecordPaymentSchema), async (req, res, next) => {
  try {
    const { amount, method, reference_number, notes } = req.body as {
      amount: number; method: string; reference_number?: string; notes?: string
    }

    const payment = await withTransaction(req.clinicId, async (client) => {
      // Lock the invoice row
      const invRows = await client.query<{
        id: string; total_amount: number; amount_paid: number; status: string
      }>(
        `SELECT id, total_amount, amount_paid, status FROM invoices
         WHERE id = $1 AND clinic_id = $2 FOR UPDATE`,
        [req.params['id'], req.clinicId],
      )
      const inv = invRows.rows[0]
      if (!inv) throw new AppError(404, 'Invoice not found')
      if (inv.status === 'voided') throw new AppError(400, 'Cannot record payment on a voided invoice')

      const newPaid  = Number(inv.amount_paid) + amount
      const newStatus =
        newPaid >= Number(inv.total_amount) ? 'paid' :
        newPaid > 0                         ? 'partial' : 'unpaid'

      await client.query(
        `UPDATE invoices SET amount_paid = $1, status = $2 WHERE id = $3`,
        [newPaid, newStatus, inv.id],
      )

      const { rows } = await client.query<Record<string, unknown>>(
        `INSERT INTO payments
           (id, clinic_id, invoice_id, amount, method, reference_number,
            notes, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, amount, method, reference_number, notes, paid_at`,
        [randomUUID(), req.clinicId, inv.id, amount, method,
         reference_number ?? null, notes ?? null, req.staffId],
      )
      return rows[0]
    })

    void auditFromRequest(req, {
      clinicId: req.clinicId, staffId: req.staffId,
      action: 'CREATE', entity: 'payment',
      diff: { invoiceId: req.params['id'], amount, method },
    })
    res.status(201).json({ success: true, data: payment })
  } catch (err) { next(err) }
})

// ── POST /invoices/:id/void ───────────────────────────────────────────────────

router.post(
  '/invoices/:id/void',
  requireMinRole('branch_manager'),
  validate(VoidInvoiceSchema),
  async (req, res, next) => {
    try {
      const { reason } = req.body as { reason: string }

      const updated = await queryOne(
        `UPDATE invoices SET status = 'voided', void_reason = $1
         WHERE id = $2 AND clinic_id = $3 AND status != 'voided'
         RETURNING id, status, void_reason`,
        [reason, req.params['id'], req.clinicId],
      )
      if (!updated) throw new AppError(404, 'Invoice not found or already voided')

      void auditFromRequest(req, {
        clinicId: req.clinicId, staffId: req.staffId,
        action: 'UPDATE', entity: 'invoice', entityId: req.params['id'],
        diff: { status: 'voided', reason },
      })
      res.json({ success: true, data: updated })
    } catch (err) { next(err) }
  },
)

// ── GET /ledger ───────────────────────────────────────────────────────────────

router.get('/ledger', async (req, res, next) => {
  try {
    const patientId = req.query['patientId'] as string | undefined
    if (!patientId) throw new AppError(422, 'patientId query param is required')

    const rows = await query(
      `SELECT
         i.id AS invoice_id, i.invoice_number, i.billing_type,
         i.total_amount, i.amount_paid, i.status, i.created_at AS invoice_date,
         json_agg(jsonb_build_object(
           'id', py.id, 'amount', py.amount, 'method', py.method,
           'paid_at', py.paid_at
         ) ORDER BY py.paid_at) FILTER (WHERE py.id IS NOT NULL) AS payments
       FROM invoices i
       LEFT JOIN payments py ON py.invoice_id = i.id
       WHERE i.clinic_id = $1 AND i.patient_id = $2
       GROUP BY i.id
       ORDER BY i.created_at DESC`,
      [req.clinicId, patientId],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

// ── GET /summary ──────────────────────────────────────────────────────────────

router.get('/summary', async (req, res, next) => {
  try {
    const row = await queryOne(
      `SELECT
         SUM(amount) FILTER (WHERE paid_at::date = CURRENT_DATE)          AS today,
         SUM(amount) FILTER (WHERE DATE_TRUNC('month', paid_at) = DATE_TRUNC('month', now())) AS month,
         SUM(amount) FILTER (WHERE DATE_TRUNC('year',  paid_at) = DATE_TRUNC('year',  now())) AS year,
         SUM(i.total_amount - i.amount_paid)
           FILTER (WHERE i.status IN ('unpaid', 'partial'))               AS outstanding
       FROM payments py
       JOIN invoices i ON i.id = py.invoice_id
       WHERE py.clinic_id = $1`,
      [req.clinicId],
    )
    res.json({ success: true, data: row })
  } catch (err) { next(err) }
})

export default router
