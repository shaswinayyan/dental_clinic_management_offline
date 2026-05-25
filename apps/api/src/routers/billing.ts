/**
 * Billing routes — /api/v2/billing
 *
 * GET    /invoices              — List invoices (paginated, filterable)
 * POST   /invoices              — Create invoice
 * GET    /invoices/:id          — Get invoice detail with items
 * PATCH  /invoices/:id          — Update invoice (before finalised)
 * DELETE /invoices/:id          — Void invoice [clinic_owner only]
 *
 * POST   /invoices/:id/payments — Record a payment
 * GET    /invoices/:id/payments — List payments for invoice
 *
 * GET    /ledger                — Revenue ledger summary (date range)
 */
import { Hono }          from 'hono'
import { zValidator }    from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import {
  db, invoices, invoiceItems, payments,
  eq, and, gte, lte, desc, sql, isNull
} from '@vorsa/db'
import {
  CreateInvoiceSchema, RecordPaymentSchema
} from '@vorsa/validators'
import { requireAuth }    from '../middleware/auth'
import { requireMinRole } from '../middleware/rbac'
import type { AppEnv }    from '../app'

const router = new Hono<AppEnv>()
router.use('*', requireAuth)

// ── GET /invoices ─────────────────────────────────────────────────────────────

router.get('/invoices', async (c) => {
  const clinicId  = c.get('clinicId')
  const patientId = c.req.query('patientId')
  const status    = c.req.query('status')
  const dateFrom  = c.req.query('dateFrom')
  const dateTo    = c.req.query('dateTo')
  const page      = Math.max(1, Number(c.req.query('page') ?? 1))
  const limit     = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 20)))
  const offset    = (page - 1) * limit

  const conditions = [eq(invoices.clinic_id, clinicId)]
  if (patientId) conditions.push(eq(invoices.patient_id, patientId))
  if (status)    conditions.push(eq(invoices.status, status as 'draft' | 'sent' | 'paid' | 'partial' | 'void'))
  if (dateFrom)  conditions.push(gte(invoices.created_at, new Date(dateFrom)))
  if (dateTo)    conditions.push(lte(invoices.created_at, new Date(dateTo)))

  const baseWhere = and(...conditions)

  const [rows, total] = await Promise.all([
    db.select().from(invoices)
      .where(baseWhere)
      .orderBy(desc(invoices.created_at))
      .limit(limit)
      .offset(offset),
    db.select({ n: sql<number>`COUNT(*)` })
      .from(invoices)
      .where(baseWhere)
      .then(r => Number(r[0]?.n ?? 0)),
  ])

  return c.json({
    success: true,
    data:    rows,
    meta:    { total, page, limit, pages: Math.ceil(total / limit) },
  })
})

// ── POST /invoices ────────────────────────────────────────────────────────────

router.post('/invoices',
  zValidator('json', CreateInvoiceSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const body     = c.req.valid('json')
    const { items, ...invoiceData } = body

    // Compute totals
    const subtotal = items.reduce((sum, item) => {
      return sum + parseFloat(item.unit_price) * item.quantity
    }, 0)

    const discountAmt = invoiceData.discount_amount ? parseFloat(invoiceData.discount_amount) : 0
    const taxRate     = invoiceData.tax_rate       ? parseFloat(invoiceData.tax_rate)         : 0
    const taxAmt      = (subtotal - discountAmt) * (taxRate / 100)
    const total       = subtotal - discountAmt + taxAmt

    // Insert invoice
    const [invoice] = await db.insert(invoices)
      .values({
        clinic_id:       clinicId,
        ...invoiceData,
        subtotal:        subtotal.toFixed(2),
        tax_amount:      taxAmt.toFixed(2),
        total_amount:    total.toFixed(2),
        amount_paid:     '0.00',
        status:          'draft',
      })
      .returning()

    // Insert items
    const itemRows = await db.insert(invoiceItems)
      .values(items.map(item => ({
        invoice_id:  invoice.id,
        clinic_id:   clinicId,
        ...item,
        line_total:  (parseFloat(item.unit_price) * item.quantity).toFixed(2),
      })))
      .returning()

    return c.json({ success: true, data: { ...invoice, items: itemRows } }, 201)
  },
)

// ── GET /invoices/:id ─────────────────────────────────────────────────────────

router.get('/invoices/:id', async (c) => {
  const clinicId = c.get('clinicId')
  const id       = c.req.param('id')

  const invoice = await db.select().from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.clinic_id, clinicId)))
    .limit(1)
    .then(r => r[0])

  if (!invoice) throw new HTTPException(404, { message: 'Invoice not found' })

  const items = await db.select().from(invoiceItems)
    .where(eq(invoiceItems.invoice_id, id))

  const paymentList = await db.select().from(payments)
    .where(eq(payments.invoice_id, id))
    .orderBy(desc(payments.paid_at))

  return c.json({ success: true, data: { ...invoice, items, payments: paymentList } })
})

// ── PATCH /invoices/:id ───────────────────────────────────────────────────────

router.patch('/invoices/:id', async (c) => {
  const clinicId = c.get('clinicId')
  const id       = c.req.param('id')
  const body     = await c.req.json() as Record<string, unknown>

  // Prevent editing void or paid invoices
  const existing = await db.select({ status: invoices.status }).from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.clinic_id, clinicId)))
    .limit(1)
    .then(r => r[0])

  if (!existing) throw new HTTPException(404, { message: 'Invoice not found' })
  if (existing.status === 'void') {
    throw new HTTPException(400, { message: 'Cannot edit a voided invoice' })
  }

  const [updated] = await db.update(invoices)
    .set({ ...body, updated_at: new Date() })
    .where(and(eq(invoices.id, id), eq(invoices.clinic_id, clinicId)))
    .returning()

  return c.json({ success: true, data: updated })
})

// ── DELETE /invoices/:id ──────────────────────────────────────────────────────

router.delete('/invoices/:id', requireMinRole('clinic_owner'), async (c) => {
  const clinicId = c.get('clinicId')
  const id       = c.req.param('id')

  const [updated] = await db.update(invoices)
    .set({ status: 'void', updated_at: new Date() })
    .where(and(eq(invoices.id, id), eq(invoices.clinic_id, clinicId)))
    .returning()

  if (!updated) throw new HTTPException(404, { message: 'Invoice not found' })
  return c.json({ success: true, data: updated })
})

// ── POST /invoices/:id/payments ───────────────────────────────────────────────

router.post('/invoices/:id/payments',
  zValidator('json', RecordPaymentSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const id       = c.req.param('id')
    const body     = c.req.valid('json')

    const invoice = await db.select().from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.clinic_id, clinicId)))
      .limit(1)
      .then(r => r[0])

    if (!invoice) throw new HTTPException(404, { message: 'Invoice not found' })
    if (invoice.status === 'void') {
      throw new HTTPException(400, { message: 'Cannot record payment on a voided invoice' })
    }

    const [payment] = await db.insert(payments)
      .values({
        invoice_id: id,
        clinic_id:  clinicId,
        ...body,
      })
      .returning()

    // Recompute amount_paid and update invoice status
    const totalPaid = await db.select({ n: sql<string>`SUM(amount)` })
      .from(payments)
      .where(eq(payments.invoice_id, id))
      .then(r => parseFloat(r[0]?.n ?? '0'))

    const invoiceTotal = parseFloat(invoice.total_amount)
    const newStatus: 'draft' | 'sent' | 'paid' | 'partial' | 'void' =
      totalPaid >= invoiceTotal ? 'paid' : 'partial'

    await db.update(invoices)
      .set({ amount_paid: totalPaid.toFixed(2), status: newStatus, updated_at: new Date() })
      .where(eq(invoices.id, id))

    return c.json({ success: true, data: payment }, 201)
  },
)

// ── GET /invoices/:id/payments ────────────────────────────────────────────────

router.get('/invoices/:id/payments', async (c) => {
  const clinicId = c.get('clinicId')
  const id       = c.req.param('id')

  const rows = await db.select().from(payments)
    .where(and(eq(payments.invoice_id, id), eq(payments.clinic_id, clinicId)))
    .orderBy(desc(payments.paid_at))

  return c.json({ success: true, data: rows })
})

// ── GET /ledger ────────────────────────────────────────────────────────────────

router.get('/ledger', requireMinRole('branch_manager'), async (c) => {
  const clinicId = c.get('clinicId')
  const dateFrom = c.req.query('dateFrom')
  const dateTo   = c.req.query('dateTo')

  const conditions = [eq(payments.clinic_id, clinicId)]
  if (dateFrom) conditions.push(gte(payments.paid_at, new Date(dateFrom)))
  if (dateTo)   conditions.push(lte(payments.paid_at, new Date(dateTo)))

  const summary = await db.select({
    payment_method: payments.payment_method,
    total:          sql<string>`SUM(${payments.amount})`,
    count:          sql<number>`COUNT(*)`,
  })
    .from(payments)
    .where(and(...conditions))
    .groupBy(payments.payment_method)

  const grandTotal = summary.reduce((sum, row) => sum + parseFloat(row.total ?? '0'), 0)

  return c.json({
    success: true,
    data: {
      by_method:   summary,
      grand_total: grandTotal.toFixed(2),
      date_from:   dateFrom,
      date_to:     dateTo,
    },
  })
})

export default router
