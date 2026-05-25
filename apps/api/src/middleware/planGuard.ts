/**
 * Plan enforcement middleware — PRD §8.1
 *
 * Checks clinic plan limits before allowing resource creation.
 * Returns HTTP 402 Payment Required when a plan limit is reached.
 */
import type { MiddlewareHandler } from 'hono'
import { HTTPException }  from 'hono/http-exception'
import { db, clinics, branches, staff, patients, chairs, eq, and, isNull, sql } from '@vorsa/db'
import { PLAN_LIMITS } from '@vorsa/types'
import type { ClinicPlan } from '@vorsa/types'
import type { AppEnv } from '../app'

type Resource = 'branch' | 'doctor' | 'patient' | 'chair'

/** Fetch current clinic plan from the DB (cached per-request via the Hono context). */
async function getClinicPlan(clinicId: string): Promise<ClinicPlan> {
  const row = await db
    .select({ plan: clinics.plan })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1)
    .then(r => r[0])
  return (row?.plan ?? 'starter') as ClinicPlan
}

async function getCurrentCount(resource: Resource, clinicId: string): Promise<number> {
  switch (resource) {
    case 'branch':
      return db.select({ n: sql<number>`COUNT(*)` }).from(branches)
        .where(and(eq(branches.clinic_id, clinicId), eq(branches.is_active, true)))
        .then(r => Number(r[0]?.n ?? 0))
    case 'doctor':
      return db.select({ n: sql<number>`COUNT(*)` }).from(staff)
        .where(and(
          eq(staff.clinic_id, clinicId),
          eq(staff.role, 'doctor'),
          eq(staff.is_active, true),
        ))
        .then(r => Number(r[0]?.n ?? 0))
    case 'patient':
      return db.select({ n: sql<number>`COUNT(*)` }).from(patients)
        .where(and(eq(patients.clinic_id, clinicId), isNull(patients.archived_at)))
        .then(r => Number(r[0]?.n ?? 0))
    case 'chair':
      return db.select({ n: sql<number>`COUNT(*)` }).from(chairs)
        .where(and(eq(chairs.clinic_id, clinicId), eq(chairs.is_active, true)))
        .then(r => Number(r[0]?.n ?? 0))
  }
}

/**
 * Returns middleware that enforces the plan limit for a given resource type.
 * Attach BEFORE the creation handler:
 *   router.post('/', requireAuth, planGuard('branch'), handler)
 */
export function planGuard(resource: Resource): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const clinicId = c.get('clinicId')
    const plan     = await getClinicPlan(clinicId)
    const limits   = PLAN_LIMITS[plan]
    const limit    = limits[`${resource}s` as keyof typeof limits]

    if (limit >= 999_999) { await next(); return }  // Enterprise unlimited

    const current = await getCurrentCount(resource, clinicId)
    if (current >= limit) {
      return c.json({
        success:  false,
        error:    `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan limit reached: ${current}/${limit} ${resource}s. Upgrade to add more.`,
        upgrade:  true,
        resource,
        current,
        limit,
        plan,
      }, 402)
    }

    await next()
  }
}

/**
 * Feature gate — requires the clinic to be on a specific plan.
 * Returns HTTP 402 if the plan does not include the feature.
 */
export function requirePlan(...allowedPlans: ClinicPlan[]): MiddlewareHandler<AppEnv> {
  const allowed = new Set(allowedPlans)
  return async (c, next) => {
    const clinicId = c.get('clinicId')
    const plan     = await getClinicPlan(clinicId)

    if (!allowed.has(plan)) {
      const required = [...allowedPlans].join(' or ')
      throw new HTTPException(402, {
        message: `This feature requires ${required} plan. Current plan: ${plan}`,
      })
    }

    await next()
  }
}
