/**
 * Audit log service.
 *
 * Writes structured audit entries to the `audit_logs` table.
 * Every mutation (create / update / delete) on sensitive entities should call
 * `writeAudit()` so clinic owners have a full tamper-evident trail.
 *
 * Fire-and-forget pattern: callers do NOT await the write in most cases.
 * Failures are logged to stderr but never propagate to the HTTP response.
 */
import { randomUUID } from 'crypto'
import { query } from '../db/postgres'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'TOKEN_REFRESH'
  | 'EXPORT'

export interface AuditEntry {
  clinicId:   string
  staffId:    string
  action:     AuditAction
  /** Table / resource type being acted on, e.g. 'patient', 'invoice', 'staff' */
  entity:     string
  /** Primary key of the affected row */
  entityId?:  string
  /** JSON-serialisable before/after snapshot (keep small — do not store PII in diff) */
  diff?:      Record<string, unknown>
  /** Request metadata */
  ipAddress?: string
  userAgent?: string
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Write one audit log entry.
 *
 * Safe to fire-and-forget:
 *   void writeAudit({ clinicId, staffId, action: 'CREATE', entity: 'patient', entityId: id })
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs
         (id, clinic_id, staff_id, action, entity, entity_id, diff, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        randomUUID(),
        entry.clinicId,
        entry.staffId,
        entry.action,
        entry.entity,
        entry.entityId   ?? null,
        entry.diff       ? JSON.stringify(entry.diff) : null,
        entry.ipAddress  ?? null,
        entry.userAgent  ?? null,
      ],
    )
  } catch (err) {
    // Audit failure must NEVER crash the application
    console.error('[AUDIT] Failed to write audit log:', err)
  }
}

/**
 * Convenience wrapper — extract IP + UA from an Express request automatically.
 */
export function auditFromRequest(
  req: { ip?: string; headers: Record<string, string | string[] | undefined> },
  base: Omit<AuditEntry, 'ipAddress' | 'userAgent'>,
): Promise<void> {
  return writeAudit({
    ...base,
    ipAddress: req.ip,
    userAgent: String(req.headers['user-agent'] ?? ''),
  })
}
