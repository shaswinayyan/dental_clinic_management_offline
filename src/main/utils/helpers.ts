import type Database from 'better-sqlite3'

export function generateOpId(db: Database.Database): string {
  const today = new Date()
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, '')
  const count = (db.prepare(`SELECT COUNT(*) as c FROM patients WHERE op_id LIKE ?`).get(`OP-${datePart}-%`) as { c: number }).c
  const seq = String(count + 1).padStart(4, '0')
  return `OP-${datePart}-${seq}`
}

export function generateInvoiceNumber(db: Database.Database): string {
  const today = new Date()
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, '')
  const count = (db.prepare(`SELECT COUNT(*) as c FROM invoices WHERE invoice_number LIKE ?`).get(`INV-${datePart}-%`) as { c: number }).c
  const seq = String(count + 1).padStart(4, '0')
  return `INV-${datePart}-${seq}`
}
