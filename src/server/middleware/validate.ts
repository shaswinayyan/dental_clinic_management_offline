/**
 * Zod-based request validation middleware factory.
 *
 * Usage:
 *   import { z } from 'zod'
 *   import { validate } from '../middleware/validate'
 *
 *   const CreateBranchSchema = z.object({ name: z.string().min(1), ... })
 *
 *   router.post('/branches', authenticate, validate(CreateBranchSchema), handler)
 *
 * On validation failure returns HTTP 422 with a structured error listing all
 * field-level issues so the client can highlight specific form fields.
 */
import type { Request, Response, NextFunction } from 'express'
import { z, type ZodTypeAny, ZodError } from 'zod'

type Target = 'body' | 'query' | 'params'

interface ValidateOptions {
  /** Part of the request to validate. Defaults to 'body'. */
  target?: Target
}

/**
 * Returns an Express middleware that validates `req[target]` against `schema`.
 * Replaces the target with the parsed (coerced) value on success.
 */
export function validate<T extends ZodTypeAny>(
  schema: T,
  { target = 'body' }: ValidateOptions = {},
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target])

    if (!result.success) {
      const issues = (result.error as ZodError).issues.map((issue) => ({
        path:    issue.path.join('.'),
        message: issue.message,
      }))

      res.status(422).json({
        success: false,
        error:   'Validation failed',
        issues,
      })
      return
    }

    // Replace with the parsed value so coercions (e.g. string→number) take effect.
    ;(req as Record<string, unknown>)[target] = result.data
    next()
  }
}

// ── Shared primitive schemas ───────────────────────────────────────────────────

/** UUID v4 string. */
export const uuidSchema = z.string().uuid()

/** Pagination query params with safe defaults. */
export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

/** ISO 8601 date string (YYYY-MM-DD). */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')

/** Reusable phone number — non-empty string, trimmed. */
export const phoneSchema = z.string().trim().min(7).max(20)
