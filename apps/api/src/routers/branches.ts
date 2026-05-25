/**
 * Branches routes — /api/v2/branches
 *
 * GET    /                    — List branches (owner: all; others: own branch)
 * POST   /                    — Create branch [clinic_owner only, plan-gated]
 * GET    /:id                  — Get branch detail
 * PATCH  /:id                  — Update branch [owner / branch_manager]
 * DELETE /:id                  — Deactivate branch [clinic_owner only]
 * GET    /:id/working-hours    — Get 7-day working hours
 * PUT    /:id/working-hours    — Replace 7-day working hours
 * GET    /:id/appt-config      — Get appointment configuration
 * PATCH  /:id/appt-config      — Update appointment configuration
 * GET    /:id/chairs           — List chairs
 * POST   /:id/chairs           — Create chair [plan-gated]
 * PATCH  /:id/chairs/:chairId  — Update chair
 * GET    /:id/custom-statuses  — List custom appointment statuses
 * POST   /:id/custom-statuses  — Upsert custom status
 */
import { Hono }          from 'hono'
import { zValidator }    from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import {
  db, branches, branchWorkingHours, apptConfig, apptCustomStatuses, chairs,
  eq, and
} from '@vorsa/db'
import {
  CreateBranchSchema, UpdateBranchSchema, WorkingHoursSchema,
  ApptConfigSchema, CreateChairSchema, UpsertCustomStatusSchema, uuidSchema
} from '@vorsa/validators'
import { requireAuth }     from '../middleware/auth'
import { requireMinRole }  from '../middleware/rbac'
import { planGuard }       from '../middleware/planGuard'
import type { AppEnv }     from '../app'

const router = new Hono<AppEnv>()
router.use('*', requireAuth)

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', async (c) => {
  const clinicId = c.get('clinicId')
  const role     = c.get('role')
  const branchId = c.get('branchId')

  const rows = await db
    .select()
    .from(branches)
    .where(
      role === 'clinic_owner'
        ? eq(branches.clinic_id, clinicId)
        : and(eq(branches.clinic_id, clinicId), eq(branches.id, branchId!))
    )

  return c.json({ success: true, data: rows })
})

// ── POST / ────────────────────────────────────────────────────────────────────

router.post('/',
  requireMinRole('clinic_owner'),
  planGuard('branch'),
  zValidator('json', CreateBranchSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const body     = c.req.valid('json')

    const [branch] = await db.insert(branches)
      .values({ clinic_id: clinicId, ...body })
      .returning()

    // Seed default 7-day working hours
    await db.insert(branchWorkingHours).values(
      Array.from({ length: 7 }, (_, i) => ({
        branch_id:   branch.id,
        day_of_week: i,
        is_open:     i >= 1 && i <= 5,  // Mon–Fri open by default
      }))
    )

    // Seed default appt config
    await db.insert(apptConfig).values({ branch_id: branch.id })

    return c.json({ success: true, data: branch }, 201)
  },
)

// ── GET /:id ──────────────────────────────────────────────────────────────────

router.get('/:id', async (c) => {
  const clinicId = c.get('clinicId')
  const id       = c.req.param('id')

  const row = await db.select().from(branches)
    .where(and(eq(branches.id, id), eq(branches.clinic_id, clinicId)))
    .limit(1)
    .then(r => r[0])

  if (!row) throw new HTTPException(404, { message: 'Branch not found' })
  return c.json({ success: true, data: row })
})

// ── PATCH /:id ────────────────────────────────────────────────────────────────

router.patch('/:id',
  requireMinRole('branch_manager'),
  zValidator('json', UpdateBranchSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const id       = c.req.param('id')
    const body     = c.req.valid('json')

    const [updated] = await db.update(branches)
      .set({ ...body, updated_at: new Date() })
      .where(and(eq(branches.id, id), eq(branches.clinic_id, clinicId)))
      .returning()

    if (!updated) throw new HTTPException(404, { message: 'Branch not found' })
    return c.json({ success: true, data: updated })
  },
)

// ── DELETE /:id ────────────────────────────────────────────────────────────────

router.delete('/:id', requireMinRole('clinic_owner'), async (c) => {
  const clinicId = c.get('clinicId')
  const id       = c.req.param('id')

  await db.update(branches)
    .set({ is_active: false, updated_at: new Date() })
    .where(and(eq(branches.id, id), eq(branches.clinic_id, clinicId)))

  return c.json({ success: true, data: null })
})

// ── GET /:id/working-hours ────────────────────────────────────────────────────

router.get('/:id/working-hours', async (c) => {
  const id = c.req.param('id')
  const rows = await db.select().from(branchWorkingHours)
    .where(eq(branchWorkingHours.branch_id, id))
    .orderBy(branchWorkingHours.day_of_week)
  return c.json({ success: true, data: rows })
})

// ── PUT /:id/working-hours ────────────────────────────────────────────────────

router.put('/:id/working-hours',
  requireMinRole('branch_manager'),
  zValidator('json', WorkingHoursSchema),
  async (c) => {
    const branchId = c.req.param('id')
    const { hours } = c.req.valid('json')

    // Delete and re-insert all 7 days atomically
    await db.delete(branchWorkingHours).where(eq(branchWorkingHours.branch_id, branchId))
    const rows = await db.insert(branchWorkingHours)
      .values(hours.map(h => ({ ...h, branch_id: branchId })))
      .returning()

    return c.json({ success: true, data: rows })
  },
)

// ── GET /:id/appt-config ──────────────────────────────────────────────────────

router.get('/:id/appt-config', async (c) => {
  const id  = c.req.param('id')
  const row = await db.select().from(apptConfig)
    .where(eq(apptConfig.branch_id, id))
    .limit(1)
    .then(r => r[0])

  if (!row) throw new HTTPException(404, { message: 'Config not found' })
  return c.json({ success: true, data: row })
})

// ── PATCH /:id/appt-config ────────────────────────────────────────────────────

router.patch('/:id/appt-config',
  requireMinRole('branch_manager'),
  zValidator('json', ApptConfigSchema.partial()),
  async (c) => {
    const id   = c.req.param('id')
    const body = c.req.valid('json')

    const [updated] = await db.update(apptConfig)
      .set({ ...body, updated_at: new Date() })
      .where(eq(apptConfig.branch_id, id))
      .returning()

    return c.json({ success: true, data: updated })
  },
)

// ── GET /:id/chairs ────────────────────────────────────────────────────────────

router.get('/:id/chairs', async (c) => {
  const clinicId = c.get('clinicId')
  const id       = c.req.param('id')

  const rows = await db.select().from(chairs)
    .where(and(eq(chairs.branch_id, id), eq(chairs.clinic_id, clinicId), eq(chairs.is_active, true)))

  return c.json({ success: true, data: rows })
})

// ── POST /:id/chairs ──────────────────────────────────────────────────────────

router.post('/:id/chairs',
  requireMinRole('branch_manager'),
  planGuard('chair'),
  zValidator('json', CreateChairSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const branchId = c.req.param('id')
    const body     = c.req.valid('json')

    const [chair] = await db.insert(chairs)
      .values({ clinic_id: clinicId, branch_id: branchId, ...body })
      .returning()

    return c.json({ success: true, data: chair }, 201)
  },
)

// ── GET /:id/custom-statuses ───────────────────────────────────────────────────

router.get('/:id/custom-statuses', async (c) => {
  const clinicId = c.get('clinicId')
  const rows = await db.select().from(apptCustomStatuses)
    .where(eq(apptCustomStatuses.clinic_id, clinicId))
    .orderBy(apptCustomStatuses.sort_order)
  return c.json({ success: true, data: rows })
})

// ── POST /:id/custom-statuses ──────────────────────────────────────────────────

router.post('/:id/custom-statuses',
  requireMinRole('branch_manager'),
  zValidator('json', UpsertCustomStatusSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const body     = c.req.valid('json')

    const [row] = await db.insert(apptCustomStatuses)
      .values({ clinic_id: clinicId, ...body })
      .onConflictDoUpdate({
        target: [apptCustomStatuses.clinic_id, apptCustomStatuses.label],
        set:    { color: body.color, is_terminal: body.is_terminal, sort_order: body.sort_order },
      })
      .returning()

    return c.json({ success: true, data: row }, 201)
  },
)

export default router
