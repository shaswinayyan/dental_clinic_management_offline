import type Database from 'better-sqlite3'

export function logAudit(
  db: Database.Database,
  userId: number | null,
  action: string,
  entityType: string,
  entityId?: number | null,
  details?: string | null
): void {
  try {
    db.prepare(
      `INSERT INTO audit_logs(user_id,action,entity_type,entity_id,new_value,performed_at)
       VALUES (?,?,?,?,?,datetime('now','localtime'))`
    ).run(userId ?? null, action, entityType, entityId ?? null, details ?? null)
  } catch { /* never break the main operation */ }
}
