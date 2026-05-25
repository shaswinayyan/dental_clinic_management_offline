/**
 * Auth routes — /api/v2/auth
 *
 * POST   /register   — Register a new clinic + owner (Clerk + DB)
 * GET    /me         — Return authenticated staff profile with plan info
 * PATCH  /me/profile — Update own name/phone/designation
 *
 * Session management (login, logout, token refresh) is handled by Clerk.
 * The Clerk-hosted UI handles the sign-in/sign-up flow.
 * These routes handle VORSA-specific business logic after Clerk auth.
 */
import { Hono }          from 'hono'
import { zValidator }    from '@hono/zod-validator'
import { getAuth }       from '@hono/clerk-auth'
import { HTTPException } from 'hono/http-exception'
import { db, staff, clinics, clinicSettings, eq } from '@vorsa/db'
import { RegisterClinicSchema } from '@vorsa/validators'
import { requireAuth }   from '../middleware/auth'
import { registerClinic } from '../services/tenant'
import type { AppEnv }   from '../app'

const router = new Hono<AppEnv>()

// ── POST /register — Create a new clinic tenant ────────────────────────────────

router.post('/register',
  zValidator('json', RegisterClinicSchema),
  async (c) => {
    const input    = c.req.valid('json')
    const auth     = getAuth(c)

    // Require Clerk session for registration (user must sign up via Clerk first,
    // then complete the clinic registration wizard)
    if (!auth?.userId) {
      throw new HTTPException(401, { message: 'Complete Clerk sign-up before registering a clinic' })
    }

    const clinic = await registerClinic({ ...input, clerkUserId: auth.userId })
    return c.json({ success: true, data: clinic }, 201)
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
