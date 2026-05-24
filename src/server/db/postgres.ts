/**
 * PostgreSQL connection pool — single shared instance used across all route handlers.
 * Uses `node-postgres` (pg) which handles connection pooling, keep-alive, and reconnects.
 */
import { Pool, type PoolClient } from 'pg'
import { DATABASE_URL, DB_CONFIG } from '../config'

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, max: DB_CONFIG.max })
  : new Pool(DB_CONFIG)

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error', err)
})

// ── Query helpers ─────────────────────────────────────────────────────────────

/**
 * Execute a single query on a pool connection.
 * Parameters are passed as positional ($1, $2, …) values.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await pool.query(text, params)
  return rows as T[]
}

/**
 * Execute a query and return the first row, or null if no rows.
 */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}

/**
 * Run a callback inside a serialisable transaction.
 * Sets the tenant session variable before executing the callback
 * so all queries inside are automatically tenant-scoped via PostgreSQL RLS.
 */
export async function withTransaction<T>(
  clinicId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Tenant isolation: session variable used by RLS policies
    await client.query(`SELECT set_config('app.clinic_id', $1, true)`, [clinicId])
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export { pool }
