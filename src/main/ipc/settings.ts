import { ipcMain, dialog, shell } from 'electron'
import { getDb } from '../db'
import type { IpcResult, AppSettings } from '../../shared/types'
import path from 'path'
import fs from 'fs'
import archiver from 'archiver'
import { app } from 'electron'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (): Promise<IpcResult<AppSettings>> => {
    try {
      const db = getDb()
      const rows = db.prepare('SELECT key,value FROM app_settings').all() as { key: string, value: string }[]
      const settings: Record<string, string> = {}
      rows.forEach(r => { settings[r.key] = r.value })
      return {
        success: true,
        data: {
          clinic_name: settings.clinic_name ?? 'My Dental Clinic',
          clinic_address: settings.clinic_address ?? '',
          clinic_phone: settings.clinic_phone ?? '',
          tax_rate: parseFloat(settings.tax_rate ?? '18'),
          discount_threshold: parseFloat(settings.discount_threshold ?? '20'),
          session_timeout_minutes: parseInt(settings.session_timeout_minutes ?? '30'),
          backup_enabled: parseInt(settings.backup_enabled ?? '0'),
          backup_time: settings.backup_time ?? '23:00',
          backup_retain_count: parseInt(settings.backup_retain_count ?? '7'),
          backup_path: settings.backup_path ?? '',
          expiry_alert_days: parseInt(settings.expiry_alert_days ?? '30')
        }
      }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('settings:update', async (_e, updates: Partial<AppSettings>): Promise<IpcResult> => {
    try {
      const db = getDb()
      const stmt = db.prepare('INSERT OR REPLACE INTO app_settings(key,value) VALUES (?,?)')
      Object.entries(updates).forEach(([k, v]) => stmt.run(k, String(v)))
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('settings:selectBackupFolder', async (): Promise<IpcResult<string>> => {
    try {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
      if (result.canceled || !result.filePaths[0]) return { success: false, error: 'No folder selected' }
      return { success: true, data: result.filePaths[0] }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('settings:backup', async (_e, destFolder?: string): Promise<IpcResult<string>> => {
    try {
      const db = getDb()
      const folder = destFolder || (db.prepare(`SELECT value FROM app_settings WHERE key='backup_path'`).get() as { value: string } | undefined)?.value
      if (!folder) return { success: false, error: 'No backup folder configured. Please select a backup folder in Settings.' }

      if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const backupFile = path.join(folder, `clinic_backup_${timestamp}.bak`)
      const dbPath = path.join(app.getPath('userData'), 'data', 'clinic.db')
      const imagesPath = path.join(app.getPath('userData'), 'data', 'images')

      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(backupFile)
        const archive = archiver('zip', { zlib: { level: 9 } })
        archive.pipe(output)
        if (fs.existsSync(dbPath)) archive.file(dbPath, { name: 'clinic.db' })
        if (fs.existsSync(imagesPath)) archive.directory(imagesPath, 'images')
        output.on('close', resolve)
        archive.on('error', reject)
        archive.finalize()
      })

      // Cleanup old backups
      const retainCount = parseInt((db.prepare(`SELECT value FROM app_settings WHERE key='backup_retain_count'`).get() as { value: string } | undefined)?.value ?? '7')
      const backups = fs.readdirSync(folder)
        .filter(f => f.startsWith('clinic_backup_') && f.endsWith('.bak'))
        .map(f => ({ name: f, time: fs.statSync(path.join(folder, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time)

      backups.slice(retainCount).forEach(b => {
        try { fs.unlinkSync(path.join(folder, b.name)) } catch { /* ignore */ }
      })

      return { success: true, data: backupFile }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('settings:selectBackupFile', async (): Promise<IpcResult<string>> => {
    try {
      const result = await dialog.showOpenDialog({ filters: [{ name: 'Backup Files', extensions: ['bak', 'zip'] }], properties: ['openFile'] })
      if (result.canceled || !result.filePaths[0]) return { success: false, error: 'No file selected' }
      return { success: true, data: result.filePaths[0] }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('settings:restore', async (_e, backupFile: string): Promise<IpcResult> => {
    try {
      const { execSync } = await import('child_process')
      const dbDir = path.join(app.getPath('userData'), 'data')

      // Pre-restore backup of current data
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const preRestoreFile = path.join(dbDir, `pre_restore_${ts}.db.bak`)
      const currentDb = path.join(dbDir, 'clinic.db')
      if (fs.existsSync(currentDb)) fs.copyFileSync(currentDb, preRestoreFile)

      // Extract using PowerShell Expand-Archive (Windows built-in)
      const escapedSrc = backupFile.replace(/'/g, "''")
      const escapedDst = dbDir.replace(/'/g, "''")
      execSync(`powershell -Command "Expand-Archive -Path '${escapedSrc}' -DestinationPath '${escapedDst}' -Force"`, { stdio: 'pipe' })

      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('settings:getDbPath', async (): Promise<IpcResult<string>> => {
    try {
      const dbPath = path.join(app.getPath('userData'), 'data', 'clinic.db')
      return { success: true, data: dbPath }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('settings:openDbFolder', async (): Promise<IpcResult> => {
    try {
      const dbDir = path.join(app.getPath('userData'), 'data')
      shell.openPath(dbDir)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('settings:getAuditLog', async (_e, filters?: { dateFrom?: string, dateTo?: string }): Promise<IpcResult<unknown[]>> => {
    try {
      const db = getDb()
      let sql = `SELECT al.*, u.username FROM audit_logs al LEFT JOIN users u ON al.user_id=u.id WHERE 1=1`
      const params: unknown[] = []
      if (filters?.dateFrom) { sql += ' AND date(al.performed_at)>=?'; params.push(filters.dateFrom) }
      if (filters?.dateTo) { sql += ' AND date(al.performed_at)<=?'; params.push(filters.dateTo) }
      sql += ' ORDER BY al.performed_at DESC LIMIT 500'
      return { success: true, data: db.prepare(sql).all(...params) }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('settings:selectImageFile', async (): Promise<IpcResult<string>> => {
    try {
      const result = await dialog.showOpenDialog({
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif'] }],
        properties: ['openFile']
      })
      if (result.canceled || !result.filePaths[0]) return { success: false, error: 'No file selected' }
      return { success: true, data: result.filePaths[0] }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('settings:copyImageToStore', async (_e, srcPath: string, patientOpId: string): Promise<IpcResult<string>> => {
    try {
      const imagesDir = path.join(app.getPath('userData'), 'data', 'images', patientOpId)
      if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true })
      const ext = path.extname(srcPath)
      const filename = `${Date.now()}${ext}`
      const destPath = path.join(imagesDir, filename)
      fs.copyFileSync(srcPath, destPath)
      return { success: true, data: destPath }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('settings:openExternal', async (_e, url: string): Promise<IpcResult> => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })
}
