/**
 * Inventory routes — /api/v2/inventory
 *
 * GET    /items              — List inventory items (with low-stock filter)
 * POST   /items              — Create item [branch_manager+]
 * GET    /items/:id          — Get item detail
 * PATCH  /items/:id          — Update item [branch_manager+]
 * DELETE /items/:id          — Deactivate item [clinic_owner only]
 *
 * GET    /items/:id/transactions — List transactions for item
 * POST   /items/:id/transactions — Record stock transaction (in/out/adjustment)
 *
 * GET    /alerts             — Items below reorder level
 */
import { Hono }          from 'hono'
import { zValidator }    from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import {
  db, inventoryItems, inventoryTransactions,
  eq, and, lte, desc, sql
} from '@vorsa/db'
import {
  CreateInventoryItemSchema, RecordInventoryTransactionSchema
} from '@vorsa/validators'
import { requireAuth }    from '../middleware/auth'
import { requireMinRole } from '../middleware/rbac'
import type { AppEnv }    from '../app'

const router = new Hono<AppEnv>()
router.use('*', requireAuth)

// ── GET /items ────────────────────────────────────────────────────────────────

router.get('/items', async (c) => {
  const clinicId  = c.get('clinicId')
  const branchId  = c.req.query('branchId')
  const lowStock  = c.req.query('lowStock') === 'true'
  const category  = c.req.query('category')

  const conditions = [
    eq(inventoryItems.clinic_id, clinicId),
    eq(inventoryItems.is_active, true),
  ]

  if (branchId) conditions.push(eq(inventoryItems.branch_id, branchId))
  if (category) conditions.push(eq(inventoryItems.category, category))

  let rows = await db.select().from(inventoryItems)
    .where(and(...conditions))
    .orderBy(inventoryItems.name)

  if (lowStock) {
    rows = rows.filter(item =>
      item.reorder_level !== null &&
      parseFloat(item.current_stock) <= parseFloat(item.reorder_level!)
    )
  }

  return c.json({ success: true, data: rows })
})

// ── POST /items ───────────────────────────────────────────────────────────────

router.post('/items',
  requireMinRole('branch_manager'),
  zValidator('json', CreateInventoryItemSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const body     = c.req.valid('json')

    const [item] = await db.insert(inventoryItems)
      .values({ clinic_id: clinicId, ...body })
      .returning()

    return c.json({ success: true, data: item }, 201)
  },
)

// ── GET /items/:id ────────────────────────────────────────────────────────────

router.get('/items/:id', async (c) => {
  const clinicId = c.get('clinicId')
  const id       = c.req.param('id')

  const row = await db.select().from(inventoryItems)
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.clinic_id, clinicId)))
    .limit(1)
    .then(r => r[0])

  if (!row) throw new HTTPException(404, { message: 'Inventory item not found' })
  return c.json({ success: true, data: row })
})

// ── PATCH /items/:id ──────────────────────────────────────────────────────────

router.patch('/items/:id',
  requireMinRole('branch_manager'),
  async (c) => {
    const clinicId = c.get('clinicId')
    const id       = c.req.param('id')
    const body     = await c.req.json() as Record<string, unknown>

    const [updated] = await db.update(inventoryItems)
      .set({ ...body, updated_at: new Date() })
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.clinic_id, clinicId)))
      .returning()

    if (!updated) throw new HTTPException(404, { message: 'Inventory item not found' })
    return c.json({ success: true, data: updated })
  },
)

// ── DELETE /items/:id ─────────────────────────────────────────────────────────

router.delete('/items/:id', requireMinRole('clinic_owner'), async (c) => {
  const clinicId = c.get('clinicId')
  const id       = c.req.param('id')

  await db.update(inventoryItems)
    .set({ is_active: false, updated_at: new Date() })
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.clinic_id, clinicId)))

  return c.json({ success: true, data: null })
})

// ── GET /items/:id/transactions ────────────────────────────────────────────────

router.get('/items/:id/transactions', async (c) => {
  const clinicId = c.get('clinicId')
  const itemId   = c.req.param('id')

  const rows = await db.select().from(inventoryTransactions)
    .where(and(
      eq(inventoryTransactions.item_id, itemId),
      eq(inventoryTransactions.clinic_id, clinicId),
    ))
    .orderBy(desc(inventoryTransactions.created_at))
    .limit(100)

  return c.json({ success: true, data: rows })
})

// ── POST /items/:id/transactions ───────────────────────────────────────────────

router.post('/items/:id/transactions',
  requireMinRole('branch_manager'),
  zValidator('json', RecordInventoryTransactionSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const staffId  = c.get('staffId')
    const itemId   = c.req.param('id')
    const body     = c.req.valid('json')

    // Fetch current stock
    const item = await db.select({ current_stock: inventoryItems.current_stock })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.clinic_id, clinicId)))
      .limit(1)
      .then(r => r[0])

    if (!item) throw new HTTPException(404, { message: 'Inventory item not found' })

    const current  = parseFloat(item.current_stock)
    const qty      = parseFloat(body.quantity)
    let newStock: number

    switch (body.transaction_type) {
      case 'in':
        newStock = current + qty
        break
      case 'out':
        newStock = current - qty
        if (newStock < 0) throw new HTTPException(400, { message: 'Insufficient stock' })
        break
      case 'adjustment':
        newStock = qty  // adjustment sets stock to exact value
        break
      default:
        throw new HTTPException(400, { message: 'Invalid transaction_type' })
    }

    // Record transaction and update stock atomically
    const [txn] = await db.insert(inventoryTransactions)
      .values({
        item_id:          itemId,
        clinic_id:        clinicId,
        recorded_by:      staffId,
        stock_before:     current.toFixed(2),
        stock_after:      newStock.toFixed(2),
        ...body,
      })
      .returning()

    await db.update(inventoryItems)
      .set({ current_stock: newStock.toFixed(2), updated_at: new Date() })
      .where(eq(inventoryItems.id, itemId))

    return c.json({ success: true, data: txn }, 201)
  },
)

// ── GET /alerts ────────────────────────────────────────────────────────────────

router.get('/alerts', async (c) => {
  const clinicId = c.get('clinicId')

  const items = await db.select().from(inventoryItems)
    .where(and(
      eq(inventoryItems.clinic_id, clinicId),
      eq(inventoryItems.is_active, true),
    ))

  const alerts = items.filter(item =>
    item.reorder_level !== null &&
    parseFloat(item.current_stock) <= parseFloat(item.reorder_level!)
  )

  return c.json({ success: true, data: alerts })
})

export default router
