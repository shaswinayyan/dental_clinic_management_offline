import { contextBridge, ipcRenderer } from 'electron'

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args)
}

const api = {
  // Auth
  auth: {
    login: (username: string, password: string) => invoke('auth:login', username, password),
    listUsers: () => invoke('auth:listUsers'),
    createUser: (username: string, password: string, role: string) => invoke('auth:createUser', username, password, role),
    resetPassword: (userId: number, newPassword: string) => invoke('auth:resetPassword', userId, newPassword),
    toggleUser: (userId: number, active: boolean) => invoke('auth:toggleUser', userId, active),
    initAdmin: () => invoke('auth:initAdmin'),
    credentialsChanged: () => invoke('auth:credentialsChanged')
  },

  // Patients
  patients: {
    list: (search?: string, includeArchived?: boolean) => invoke('patients:list', search, includeArchived),
    get: (id: number) => invoke('patients:get', id),
    getByOpId: (opId: string) => invoke('patients:getByOpId', opId),
    create: (data: unknown) => invoke('patients:create', data),
    update: (id: number, data: unknown) => invoke('patients:update', id, data),
    archive: (id: number) => invoke('patients:archive', id),
    restore: (id: number) => invoke('patients:restore', id),
    checkDuplicateContact: (contact: string, excludeId?: number) => invoke('patients:checkDuplicateContact', contact, excludeId),
    count: () => invoke('patients:count'),

    listAllergies: (patientId: number) => invoke('patients:listAllergies', patientId),
    addAllergy: (data: unknown) => invoke('patients:addAllergy', data),
    deleteAllergy: (id: number) => invoke('patients:deleteAllergy', id),

    listMedications: (patientId: number) => invoke('patients:listMedications', patientId),
    addMedication: (data: unknown) => invoke('patients:addMedication', data),
    updateMedicationStatus: (id: number, status: string) => invoke('patients:updateMedicationStatus', id, status),

    getDentalChart: (patientId: number) => invoke('patients:getDentalChart', patientId),
    addChartEntry: (data: unknown) => invoke('patients:addChartEntry', data),
    updateChartEntry: (id: number, data: unknown) => invoke('patients:updateChartEntry', id, data),

    listAssessments: (patientId: number) => invoke('patients:listAssessments', patientId),
    upsertAssessment: (data: unknown) => invoke('patients:upsertAssessment', data),

    listTreatments: (patientId: number) => invoke('patients:listTreatments', patientId),
    addTreatmentRecord: (data: unknown) => invoke('patients:addTreatmentRecord', data),

    listImages: (patientId: number) => invoke('patients:listImages', patientId),
    addImage: (data: unknown) => invoke('patients:addImage', data),
    deleteImage: (id: number) => invoke('patients:deleteImage', id),

    getTimeline: (patientId: number) => invoke('patients:getTimeline', patientId),

    listPrescriptions: (patientId: number) => invoke('patients:listPrescriptions', patientId),
    createPrescription: (data: unknown) => invoke('patients:createPrescription', data),
    updatePrescriptionStatus: (id: number, status: string, userId: number) => invoke('patients:updatePrescriptionStatus', id, status, userId)
  },

  // Appointments
  appointments: {
    listChairs: () => invoke('appointments:listChairs'),
    listTreatments: () => invoke('appointments:listTreatments'),
    allTreatments: () => invoke('appointments:allTreatments'),
    createTreatment: (data: unknown) => invoke('appointments:createTreatment', data),
    updateTreatment: (id: number, data: unknown) => invoke('appointments:updateTreatment', id, data),
    list: (filters?: unknown) => invoke('appointments:list', filters),
    get: (id: number) => invoke('appointments:get', id),
    create: (data: unknown) => invoke('appointments:create', data),
    update: (id: number, data: unknown) => invoke('appointments:update', id, data),
    updateStatus: (id: number, status: string, confirmedBy?: number) => invoke('appointments:updateStatus', id, status, confirmedBy),
    reschedule: (id: number, newScheduledAt: string, newDuration: number) => invoke('appointments:reschedule', id, newScheduledAt, newDuration),
    updateChair: (chairId: number, slotMinutes: number) => invoke('appointments:updateChair', chairId, slotMinutes),
    dashboard: () => invoke('appointments:dashboard')
  },

  // Billing
  billing: {
    listInvoices: (filters?: unknown) => invoke('billing:listInvoices', filters),
    getInvoice: (id: number) => invoke('billing:getInvoice', id),
    getInvoiceItems: (invoiceId: number) => invoke('billing:getInvoiceItems', invoiceId),
    getPayments: (invoiceId: number) => invoke('billing:getPayments', invoiceId),
    createInvoice: (data: unknown) => invoke('billing:createInvoice', data),
    addPayment: (data: unknown) => invoke('billing:addPayment', data),
    voidInvoice: (id: number, reason: string) => invoke('billing:voidInvoice', id, reason),
    verifyPayment: (paymentId: number, userId: number) => invoke('billing:verifyPayment', paymentId, userId),
    listLedger: (filters?: unknown) => invoke('billing:listLedger', filters),
    markAllVerifiedToday: (userId: number) => invoke('billing:markAllVerifiedToday', userId),
    consolidatedReport: (filters?: unknown) => invoke('billing:consolidatedReport', filters),
    getSettings: () => invoke('billing:getSettings'),
    printInvoice: (html: string, invoiceNumber: string) => invoke('billing:printInvoice', html, invoiceNumber)
  },

  // Inventory
  inventory: {
    listItems: (filters?: unknown) => invoke('inventory:listItems', filters),
    getItem: (id: number) => invoke('inventory:getItem', id),
    createItem: (data: unknown) => invoke('inventory:createItem', data),
    updateItem: (id: number, data: unknown) => invoke('inventory:updateItem', id, data),
    recordTransaction: (data: unknown) => invoke('inventory:recordTransaction', data),
    getTransactionHistory: (itemId: number) => invoke('inventory:getTransactionHistory', itemId),
    getDashboard: () => invoke('inventory:getDashboard'),
    getLowStockAlertCount: () => invoke('inventory:getLowStockAlertCount'),
    getExpiryBatches: (itemId: number) => invoke('inventory:getExpiryBatches', itemId),
    getReport: (reportType: string, filters?: unknown) => invoke('inventory:getReport', reportType, filters)
  },

  // Settings
  settings: {
    get: () => invoke('settings:get'),
    update: (updates: unknown) => invoke('settings:update', updates),
    selectBackupFolder: () => invoke('settings:selectBackupFolder'),
    backup: (destFolder?: string) => invoke('settings:backup', destFolder),
    selectBackupFile: () => invoke('settings:selectBackupFile'),
    restore: (backupFile: string) => invoke('settings:restore', backupFile),
    getDbPath: () => invoke('settings:getDbPath'),
    openDbFolder: () => invoke('settings:openDbFolder'),
    getAuditLog: (filters?: unknown) => invoke('settings:getAuditLog', filters),
    selectImageFile: () => invoke('settings:selectImageFile'),
    copyImageToStore: (srcPath: string, patientOpId: string) => invoke('settings:copyImageToStore', srcPath, patientOpId),
    openExternal: (url: string) => invoke('settings:openExternal', url)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
