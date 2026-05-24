import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { initializeSchema, seedDefaults, runMigrations } from './schema'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) throw new Error('Database not initialized')
  return _db
}

export function initDb(customPath?: string): Database.Database {
  const dbDir = customPath || path.join(app.getPath('userData'), 'data')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  const dbPath = path.join(dbDir, 'clinic.db')
  _db = new Database(dbPath)

  initializeSchema(_db)
  runMigrations(_db)
  seedDefaults(_db)

  return _db
}

export function closeDb(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}
