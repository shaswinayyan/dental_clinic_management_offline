/**
 * Supabase PostgreSQL client via Drizzle ORM.
 *
 * Uses the `postgres` npm package (standard TCP driver) with Drizzle ORM.
 * Supabase provides a standard PostgreSQL connection — no proprietary
 * driver needed. Works on Node.js, Bun, and edge runtimes via tunnel.
 *
 * Connection: Supabase session pooler (port 6543, pgbouncer mode).
 * `prepare: false` is required for pgbouncer compatibility.
 */
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

// Postgres client — prepare:false is required for Supabase session pooler
const client = postgres(process.env.DATABASE_URL, {
  prepare: false,
  ssl:     'require',
})

// Drizzle instance with full schema for type-safe query building
export const db = drizzle(client, { schema })

export type DB = typeof db
