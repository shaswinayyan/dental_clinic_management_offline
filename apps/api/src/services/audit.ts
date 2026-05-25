/**
 * Audit log service — thin wrapper to insert rows into auditLogs table.
 *
 * Usage:
 *   await logAudit({
 *     clinicId, staffId,
 *     action:   'patient.updated',
 *     entity:   'patient',
 *     entityId: patient.id,
 *     meta:     { fields: ['name', 'phone'] },
 *   })
 */
import { db, auditLogs } from '@vorsa/db'

export interface AuditEntry {
  clinicId:  string
  staffId:   string
  action:    string       // e.g. 'patient.created', 'invoice.voided'
  entity:    string       // e.g. 'patient', 'invoice', 'branch'
  entityId?: string
  meta?:     Record<string, unknown>
  ipAddress?: string
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      clinic_id:  entry.clinicId,
      staff_id:   entry.staffId,
      action:     entry.action,
      entity:     entry.entity,
      entity_id:  entry.entityId,
      meta:       entry.meta ?? {},
      ip_address: entry.ipAddress,
    })
  } catch (err) {
    // Audit log failures must never crash the primary request
    console.error('[audit] failed to write audit log:', err)
  }
}
