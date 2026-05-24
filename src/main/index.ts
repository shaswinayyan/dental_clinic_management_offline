import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { initDb, closeDb } from './db'
import { registerAuthHandlers } from './ipc/auth'
import { registerPatientHandlers } from './ipc/patients'
import { registerAppointmentHandlers } from './ipc/appointments'
import { registerBillingHandlers } from './ipc/billing'
import { registerInventoryHandlers } from './ipc/inventory'
import { registerSettingsHandlers } from './ipc/settings'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1280,
    minHeight: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: 'default',
    title: 'Dental Clinic Manager'
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  initDb()

  registerAuthHandlers()
  registerPatientHandlers()
  registerAppointmentHandlers()
  registerBillingHandlers()
  registerInventoryHandlers()
  registerSettingsHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.on('app:quit', () => {
  closeDb()
  app.quit()
})
