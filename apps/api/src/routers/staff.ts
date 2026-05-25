/**
 * Staff routes — /api/v2/staff
 *
 * GET    /           — List staff (owner: all; others: own branch)
 * POST   /           — Create staff [clinic_owner, plan-gated on doctor]
 * GET    /:id        — Get staff detail
 * PATCH  /:id        — Update staff [owner / branch_manager]
 * DELETE /:id        — Deactivate staff [clinic_owner only]
 * POST   /invite     — Send invite email [clinic_owner]
 * POST   /accept-invite — Accept invite (sets clerk_user_id)
 */
import { Hono }          from 'hono'
import { zValidator }    from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import {
  db, staff, staffInvites,
  eq, and, isNull, sql
} from '@vorsa/db'
import {
  CreateStaffSchema, UpdateStaffSchema, InviteStaffSchema, uuidSchema
} from '@vorsa/validators'
import { requireAuth }    from '../middleware/auth'
import { requireMinRole } from '../middleware/rbac'
import { planGuard }      from '../middleware/planGuard'
import type { AppEnv }    from '../app'

const router = new Hono<AppEnv>()
router.use('*', requireAuth)

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', async (c) => {
  const clinicId = c.get('clinicId')
  const role     = c.get('role')
  const branchId = c.get('branchId')

  const rows = await db
    .select({
      id:          staff.id,
      clinic_id:   staff.clinic_id,
      branch_id:   staff.branch_id,
      name:        staff.name,
      email:       staff.email,
      phone:       staff.phone,
      role:        staff.role,
      designation: staff.designation,
      is_active:   staff.is_active,
      created_at:  staff.created_at,
    })
    .from(staff)
    .where(
      role === 'clinic_owner'
        ? eq(staff.clinic_id, clinicId)
        : and(eq(staff.clinic_id, clinicId), eq(staff.branch_id, branchId!))
    )

  return c.json({ success: true, data: rows })
})

// ── POST / ────────────────────────────────────────────────────────────────────

router.post('/',
  requireMinRole('branch_manager'),
  zValidator('json', CreateStaffSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const body     = c.req.valid('json')

    // Apply doctor plan guard only for doctor role
    if (body.role === 'doctor') {
      // Inline plan guard for doctors
      const { PLAN_LIMITS } = await import('@vorsa/types')
      const { clinics }     = await import('@vorsa/db')
      const planRow = await db
        .select({ plan: clinics.plan })
        .from(clinics)
        .where(eq(clinics.id, clinicId))
        .limit(1)
        .then(r => r[0])

      const plan    = (planRow?.plan ?? 'starter') as keyof typeof PLAN_LIMITS
      const limits  = PLAN_LIMITS[plan]
      const current = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(staff)
        .where(and(eq(staff.clinic_id, clinicId), eq(staff.role, 'doctor'), eq(staff.is_active, true)))
        .then(r => Number(r[0]?.n ?? 0))

      if (limits.doctors < 999_999 && current >= limits.doctors) {
        return c.json({
          success:  false,
          error:    `${plan} plan limit reached: ${current}/${limits.doctors} doctors. Upgrade to add more.`,
          upgrade:  true,
          resource: 'doctor',
          current,
          limit:    limits.doctors,
          plan,
        }, 402)
      }
    }

    const [member] = await db.insert(staff)
      .values({ clinic_id: clinicId, ...body })
      .returning()

    return c.json({ success: true, data: member }, 201)
  },
)

// ── GET /:id ──────────────────────────────────────────────────────────────────

router.get('/:id', async (c) => {
  const clinicId = c.get('clinicId')
  const id       = c.req.param('id')

  const row = await db
    .select({
      id:            staff.id,
      clinic_id:     staff.clinic_id,
      branch_id:     staff.branch_id,
      name:          staff.name,
      email:         staff.email,
      phone:         staff.phone,
      role:          staff.role,
      designation:   staff.designation,
      is_active:     staff.is_active,
      clerk_user_id: staff.clerk_user_id,
      created_at:    staff.created_at,
      updated_at:    staff.updated_at,
    })
    .from(staff)
    .where(and(eq(staff.id, id), eq(staff.clinic_id, clinicId)))
    .limit(1)
    .then(r => r[0])

  if (!row) throw new HTTPException(404, { message: 'Staff member not found' })
  return c.json({ success: true, data: row })
})

// ── PATCH /:id ────────────────────────────────────────────────────────────────

router.patch('/:id',
  requireMinRole('branch_manager'),
  zValidator('json', UpdateStaffSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const id       = c.req.param('id')
    const body     = c.req.valid('json')

    const [updated] = await db.update(staff)
      .set({ ...body, updated_at: new Date() })
      .where(and(eq(staff.id, id), eq(staff.clinic_id, clinicId)))
      .returning()

    if (!updated) throw new HTTPException(404, { message: 'Staff member not found' })
    return c.json({ success: true, data: updated })
  },
)

// ── DELETE /:id ────────────────────────────────────────────────────────────────

router.delete('/:id', requireMinRole('clinic_owner'), async (c) => {
  const clinicId = c.get('clinicId')
  const staffId  = c.get('staffId')
  const id       = c.req.param('id')

  // Prevent self-deactivation
  if (id === staffId) {
    throw new HTTPException(400, { message: 'Cannot deactivate your own account' })
  }

  await db.update(staff)
    .set({ is_active: false, updated_at: new Date() })
    .where(and(eq(staff.id, id), eq(staff.clinic_id, clinicId)))

  return c.json({ success: true, data: null })
})

// ── POST /invite ──────────────────────────────────────────────────────────────

router.post('/invite',
  requireMinRole('clinic_owner'),
  zValidator('json', InviteStaffSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const body     = c.req.valid('json')

    // Check for duplicate active invite
    const existing = await db.select()
      .from(staffInvites)
      .where(
        and(
          eq(staffInvites.clinic_id, clinicId),
          eq(staffInvites.email, body.email),
          isNull(staffInvites.accepted_at),
        )
      )
      .limit(1)
      .then(r => r[0])

    if (existing) {
      throw new HTTPException(409, { message: 'An active invite already exists for this email' })
    }

    // Create invite token (random UUID used as token)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const [invite] = await db.insert(staffInvites)
      .values({
        clinic_id:  clinicId,
        email:      body.email,
        role:       body.role,
        branch_id:  body.branch_id ?? null,
        expires_at: expiresAt,
      })
      .returning()

    // TODO: Send invite email via Trigger.dev job
    // await sendInviteEmail({ to: body.email, token: invite.token, clinicId })

    return c.json({ success: true, data: { id: invite.id, email: invite.email, expires_at: invite.expires_at } }, 201)
  },
)

// ── POST /accept-invite ────────────────────────────────────────────────────────

router.post('/accept-invite', async (c) => {
  const { token, clerkUserId } = await c.req.json() as { token: string; clerkUserId: string }

  if (!token || !clerkUserId) {
    throw new HTTPException(400, { message: 'token and clerkUserId are required' })
  }

  const invite = await db.select()
    .from(staffInvites)
    .where(and(eq(staffInvites.id, token), isNull(staffInvites.accepted_at)))
    .limit(1)
    .then(r => r[0])

  if (!invite) throw new HTTPException(404, { message: 'Invalid or expired invite' })
  if (invite.expires_at < new Date()) {
    throw new HTTPException(410, { message: 'Invite has expired' })
  }

  // Create staff record
  const [member] = await db.insert(staff)
    .values({
      clinic_id:     invite.clinic_id,
      branch_id:     invite.branch_id,
      clerk_user_id: clerkUserId,
      email:         invite.email,
      role:          invite.role,
      name:          '',  // Updated when staff sets up their profile
    })
    .returning()

  // Mark invite as accepted
  await db.update(staffInvites)
    .set({ accepted_at: new Date() })
    .where(eq(staffInvites.id, invite.id))

  return c.json({ success: true, data: member }, 201)
})

export default router
