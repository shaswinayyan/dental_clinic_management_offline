import { ipcMain, BrowserWindow, shell, app } from 'electron'
import { getDb } from '../db'
import type { IpcResult, Invoice, InvoiceItem, Payment } from '../../shared/types'
import { generateInvoiceNumber } from '../utils/helpers'
import { logAudit } from '../utils/audit'
import path from 'path'
import fs from 'fs'

export function registerBillingHandlers(): void {
  ipcMain.handle('billing:listInvoices', async (_e, filters?: {
    patientId?: number, status?: string, method?: string, dateFrom?: string, dateTo?: string, billing_type?: string
  }): Promise<IpcResult<Invoice[]>> => {
    try {
      const db = getDb()
      let sql = `SELECT i.*, p.name as patient_name, p.op_id as patient_op_id
        FROM invoices i LEFT JOIN patients p ON i.patient_id=p.id WHERE 1=1`
      const params: unknown[] = []
      if (filters?.patientId) { sql += ' AND i.patient_id=?'; params.push(filters.patientId) }
      if (filters?.status) { sql += ' AND i.status=?'; params.push(filters.status) }
      if (filters?.dateFrom) { sql += ' AND date(i.created_at)>=?'; params.push(filters.dateFrom) }
      if (filters?.dateTo) { sql += ' AND date(i.created_at)<=?'; params.push(filters.dateTo) }
      if (filters?.billing_type) { sql += ' AND i.billing_type=?'; params.push(filters.billing_type) }
      sql += ' ORDER BY i.created_at DESC'
      return { success: true, data: db.prepare(sql).all(...params) as Invoice[] }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('billing:getInvoice', async (_e, id: number): Promise<IpcResult<Invoice>> => {
    try {
      const db = getDb()
      const inv = db.prepare(`SELECT i.*, p.name as patient_name, p.op_id as patient_op_id
        FROM invoices i LEFT JOIN patients p ON i.patient_id=p.id WHERE i.id=?`).get(id) as Invoice | undefined
      if (!inv) return { success: false, error: 'Invoice not found' }
      return { success: true, data: inv }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('billing:getInvoiceItems', async (_e, invoiceId: number): Promise<IpcResult<InvoiceItem[]>> => {
    try {
      const db = getDb()
      return { success: true, data: db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(invoiceId) as InvoiceItem[] }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('billing:getPayments', async (_e, invoiceId: number): Promise<IpcResult<Payment[]>> => {
    try {
      const db = getDb()
      const rows = db.prepare(`SELECT p.*, u.username as recorded_by_name, v.username as verified_by_name
        FROM payments p
        LEFT JOIN users u ON p.recorded_by=u.id
        LEFT JOIN users v ON p.verified_by=v.id
        WHERE p.invoice_id=?
        ORDER BY p.paid_at DESC`).all(invoiceId) as Payment[]
      return { success: true, data: rows }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('billing:createInvoice', async (_e, data: {
    patient_id: number, appointment_id?: number, billing_type?: string,
    items: { treatment_id?: number, description: string, quantity: number, unit_price: number, item_id?: number }[],
    discount_amount: number, discount_reason?: string, tax_rate: number, created_by: number
  }): Promise<IpcResult<number>> => {
    try {
      const db = getDb()
      const invNumber = generateInvoiceNumber(db)
      const billingType = data.billing_type ?? 'treatment'
      const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
      const taxAmount = (subtotal - data.discount_amount) * (data.tax_rate / 100)
      const total = subtotal - data.discount_amount + taxAmount

      const inv = db.prepare(`INSERT INTO invoices(invoice_number,patient_id,appointment_id,billing_type,subtotal,discount_amount,discount_reason,tax_amount,total_amount,amount_paid,status,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,0,'unpaid',?)`).run(
        invNumber, data.patient_id, data.appointment_id ?? null, billingType,
        subtotal, data.discount_amount, data.discount_reason ?? null,
        taxAmount, total, data.created_by
      )
      const invoiceId = inv.lastInsertRowid as number

      const itemStmt = db.prepare(`INSERT INTO invoice_items(invoice_id,treatment_id,description,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)`)
      data.items.forEach(item => {
        itemStmt.run(invoiceId, item.treatment_id ?? null, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price)
      })

      // For pharmacy billing: deduct medicine stock from inventory
      if (billingType === 'pharmacy') {
        const txStmt = db.prepare(`INSERT INTO inventory_transactions(item_id,branch_id,transaction_type,quantity,reason_notes,recorded_by,transaction_date)
          VALUES (?,1,'stock_out_procedure',?,?,?,datetime('now','localtime'))`)
        data.items.forEach(item => {
          if (item.item_id) {
            txStmt.run(item.item_id, -Math.abs(item.quantity), `Pharmacy billing invoice ${invNumber}`, data.created_by)
          }
        })
      }

      logAudit(db, data.created_by, 'CREATE', 'invoice', invoiceId, `Patient #${data.patient_id}, type: ${billingType}, total: ${total}`)
      return { success: true, data: invoiceId }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('billing:addPayment', async (_e, data: {
    invoice_id: number, amount: number, method: string, reference_number?: string, recorded_by: number, notes?: string
  }): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare(`INSERT INTO payments(invoice_id,amount,method,reference_number,recorded_by,notes)
        VALUES (?,?,?,?,?,?)`).run(
        data.invoice_id, data.amount, data.method,
        data.reference_number ?? null, data.recorded_by, data.notes ?? null
      )

      // Update invoice amount_paid and status
      const invoice = db.prepare('SELECT total_amount FROM invoices WHERE id=?').get(data.invoice_id) as { total_amount: number }
      const paidResult = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE invoice_id=?').get(data.invoice_id) as { total: number }
      const amountPaid = paidResult.total
      let status = 'unpaid'
      if (amountPaid >= invoice.total_amount) status = 'paid'
      else if (amountPaid > 0) status = 'partial'

      db.prepare('UPDATE invoices SET amount_paid=?,status=? WHERE id=?').run(amountPaid, status, data.invoice_id)
      logAudit(db, data.recorded_by, 'ADD_PAYMENT', 'invoice', data.invoice_id, `${data.method}: ${data.amount}`)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('billing:voidInvoice', async (_e, id: number, reason: string): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare('UPDATE invoices SET status=?,void_reason=? WHERE id=?').run('voided', reason, id)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('billing:verifyPayment', async (_e, paymentId: number, userId: number): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare('UPDATE payments SET is_verified=1,verified_by=? WHERE id=?').run(userId, paymentId)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('billing:listLedger', async (_e, filters?: {
    dateFrom?: string, dateTo?: string, method?: string, verified?: boolean
  }): Promise<IpcResult<Payment[]>> => {
    try {
      const db = getDb()
      let sql = `SELECT p.*, i.invoice_number, pt.name as patient_name, u.username as recorded_by_name, v.username as verified_by_name
        FROM payments p
        LEFT JOIN invoices i ON p.invoice_id=i.id
        LEFT JOIN patients pt ON i.patient_id=pt.id
        LEFT JOIN users u ON p.recorded_by=u.id
        LEFT JOIN users v ON p.verified_by=v.id
        WHERE 1=1`
      const params: unknown[] = []
      if (filters?.dateFrom) { sql += ' AND date(p.paid_at)>=?'; params.push(filters.dateFrom) }
      if (filters?.dateTo) { sql += ' AND date(p.paid_at)<=?'; params.push(filters.dateTo) }
      if (filters?.method) { sql += ' AND p.method=?'; params.push(filters.method) }
      if (filters?.verified !== undefined) { sql += ' AND p.is_verified=?'; params.push(filters.verified ? 1 : 0) }
      sql += ' ORDER BY p.paid_at DESC'
      return { success: true, data: db.prepare(sql).all(...params) as Payment[] }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('billing:markAllVerifiedToday', async (_e, userId: number): Promise<IpcResult> => {
    try {
      const db = getDb()
      const today = new Date().toISOString().slice(0, 10)
      db.prepare(`UPDATE payments SET is_verified=1,verified_by=? WHERE date(paid_at)=? AND is_verified=0`).run(userId, today)
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('billing:consolidatedReport', async (_e, filters?: {
    dateFrom?: string, dateTo?: string, status?: string
  }): Promise<IpcResult<{ invoices: Invoice[], totals: { billed: number, cash: number, upi: number, card: number, outstanding: number } }>> => {
    try {
      const db = getDb()
      let sql = `SELECT i.*, p.name as patient_name, p.op_id as patient_op_id
        FROM invoices i LEFT JOIN patients p ON i.patient_id=p.id WHERE 1=1`
      const params: unknown[] = []
      if (filters?.dateFrom) { sql += ' AND date(i.created_at)>=?'; params.push(filters.dateFrom) }
      if (filters?.dateTo) { sql += ' AND date(i.created_at)<=?'; params.push(filters.dateTo) }
      if (filters?.status) { sql += ' AND i.status=?'; params.push(filters.status) }
      sql += ' ORDER BY i.created_at DESC'
      const invoices = db.prepare(sql).all(...params) as Invoice[]

      const totals = {
        billed: invoices.reduce((s, i) => s + i.total_amount, 0),
        cash: 0, upi: 0, card: 0, outstanding: 0
      }
      const invoiceIds = invoices.map(i => i.id)
      if (invoiceIds.length > 0) {
        const placeholders = invoiceIds.map(() => '?').join(',')
        const payments = db.prepare(`SELECT method, SUM(amount) as total FROM payments WHERE invoice_id IN (${placeholders}) GROUP BY method`).all(...invoiceIds) as { method: string, total: number }[]
        payments.forEach(p => {
          if (p.method === 'cash') totals.cash = p.total
          else if (p.method === 'upi') totals.upi = p.total
          else if (p.method === 'card') totals.card = p.total
        })
        totals.outstanding = invoices.filter(i => i.status === 'unpaid' || i.status === 'partial').reduce((s, i) => s + (i.total_amount - i.amount_paid), 0)
      }
      return { success: true, data: { invoices, totals } }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('billing:getSettings', async (): Promise<IpcResult<{ tax_rate: number, discount_threshold: number }>> => {
    try {
      const db = getDb()
      const tax = (db.prepare(`SELECT value FROM app_settings WHERE key='tax_rate'`).get() as { value: string } | undefined)?.value ?? '18'
      const threshold = (db.prepare(`SELECT value FROM app_settings WHERE key='discount_threshold'`).get() as { value: string } | undefined)?.value ?? '20'
      return { success: true, data: { tax_rate: parseFloat(tax), discount_threshold: parseFloat(threshold) } }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('billing:printInvoice', async (_e, htmlContent: string, invoiceNumber: string): Promise<IpcResult<string>> => {
    let win: BrowserWindow | null = null
    let htmlPath = ''
    try {
      const tmpDir = app.getPath('temp')
      htmlPath = path.join(tmpDir, `zendenta-inv-${Date.now()}.html`)
      const pdfPath = path.join(tmpDir, `Invoice-${invoiceNumber.replace(/\//g, '-')}.pdf`)

      fs.writeFileSync(htmlPath, htmlContent, 'utf-8')

      win = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: false }
      })

      await win.loadFile(htmlPath)

      // Small delay to ensure all content/fonts are rendered
      await new Promise(r => setTimeout(r, 400))

      const pdfData = await win.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        margins: { marginType: 'custom', top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
      })

      win.close()
      win = null

      try { fs.unlinkSync(htmlPath) } catch { /* ignore */ }

      fs.writeFileSync(pdfPath, pdfData)
      await shell.openPath(pdfPath)
      return { success: true, data: pdfPath }
    } catch (e: unknown) {
      if (win) { try { win.close() } catch { /* ignore */ } }
      try { if (htmlPath) fs.unlinkSync(htmlPath) } catch { /* ignore */ }
      return { success: false, error: String(e) }
    }
  })
}
