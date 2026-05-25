/**
 * Auth routes — /api/v2/auth
 *
 * POST   /register   — Register a new clinic + owner (Supabase user + DB)
 * GET    /me         — Return authenticated staff profile with plan info
 * PATCH  /me/profile — Update own name/phone/designation
 *
 * Session management (sign-up, sign-in, token refresh) is handled by
 * Supabase Auth on the frontend. These routes handle VORSA-specific
 * business logic (tenant provisioning) after Supabase auth.
 */
import { Hono }          from 'hono'
import { zValidator }    from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { db, staff, clinics, eq } from '@vorsa/db'
import { RegisterClinicSchema }   from '@vorsa/validators'
import { requireAuth }            from '../middleware/auth'
import { verifyToken }            from '../lib/supabase'
import { registerClinic }         from '../services/tenant'
import type { AppEnv }            from '../app'

const router = new Hono<AppEnv>()

// ── POST /register — Create a new clinic tenant ────────────────────────────────

router.post('/register',
  zValidator('json', RegisterClinicSchema),
  async (c) => {
    const input  = c.req.valid('json')
    const bearer = c.req.header('Authorization')

    if (!bearer?.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Sign in with Supabase before registering a clinic' })
    }

    let supabaseUserId: string
    try {
      const user     = await verifyToken(bearer.slice(7))
      supabaseUserId = user.id
    } catch {
      throw new HTTPException(401, { message: 'Invalid or expired token' })
    }

    // Prevent duplicate registrations for the same Supabase user
    const existing = await db
      .select({ id: staff.id })
      .from(staff)
      .where(eq(staff.user_id, supabaseUserId))
      .limit(1)
      .then(r => r[0])

    if (existing) {
      throw new HTTPException(409, { message: 'A clinic is already registered to this account' })
    }

    const result = await registerClinic({ ...input, supabaseUserId })
    return c.json({ success: true, data: result }, 201)
  },
)

// ── GET /me — Current authenticated staff profile ──────────────────────────────

router.get('/me', requireAuth, async (c) => {
  const staffId  = c.get('staffId')
  const clinicId = c.get('clinicId')

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
      created_at:    staff.created_at,
      // Join clinic for plan + name
      plan:          clinics.plan,
      clinic_name:   clinics.name,
    })
    .from(staff)
    .innerJoin(clinics, eq(staff.clinic_id, clinics.id))
    .where(eq(staff.id, staffId))
    .limit(1)
    .then(r => r[0])

  if (!row) throw new HTTPException(404, { message: 'Staff profile not found' })

  return c.json({ success: true, data: row })
})

// ── PATCH /me/profile — Update own profile ─────────────────────────────────────

router.patch('/me/profile', requireAuth, async (c) => {
  const staffId = c.get('staffId')
  const body    = await c.req.json() as { name?: string; phone?: string; designation?: string }

  const updated = await db
    .update(staff)
    .set({
      ...(body.name        !== undefined && { name:        body.name }),
      ...(body.phone       !== undefined && { phone:       body.phone }),
      ...(body.designation !== undefined && { designation: body.designation }),
      updated_at: new Date(),
    })
    .where(eq(staff.id, staffId))
    .returning()
    .then(r => r[0])

  return c.json({ success: true, data: updated })
})

export default router
