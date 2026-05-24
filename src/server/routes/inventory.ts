/**
 * Inventory routes — /api/v2/inventory
 *
 * GET    /items                 — List items for a branch
 * POST   /items                 — Create item
 * PATCH  /items/:id             — Update item details
 * DELETE /items/:id             — Deactivate item
 *
 * POST   /transactions          — Record a stock transaction
 * GET    /transactions          — Transaction history (filterable)
 *
 * GET    /alerts/low-stock      — Items at or below minimum stock
 * GET    /alerts/expiring       — Items expiring within N days
 * GET    /reports/summary       — Stock value summary per branch
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
  CreateInventoryItemSchema,
  RecordInventoryTransactionSchema,
} from '../../shared/validationSchemas'

const router = Router()
router.use(authenticate)

// ── Items ─────────────────────────────────────────────────────────────────────

router.get('/items', async (req, res, next) => {
  try {
    const branchId = req.query['branchId'] as string | undefined

    // Scope to own branch if not clinic_owner
    const effectiveBranchId =
      req.role === 'clinic_owner' ? branchId ?? null : req.branchId

    const rows = await query(
      `SELECT id, branch_id, item_name, category, unit_of_measure,
              minimum_stock_level, reorder_quantity, current_stock,
              unit_cost, storage_location, supplier_name, notes, is_active
       FROM inventory_items
       WHERE clinic_id = $1
         AND ($2::uuid IS NULL OR branch_id = $2)
         AND is_active = true
       ORDER BY item_name`,
      [req.clinicId, effectiveBranchId],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

router.post(
  '/items',
  requireMinRole('branch_manager'),
  validate(CreateInventoryItemSchema),
  async (req, res, next) => {
    try {
      const {
        branch_id, item_name, category, unit_of_measure,
        minimum_stock_level, reorder_quantity, unit_cost,
        storage_location, supplier_name, notes,
      } = req.body as {
        branch_id: string; item_name: string; category: string
        unit_of_measure: string; minimum_stock_level: number
        reorder_quantity: number; unit_cost: number
        storage_location?: string; supplier_name?: string; notes?: string
      }

      const item = await queryOne(
        `INSERT INTO inventory_items
           (id, clinic_id, branch_id, item_name, category, unit_of_measure,
            minimum_stock_level, reorder_quantity, current_stock,
            unit_cost, storage_location, supplier_name, notes, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11,$12,true)
         RETURNING id, item_name, category, unit_of_measure,
                   minimum_stock_level, reorder_quantity, current_stock,
                   unit_cost, storage_location, supplier_name, is_active`,
        [randomUUID(), req.clinicId, branch_id, item_name, category,
         unit_of_measure, minimum_stock_level, reorder_quantity,
         unit_cost, storage_location ?? null, supplier_name ?? null, notes ?? null],
      )
      res.status(201).json({ success: true, data: item })
    } catch (err) { next(err) }
  },
)

router.patch('/items/:id', requireMinRole('branch_manager'), async (req, res, next) => {
  try {
    const {
      item_name, category, minimum_stock_level, reorder_quantity,
      unit_cost, storage_location, supplier_name, notes, is_active,
    } = req.body as Partial<{
      item_name: string; category: string; minimum_stock_level: number
      reorder_quantity: number; unit_cost: number; storage_location: string
      supplier_name: string; notes: string; is_active: boolean
    }>

    const updated = await queryOne(
      `UPDATE inventory_items SET
         item_name           = COALESCE($1,  item_name),
         category            = COALESCE($2,  category),
         minimum_stock_level = COALESCE($3,  minimum_stock_level),
         reorder_quantity    = COALESCE($4,  reorder_quantity),
         unit_cost           = COALESCE($5,  unit_cost),
         storage_location    = COALESCE($6,  storage_location),
         supplier_name       = COALESCE($7,  supplier_name),
         notes               = COALESCE($8,  notes),
         is_active           = COALESCE($9,  is_active)
       WHERE id = $10 AND clinic_id = $11
       RETURNING id, item_name, category, unit_of_measure,
                 minimum_stock_level, reorder_quantity, current_stock,
                 unit_cost, is_active`,
      [item_name, category, minimum_stock_level, reorder_quantity,
       unit_cost, storage_location, supplier_name, notes, is_active,
       req.params['id'], req.clinicId],
    )
    if (!updated) throw new AppError(404, 'Inventory item not found')
    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

router.delete('/items/:id', requireMinRole('branch_manager'), async (req, res, next) => {
  try {
    const deleted = await queryOne(
      `UPDATE inventory_items SET is_active = false
       WHERE id = $1 AND clinic_id = $2 RETURNING id`,
      [req.params['id'], req.clinicId],
    )
    if (!deleted) throw new AppError(404, 'Inventory item not found')
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

// ── Transactions ──────────────────────────────────────────────────────────────

router.get('/transactions', async (req, res, next) => {
  try {
    const { branchId, itemId, from, to } = req.query as Record<string, string | undefined>
    const effectiveBranchId =
      req.role === 'clinic_owner' ? branchId ?? null : req.branchId

    const rows = await query(
      `SELECT it.id, it.item_id, ii.item_name, it.branch_id,
              it.transaction_type, it.quantity, it.unit_cost,
              it.batch_number, it.expiry_date, it.supplier_ref,
              it.reason_notes, it.transaction_date,
              s.name AS recorded_by_name
       FROM inventory_transactions it
       JOIN inventory_items ii ON ii.id = it.item_id
       LEFT JOIN staff s ON s.id = it.recorded_by
       WHERE it.clinic_id = $1
         AND ($2::uuid IS NULL OR it.branch_id = $2)
         AND ($3::uuid IS NULL OR it.item_id   = $3)
         AND ($4::date IS NULL OR it.transaction_date::date >= $4::date)
         AND ($5::date IS NULL OR it.transaction_date::date <= $5::date)
       ORDER BY it.transaction_date DESC
       LIMIT 500`,
      [req.clinicId, effectiveBranchId, itemId ?? null, from ?? null, to ?? null],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

router.post(
  '/transactions',
  validate(RecordInventoryTransactionSchema),
  async (req, res, next) => {
    try {
      const {
        item_id, branch_id, transaction_type, quantity,
        unit_cost, batch_number, expiry_date, supplier_ref,
        linked_appointment_id, reason_notes,
      } = req.body as {
        item_id: string; branch_id: string; transaction_type: string
        quantity: number; unit_cost?: number; batch_number?: string
        expiry_date?: string; supplier_ref?: string
        linked_appointment_id?: string; reason_notes?: string
      }

      const txn = await withTransaction(req.clinicId, async (client) => {
        // Lock item row and validate stock won't go negative for outgoing
        const itemRows = await client.query<{ id: string; current_stock: number }>(
          `SELECT id, current_stock FROM inventory_items
           WHERE id = $1 AND clinic_id = $2 FOR UPDATE`,
          [item_id, req.clinicId],
        )
        const item = itemRows.rows[0]
        if (!item) throw new AppError(404, 'Inventory item not found')

        const isOutgoing = transaction_type.startsWith('stock_out')
        const delta      = isOutgoing ? -Math.abs(quantity) : Math.abs(quantity)

        if (isOutgoing && item.current_stock + delta < 0) {
          throw new AppError(400, `Insufficient stock — current: ${item.current_stock}, requested: ${Math.abs(quantity)}`)
        }

        await client.query(
          `UPDATE inventory_items SET current_stock = current_stock + $1 WHERE id = $2`,
          [delta, item_id],
        )

        const { rows } = await client.query<Record<string, unknown>>(
          `INSERT INTO inventory_transactions
             (id, clinic_id, item_id, branch_id, transaction_type, quantity,
              unit_cost, batch_number, expiry_date, supplier_ref,
              linked_appointment_id, reason_notes, recorded_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           RETURNING id, item_id, transaction_type, quantity,
                     unit_cost, batch_number, expiry_date, transaction_date`,
          [randomUUID(), req.clinicId, item_id, branch_id, transaction_type,
           Math.abs(quantity), unit_cost ?? null, batch_number ?? null,
           expiry_date ?? null, supplier_ref ?? null,
           linked_appointment_id ?? null, reason_notes ?? null, req.staffId],
        )
        return rows[0]
      })

      void auditFromRequest(req, {
        clinicId: req.clinicId, staffId: req.staffId,
        action: 'CREATE', entity: 'inventory_transaction',
        diff: { item_id, transaction_type, quantity },
      })
      res.status(201).json({ success: true, data: txn })
    } catch (err) { next(err) }
  },
)

// ── Alerts ────────────────────────────────────────────────────────────────────

router.get('/alerts/low-stock', async (req, res, next) => {
  try {
    const branchId = req.query['branchId'] as string | undefined
    const effectiveBranchId =
      req.role === 'clinic_owner' ? branchId ?? null : req.branchId

    const rows = await query(
      `SELECT id, branch_id, item_name, category, unit_of_measure,
              current_stock, minimum_stock_level, reorder_quantity
       FROM inventory_items
       WHERE clinic_id = $1
         AND is_active = true
         AND current_stock <= minimum_stock_level
         AND ($2::uuid IS NULL OR branch_id = $2)
       ORDER BY (current_stock - minimum_stock_level), item_name`,
      [req.clinicId, effectiveBranchId],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

router.get('/alerts/expiring', async (req, res, next) => {
  try {
    const days = parseInt((req.query['days'] as string) ?? '30', 10)
    const branchId = req.query['branchId'] as string | undefined
    const effectiveBranchId =
      req.role === 'clinic_owner' ? branchId ?? null : req.branchId

    const rows = await query(
      `SELECT it.id, it.item_id, ii.item_name, it.batch_number,
              it.expiry_date, it.quantity
       FROM inventory_transactions it
       JOIN inventory_items ii ON ii.id = it.item_id
       WHERE it.clinic_id = $1
         AND it.expiry_date IS NOT NULL
         AND it.expiry_date <= CURRENT_DATE + ($2 * INTERVAL '1 day')
         AND it.expiry_date >= CURRENT_DATE
         AND ($3::uuid IS NULL OR it.branch_id = $3)
         AND it.transaction_type LIKE 'stock_in%'
       ORDER BY it.expiry_date`,
      [req.clinicId, days, effectiveBranchId],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

// ── Reports ───────────────────────────────────────────────────────────────────

router.get('/reports/summary', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT b.id AS branch_id, b.name AS branch_name,
              COUNT(ii.id)::int  AS total_items,
              SUM(ii.current_stock * ii.unit_cost) AS stock_value,
              COUNT(ii.id) FILTER (WHERE ii.current_stock <= ii.minimum_stock_level)::int AS low_stock_count
       FROM branches b
       LEFT JOIN inventory_items ii
         ON ii.branch_id = b.id AND ii.clinic_id = b.clinic_id AND ii.is_active = true
       WHERE b.clinic_id = $1 AND b.is_active = true
       GROUP BY b.id, b.name
       ORDER BY b.name`,
      [req.clinicId],
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

export default router
