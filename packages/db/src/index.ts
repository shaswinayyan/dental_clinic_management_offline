/**
 * @vorsa/db — Main barrel export.
 *
 * Re-exports:
 *   - db client (Neon + Drizzle)
 *   - all schema tables and inferred types
 *   - drizzle-orm helper functions for convenience
 */
export { db }      from './client'
export type { DB } from './client'
export * from './schema'

// Re-export commonly used Drizzle helpers so consumers don't need to
// depend on drizzle-orm directly for basic queries.
export {
  eq, ne, gt, gte, lt, lte,
  and, or, not,
  isNull, isNotNull,
  inArray, notInArray,
  like, ilike,
  sql,
  desc, asc,
  count, sum, avg, max, min,
} from 'drizzle-orm'
