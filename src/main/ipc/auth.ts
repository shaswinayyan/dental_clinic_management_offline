import { ipcMain } from 'electron'
import bcrypt from 'bcryptjs'
import { getDb } from '../db'
import type { IpcResult, User } from '../../shared/types'

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:login', async (_e, username: string, password: string): Promise<IpcResult<User>> => {
    try {
      const db = getDb()
      const user = db.prepare('SELECT * FROM users WHERE username=? AND is_active=1').get(username) as (User & { password_hash: string }) | undefined
      if (!user) return { success: false, error: 'Invalid username or password' }

      const valid = bcrypt.compareSync(password, user.password_hash)
      if (!valid) return { success: false, error: 'Invalid username or password' }

      const { password_hash: _, ...safeUser } = user
      return { success: true, data: safeUser as User }
    } catch (e: unknown) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('auth:listUsers', async (): Promise<IpcResult<User[]>> => {
    try {
      const db = getDb()
      const users = db.prepare('SELECT id,username,role,is_active,created_at FROM users').all() as User[]
      return { success: true, data: users }
    } catch (e: unknown) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('auth:createUser', async (_e, username: string, password: string, role: string): Promise<IpcResult> => {
    try {
      const db = getDb()
      const hash = bcrypt.hashSync(password, 10)
      db.prepare('INSERT INTO users(username,password_hash,role) VALUES (?,?,?)').run(username, hash, role)
      return { success: true }
    } catch (e: unknown) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('auth:resetPassword', async (_e, userId: number, newPassword: string): Promise<IpcResult> => {
    try {
      const db = getDb()
      const hash = bcrypt.hashSync(newPassword, 10)
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, userId)
      // Mark that default credentials have been changed — hides the hint on login screen
      db.prepare(`INSERT OR REPLACE INTO app_settings(key,value) VALUES ('credentials_changed','1')`).run()
      return { success: true }
    } catch (e: unknown) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('auth:toggleUser', async (_e, userId: number, active: boolean): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare('UPDATE users SET is_active=? WHERE id=?').run(active ? 1 : 0, userId)
      return { success: true }
    } catch (e: unknown) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('auth:initAdmin', async (): Promise<IpcResult> => {
    try {
      const db = getDb()
      const count = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c
      if (count === 0) {
        const hash = bcrypt.hashSync('admin123', 10)
        db.prepare('INSERT INTO users(username,password_hash,role) VALUES (?,?,?)').run('doctor', hash, 'doctor')
        const hash2 = bcrypt.hashSync('reception123', 10)
        db.prepare('INSERT INTO users(username,password_hash,role) VALUES (?,?,?)').run('receptionist', hash2, 'receptionist')
        // Fresh install — default credentials are in use, show the hint
        db.prepare(`INSERT OR IGNORE INTO app_settings(key,value) VALUES ('credentials_changed','0')`).run()
      }
      return { success: true }
    } catch (e: unknown) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('auth:credentialsChanged', async (): Promise<IpcResult<boolean>> => {
    try {
      const db = getDb()
      const row = db.prepare(`SELECT value FROM app_settings WHERE key='credentials_changed'`).get() as { value: string } | undefined
      // If the row doesn't exist yet (e.g. older install), treat as changed to avoid showing hint
      return { success: true, data: !row || row.value === '1' }
    } catch (e: unknown) {
      return { success: false, error: String(e) }
    }
  })
}
