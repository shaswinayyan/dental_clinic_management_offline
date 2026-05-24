/**
 * OP-ID and Invoice-number generation service.
 *
 * Generates tenant-scoped sequential identifiers with a configurable prefix
 * and zero-padding.  Uses a Postgres advisory lock + SELECT FOR UPDATE to
 * guarantee uniqueness under concurrent load without a separate sequences table.
 *
 * Examples:
 *   OP-0001, OP-0002 … (op_id_prefix = 'OP', op_id_padding = 4)
 *   INV-00001          (invoice_prefix = 'INV', invoice_padding = 5)
 */
import type { PoolClient } from 'pg'
import { withTransaction, queryOne } from '../db/postgres'

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate the next patient OP-ID for a clinic.
 * Must be called inside a route handler that already validated clinicId.
 */
export async function nextOpId(clinicId: string): Promise<string> {
  return withTransaction(clinicId, (client) =>
    generateSequential(client, clinicId, 'op_id_prefix', 'op_id_padding', 'op_id_seq'),
  )
}

/**
 * Generate the next invoice number for a clinic.
 */
export async function nextInvoiceNumber(clinicId: string): Promise<string> {
  return withTransaction(clinicId, (client) =>
    generateSequential(client, clinicId, 'invoice_prefix', 'invoice_padding', 'invoice_seq'),
  )
}

// ── Private implementation ────────────────────────────────────────────────────

interface SettingRow {
  value: string
}

async function generateSequential(
  client:     PoolClient,
  clinicId:   string,
  prefixKey:  string,
  paddingKey: string,
  seqKey:     string,
): Promise<string> {
  // Fetch prefix + padding settings
  const prefixRow = await client.query<SettingRow>(
    `SELECT value FROM clinic_settings WHERE clinic_id = $1 AND key = $2`,
    [clinicId, prefixKey],
  )
  const paddingRow = await client.query<SettingRow>(
    `SELECT value FROM clinic_settings WHERE clinic_id = $1 AND key = $2`,
    [clinicId, paddingKey],
  )

  const prefix  = prefixRow.rows[0]?.value ?? 'OP'
  const padding = parseInt(paddingRow.rows[0]?.value ?? '4', 10)

  // Atomically increment (or initialise) the sequence counter.
  // SELECT … FOR UPDATE ensures no two concurrent transactions get the same value.
  const existing = await client.query<SettingRow>(
    `SELECT value FROM clinic_settings
     WHERE clinic_id = $1 AND key = $2
     FOR UPDATE`,
    [clinicId, seqKey],
  )

  let next: number
  if (existing.rows.length === 0) {
    // First use — seed the counter
    next = 1
    await client.query(
      `INSERT INTO clinic_settings (id, clinic_id, key, value)
       VALUES (gen_random_uuid(), $1, $2, '1')`,
      [clinicId, seqKey],
    )
  } else {
    next = parseInt(existing.rows[0].value, 10) + 1
    await client.query(
      `UPDATE clinic_settings SET value = $1
       WHERE clinic_id = $2 AND key = $3`,
      [String(next), clinicId, seqKey],
    )
  }

  return `${prefix}-${String(next).padStart(padding, '0')}`
}

/**
 * Peek at the current counter value without incrementing (for display/audit).
 */
export async function currentOpIdCounter(clinicId: string): Promise<number> {
  const row = await queryOne<SettingRow>(
    `SELECT value FROM clinic_settings WHERE clinic_id = $1 AND key = 'op_id_seq'`,
    [clinicId],
  )
  return row ? parseInt(row.value, 10) : 0
}
