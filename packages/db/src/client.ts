/**
 * Neon PostgreSQL client via Drizzle ORM.
 *
 * Neon separates storage from compute — it scales to zero when idle
 * (perfect for small clinics overnight) and supports HTTP-based queries
 * from serverless environments (Lambda, Cloudflare Workers).
 *
 * Connection: uses the @neondatabase/serverless driver which speaks HTTP
 * instead of TCP, so it works in edge runtimes with no WebSocket/TCP overhead.
 */
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

// HTTP-based Neon SQL executor (serverless-compatible)
const sql = neon(process.env.DATABASE_URL)

// Drizzle instance with full schema for type-safe query building
export const db = drizzle(sql, { schema })

// Export the raw Neon executor for one-off queries when Drizzle's builder isn't needed
export { sql as neonSql }

export type DB = typeof db
