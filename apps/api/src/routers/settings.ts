/**
 * Settings routes — /api/v2/settings
 *
 * GET    /clinic               — Get clinic settings
 * PATCH  /clinic               — Update clinic settings [clinic_owner only]
 *
 * GET    /treatments           — List treatment catalogue (alias, scoped to clinic)
 * POST   /treatments           — Create treatment entry [branch_manager+]
 * PATCH  /treatments/:id       — Update treatment [branch_manager+]
 * DELETE /treatments/:id       — Delete treatment [clinic_owner only]
 *
 * GET    /audit-log            — Audit log [clinic_owner only] (paginated)
 */
import { Hono }          from 'hono'
import { zValidator }    from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import {
  db, clinicSettings, clinics, treatments, auditLogs,
  eq, and, desc, sql
} from '@vorsa/db'
import { requireAuth }    from '../middleware/auth'
import { requireMinRole } from '../middleware/rbac'
import type { AppEnv }    from '../app'

const router = new Hono<AppEnv>()
router.use('*', requireAuth)

// ── GET /clinic ────────────────────────────────────────────────────────────────

router.get('/clinic', async (c) => {
  const clinicId = c.get('clinicId')

  const [settings, clinic] = await Promise.all([
    db.select().from(clinicSettings)
      .where(eq(clinicSettings.clinic_id, clinicId))
      .limit(1)
      .then(r => r[0]),
    db.select({
      id:         clinics.id,
      name:       clinics.name,
      plan:       clinics.plan,
      is_active:  clinics.is_active,
      created_at: clinics.created_at,
    })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1)
      .then(r => r[0]),
  ])

  if (!clinic) throw new HTTPException(404, { message: 'Clinic not found' })

  return c.json({ success: true, data: { clinic, settings: settings ?? null } })
})

// ── PATCH /clinic ─────────────────────────────────────────────────────────────

router.patch('/clinic', requireMinRole('clinic_owner'), async (c) => {
  const clinicId = c.get('clinicId')
  const body     = await c.req.json() as Record<string, unknown>

  // Split clinic-level vs settings-level fields
  const clinicFields   = ['name'] as const
  const settingsFields = Object.keys(body).filter(k => !clinicFields.includes(k as typeof clinicFields[number]))

  const updates: Promise<unknown>[] = []

  const clinicUpdate = Object.fromEntries(
    clinicFields.filter(k => k in body).map(k => [k, body[k]])
  )
  if (Object.keys(clinicUpdate).length > 0) {
    updates.push(
      db.update(clinics)
        .set({ ...clinicUpdate, updated_at: new Date() })
        .where(eq(clinics.id, clinicId))
    )
  }

  const settingsUpdate = Object.fromEntries(
    settingsFields.map(k => [k, body[k]])
  )
  if (Object.keys(settingsUpdate).length > 0) {
    updates.push(
      db.insert(clinicSettings)
        .values({ clinic_id: clinicId, ...settingsUpdate })
        .onConflictDoUpdate({
          target: [clinicSettings.clinic_id],
          set:    { ...settingsUpdate, updated_at: new Date() },
        })
    )
  }

  await Promise.all(updates)

  // Return merged result
  const [updatedClinic, updatedSettings] = await Promise.all([
    db.select().from(clinics).where(eq(clinics.id, clinicId)).limit(1).then(r => r[0]),
    db.select().from(clinicSettings).where(eq(clinicSettings.clinic_id, clinicId)).limit(1).then(r => r[0]),
  ])

  return c.json({ success: true, data: { clinic: updatedClinic, settings: updatedSettings ?? null } })
})

// ── GET /treatments ────────────────────────────────────────────────────────────

router.get('/treatments', async (c) => {
  const clinicId = c.get('clinicId')

  const rows = await db.select().from(treatments)
    .where(eq(treatments.clinic_id, clinicId))
    .orderBy(treatments.name)

  return c.json({ success: true, data: rows })
})

// ── POST /treatments ───────────────────────────────────────────────────────────

router.post('/treatments',
  requireMinRole('branch_manager'),
  async (c) => {
    const clinicId = c.get('clinicId')
    const body     = await c.req.json() as {
      name: string; code?: string; default_price?: string; duration_minutes?: number; category?: string; description?: string
    }

    if (!body.name?.trim()) throw new HTTPException(400, { message: 'Treatment name is required' })

    const [row] = await db.insert(treatments)
      .values({ clinic_id: clinicId, ...body })
      .returning()

    return c.json({ success: true, data: row }, 201)
  },
)

// ── PATCH /treatments/:id ─────────────────────────────────────────────────────

router.patch('/treatments/:id',
  requireMinRole('branch_manager'),
  async (c) => {
    const clinicId = c.get('clinicId')
    const id       = c.req.param('id')
    const body     = await c.req.json() as Record<string, unknown>

    const [updated] = await db.update(treatments)
      .set({ ...body, updated_at: new Date() })
      .where(and(eq(treatments.id, id), eq(treatments.clinic_id, clinicId)))
      .returning()

    if (!updated) throw new HTTPException(404, { message: 'Treatment not found' })
    return c.json({ success: true, data: updated })
  },
)

// ── DELETE /treatments/:id ────────────────────────────────────────────────────

router.delete('/treatments/:id', requireMinRole('clinic_owner'), async (c) => {
  const clinicId = c.get('clinicId')
  const id       = c.req.param('id')

  const result = await db.delete(treatments)
    .where(and(eq(treatments.id, id), eq(treatments.clinic_id, clinicId)))
    .returning()

  if (!result.length) throw new HTTPException(404, { message: 'Treatment not found' })
  return c.json({ success: true, data: null })
})

// ── GET /audit-log ─────────────────────────────────────────────────────────────

router.get('/audit-log', requireMinRole('clinic_owner'), async (c) => {
  const clinicId = c.get('clinicId')
  const page     = Math.max(1, Number(c.req.query('page') ?? 1))
  const limit    = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 50)))
  const offset   = (page - 1) * limit

  const [rows, total] = await Promise.all([
    db.select().from(auditLogs)
      .where(eq(auditLogs.clinic_id, clinicId))
      .orderBy(desc(auditLogs.created_at))
      .limit(limit)
      .offset(offset),
    db.select({ n: sql<number>`COUNT(*)` })
      .from(auditLogs)
      .where(eq(auditLogs.clinic_id, clinicId))
      .then(r => Number(r[0]?.n ?? 0)),
  ])

  return c.json({
    success: true,
    data:    rows,
    meta:    { total, page, limit, pages: Math.ceil(total / limit) },
  })
})

export default router
