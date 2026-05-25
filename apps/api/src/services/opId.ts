/**
 * Operation ID service — generates short human-readable prefixed IDs.
 *
 * Format: PREFIX-YYYYMMDD-XXXXXX
 *   PAT-20240115-A3F2K1  — patient record
 *   INV-20240115-B9C4M2  — invoice
 *   APT-20240115-D7E1N8  — appointment
 *
 * Uniqueness: random base-36 suffix (collision probability negligible for
 * clinic-scale volumes; use DB unique constraint as a hard backstop).
 */

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/1/0 for readability

function randomSuffix(length = 6): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  }
  return result
}

function dateStamp(): string {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = String(now.getMonth() + 1).padStart(2, '0')
  const d   = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

export type OpIdPrefix =
  | 'PAT'   // patient
  | 'INV'   // invoice
  | 'APT'   // appointment
  | 'BRN'   // branch
  | 'STF'   // staff
  | 'INV'   // inventory item
  | 'TXN'   // inventory transaction

export function generateOpId(prefix: OpIdPrefix): string {
  return `${prefix}-${dateStamp()}-${randomSuffix()}`
}

// Convenience exports
export const newPatientId     = () => generateOpId('PAT')
export const newInvoiceId     = () => generateOpId('INV')
export const newAppointmentId = () => generateOpId('APT')
