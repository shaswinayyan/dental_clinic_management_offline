/**
 * Subscription plan enforcement middleware — PRD §8.1
 *
 * Enforces per-plan limits on resource creation so tenants cannot exceed
 * the quota included in their subscription tier.
 *
 * Plan limits:
 *   Starter    — 1 branch,  2 doctors,  2 000 patients,  3 chairs
 *   Business   — 5 branches, 15 doctors, 20 000 patients, 20 chairs
 *   Enterprise — Unlimited
 *
 * Usage (in a route file):
 *   router.post('/branches', authenticate, planGuard('branch'), handler)
 *   router.post('/staff',    authenticate, planGuard('doctor'), handler)
 *   router.post('/patients', authenticate, planGuard('patient'), handler)
 */
import type { Request, Response, NextFunction } from 'express'
import { queryOne } from '../db/postgres'
import { AppError } from './errorHandler'
import type { ClinicPlan } from '../../shared/types'

// ── Plan limits ───────────────────────────────────────────────────────────────

interface PlanLimits {
  branches:  number
  doctors:   number
  patients:  number
  chairs:    number
}

const UNLIMITED = 999_999_999

const LIMITS: Record<ClinicPlan, PlanLimits> = {
  starter:    { branches: 1,  doctors: 2,   patients: 2_000,  chairs: 3  },
  business:   { branches: 5,  doctors: 15,  patients: 20_000, chairs: 20 },
  enterprise: { branches: UNLIMITED, doctors: UNLIMITED, patients: UNLIMITED, chairs: UNLIMITED },
}

type ResourceType = 'branch' | 'doctor' | 'patient' | 'chair'

// ── Current count queries ─────────────────────────────────────────────────────

const COUNT_QUERIES: Record<ResourceType, (clinicId: string) => Promise<number>> = {
  branch: async (clinicId) => {
    const r = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM branches WHERE clinic_id = $1 AND is_active = true`,
      [clinicId],
    )
    return parseInt(r?.count ?? '0', 10)
  },

  doctor: async (clinicId) => {
    const r = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM staff
       WHERE clinic_id = $1 AND role = 'doctor' AND is_active = true`,
      [clinicId],
    )
    return parseInt(r?.count ?? '0', 10)
  },

  patient: async (clinicId) => {
    const r = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM patients
       WHERE clinic_id = $1 AND archived_at IS NULL`,
      [clinicId],
    )
    return parseInt(r?.count ?? '0', 10)
  },

  chair: async (clinicId) => {
    const r = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM chairs WHERE clinic_id = $1 AND is_active = true`,
      [clinicId],
    )
    return parseInt(r?.count ?? '0', 10)
  },
}

// ── Middleware factory ────────────────────────────────────────────────────────

/**
 * Returns a middleware that checks the clinic's plan and current resource
 * count before allowing a creation request through.
 */
export function planGuard(resource: ResourceType) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Fetch the clinic's current plan
      const clinic = await queryOne<{ plan: ClinicPlan }>(
        `SELECT plan FROM clinics WHERE id = $1`,
        [req.clinicId],
      )
      const plan   = clinic?.plan ?? 'starter'
      const limits = LIMITS[plan]

      // Get the limit for the requested resource
      const limit = limits[`${resource}s` as keyof PlanLimits]
      if (limit >= UNLIMITED) {
        next()
        return
      }

      // Count current usage
      const current = await COUNT_QUERIES[resource](req.clinicId)

      if (current >= limit) {
        const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)
        res.status(402).json({
          success:  false,
          error:    `${planLabel} plan limit reached: ${current}/${limit} ${resource}s. Upgrade to add more.`,
          upgrade:  true,
          resource,
          current,
          limit,
          plan,
        })
        return
      }

      next()
    } catch (err) {
      next(err)
    }
  }
}

/**
 * Convenience: check if a specific feature is available on the clinic's plan.
 * Returns 402 Payment Required if the plan does not include the feature.
 */
export function requirePlan(...allowedPlans: ClinicPlan[]) {
  const allowed = new Set(allowedPlans)
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clinic = await queryOne<{ plan: ClinicPlan }>(
        `SELECT plan FROM clinics WHERE id = $1`,
        [req.clinicId],
      )
      const plan = clinic?.plan ?? 'starter'

      if (!allowed.has(plan)) {
        const required = [...allowedPlans].join(' or ')
        next(new AppError(402, `This feature requires ${required} plan. Current plan: ${plan}`))
        return
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}
