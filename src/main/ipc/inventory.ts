import { ipcMain } from 'electron'
import { getDb } from '../db'
import type { IpcResult, InventoryItem, InventoryTransaction } from '../../shared/types'

export function registerInventoryHandlers(): void {
  ipcMain.handle('inventory:listItems', async (_e, filters?: {
    category?: string, status?: string, search?: string
  }): Promise<IpcResult<InventoryItem[]>> => {
    try {
      const db = getDb()
      let sql = `SELECT ii.*,
        (SELECT COALESCE(SUM(quantity),0) FROM inventory_transactions WHERE item_id=ii.id) as current_stock
        FROM inventory_items ii WHERE 1=1`
      const params: unknown[] = []
      if (filters?.category) { sql += ' AND ii.category=?'; params.push(filters.category) }
      if (filters?.search) { sql += ' AND ii.item_name LIKE ?'; params.push(`%${filters.search}%`) }
      sql += ' ORDER BY ii.item_name ASC'
      let rows = db.prepare(sql).all(...params) as InventoryItem[]

      if (filters?.status === 'low') {
        rows = rows.filter(r => r.current_stock > 0 && r.current_stock <= r.minimum_stock_level)
      } else if (filters?.status === 'out') {
        rows = rows.filter(r => r.current_stock <= 0)
      } else if (filters?.status === 'in') {
        rows = rows.filter(r => r.current_stock > r.minimum_stock_level)
      }
      if (filters?.status !== 'all' && !filters?.status?.startsWith('low') && !filters?.status?.startsWith('out') && !filters?.status?.startsWith('in')) {
        // default: active only
        rows = rows.filter(r => r.is_active)
      }
      return { success: true, data: rows }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('inventory:getItem', async (_e, id: number): Promise<IpcResult<InventoryItem>> => {
    try {
      const db = getDb()
      const row = db.prepare(`SELECT ii.*,
        (SELECT COALESCE(SUM(quantity),0) FROM inventory_transactions WHERE item_id=ii.id) as current_stock
        FROM inventory_items ii WHERE ii.id=?`).get(id) as InventoryItem | undefined
      if (!row) return { success: false, error: 'Item not found' }
      return { success: true, data: row }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('inventory:createItem', async (_e, data: Omit<InventoryItem, 'id' | 'current_stock'>): Promise<IpcResult<number>> => {
    try {
      const db = getDb()
      const r = db.prepare(`INSERT INTO inventory_items(branch_id,item_name,category,unit_of_measure,minimum_stock_level,reorder_quantity,unit_cost,storage_location,supplier_name,notes,is_active)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        data.branch_id ?? 1, data.item_name, data.category, data.unit_of_measure,
        data.minimum_stock_level, data.reorder_quantity, data.unit_cost,
        data.storage_location ?? null, data.supplier_name ?? null, data.notes ?? null, data.is_active ?? 1
      )
      return { success: true, data: r.lastInsertRowid as number }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('inventory:updateItem', async (_e, id: number, data: Partial<InventoryItem>): Promise<IpcResult> => {
    try {
      const db = getDb()
      db.prepare(`UPDATE inventory_items SET item_name=COALESCE(?,item_name),category=COALESCE(?,category),
        unit_of_measure=COALESCE(?,unit_of_measure),minimum_stock_level=COALESCE(?,minimum_stock_level),
        reorder_quantity=COALESCE(?,reorder_quantity),unit_cost=COALESCE(?,unit_cost),
        storage_location=?,supplier_name=?,notes=?,is_active=COALESCE(?,is_active)
        WHERE id=?`).run(
        data.item_name ?? null, data.category ?? null, data.unit_of_measure ?? null,
        data.minimum_stock_level ?? null, data.reorder_quantity ?? null, data.unit_cost ?? null,
        data.storage_location ?? null, data.supplier_name ?? null, data.notes ?? null,
        data.is_active ?? null, id
      )
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('inventory:recordTransaction', async (_e, data: Omit<InventoryTransaction, 'id' | 'item_name' | 'recorded_by_name'>): Promise<IpcResult> => {
    try {
      const db = getDb()
      // For stock out transactions, quantity should be negative
      const qty = ['stock_out_procedure', 'stock_out_wastage', 'stock_out_transfer'].includes(data.transaction_type)
        ? -Math.abs(data.quantity)
        : Math.abs(data.quantity)

      db.prepare(`INSERT INTO inventory_transactions(item_id,branch_id,transaction_type,quantity,unit_cost,batch_number,expiry_date,supplier_ref,linked_appointment_id,reason_notes,recorded_by,transaction_date)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        data.item_id, data.branch_id ?? 1, data.transaction_type, qty,
        data.unit_cost ?? null, data.batch_number ?? null, data.expiry_date ?? null,
        data.supplier_ref ?? null, data.linked_appointment_id ?? null,
        data.reason_notes ?? null, data.recorded_by, data.transaction_date
      )
      return { success: true }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('inventory:getTransactionHistory', async (_e, itemId: number): Promise<IpcResult<InventoryTransaction[]>> => {
    try {
      const db = getDb()
      const rows = db.prepare(`SELECT it.*, ii.item_name, u.username as recorded_by_name
        FROM inventory_transactions it
        LEFT JOIN inventory_items ii ON it.item_id=ii.id
        LEFT JOIN users u ON it.recorded_by=u.id
        WHERE it.item_id=?
        ORDER BY it.transaction_date DESC`).all(itemId) as InventoryTransaction[]
      return { success: true, data: rows }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('inventory:getDashboard', async (): Promise<IpcResult<{
    lowStock: InventoryItem[], expiringSoon: InventoryTransaction[], recentActivity: InventoryTransaction[], totalItems: number
  }>> => {
    try {
      const db = getDb()
      const alertDays = parseInt((db.prepare(`SELECT value FROM app_settings WHERE key='expiry_alert_days'`).get() as { value: string } | undefined)?.value ?? '30')
      const expiryThreshold = new Date()
      expiryThreshold.setDate(expiryThreshold.getDate() + alertDays)
      const today = new Date().toISOString().slice(0, 10)

      const allItems = db.prepare(`SELECT ii.*,
        (SELECT COALESCE(SUM(quantity),0) FROM inventory_transactions WHERE item_id=ii.id) as current_stock
        FROM inventory_items ii WHERE ii.is_active=1`).all() as InventoryItem[]

      const lowStock = allItems.filter(i => i.current_stock <= i.minimum_stock_level)

      const expiringSoon = db.prepare(`SELECT it.*, ii.item_name, u.username as recorded_by_name
        FROM inventory_transactions it
        LEFT JOIN inventory_items ii ON it.item_id=ii.id
        LEFT JOIN users u ON it.recorded_by=u.id
        WHERE it.expiry_date IS NOT NULL AND it.expiry_date<=? AND it.expiry_date>=?
        ORDER BY it.expiry_date ASC`).all(expiryThreshold.toISOString().slice(0, 10), today) as InventoryTransaction[]

      const recentActivity = db.prepare(`SELECT it.*, ii.item_name, u.username as recorded_by_name
        FROM inventory_transactions it
        LEFT JOIN inventory_items ii ON it.item_id=ii.id
        LEFT JOIN users u ON it.recorded_by=u.id
        ORDER BY it.transaction_date DESC LIMIT 10`).all() as InventoryTransaction[]

      const totalItems = (db.prepare('SELECT COUNT(*) as c FROM inventory_items WHERE is_active=1').get() as { c: number }).c

      return { success: true, data: { lowStock, expiringSoon, recentActivity, totalItems } }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('inventory:getLowStockAlertCount', async (): Promise<IpcResult<number>> => {
    try {
      const db = getDb()
      const items = db.prepare(`SELECT ii.minimum_stock_level,
        (SELECT COALESCE(SUM(quantity),0) FROM inventory_transactions WHERE item_id=ii.id) as current_stock
        FROM inventory_items ii WHERE ii.is_active=1`).all() as { minimum_stock_level: number, current_stock: number }[]
      const count = items.filter(i => i.current_stock <= i.minimum_stock_level).length
      return { success: true, data: count }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('inventory:getExpiryBatches', async (_e, itemId: number): Promise<IpcResult<InventoryTransaction[]>> => {
    try {
      const db = getDb()
      const rows = db.prepare(`SELECT * FROM inventory_transactions
        WHERE item_id=? AND expiry_date IS NOT NULL AND transaction_type IN ('stock_in_purchase','stock_in_return')
        ORDER BY expiry_date ASC`).all(itemId) as InventoryTransaction[]
      return { success: true, data: rows }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('inventory:getReport', async (_e, reportType: string, filters?: { dateFrom?: string, dateTo?: string, category?: string }): Promise<IpcResult<unknown>> => {
    try {
      const db = getDb()
      let data: unknown[]

      if (reportType === 'current_stock') {
        data = db.prepare(`SELECT ii.*,
          (SELECT COALESCE(SUM(quantity),0) FROM inventory_transactions WHERE item_id=ii.id) as current_stock
          FROM inventory_items ii WHERE ii.is_active=1 ORDER BY ii.category, ii.item_name`).all() as unknown[]
      } else if (reportType === 'low_stock') {
        const all = db.prepare(`SELECT ii.*,
          (SELECT COALESCE(SUM(quantity),0) FROM inventory_transactions WHERE item_id=ii.id) as current_stock
          FROM inventory_items ii WHERE ii.is_active=1`).all() as InventoryItem[]
        data = all.filter(i => i.current_stock <= i.minimum_stock_level)
      } else if (reportType === 'consumption') {
        let sql = `SELECT it.*, ii.item_name, ii.category FROM inventory_transactions it
          LEFT JOIN inventory_items ii ON it.item_id=ii.id
          WHERE it.transaction_type='stock_out_procedure'`
        const params: unknown[] = []
        if (filters?.dateFrom) { sql += ' AND date(it.transaction_date)>=?'; params.push(filters.dateFrom) }
        if (filters?.dateTo) { sql += ' AND date(it.transaction_date)<=?'; params.push(filters.dateTo) }
        if (filters?.category) { sql += ' AND ii.category=?'; params.push(filters.category) }
        sql += ' ORDER BY it.transaction_date DESC'
        data = db.prepare(sql).all(...params) as unknown[]
      } else if (reportType === 'purchase') {
        let sql = `SELECT it.*, ii.item_name FROM inventory_transactions it
          LEFT JOIN inventory_items ii ON it.item_id=ii.id
          WHERE it.transaction_type='stock_in_purchase'`
        const params: unknown[] = []
        if (filters?.dateFrom) { sql += ' AND date(it.transaction_date)>=?'; params.push(filters.dateFrom) }
        if (filters?.dateTo) { sql += ' AND date(it.transaction_date)<=?'; params.push(filters.dateTo) }
        sql += ' ORDER BY it.transaction_date DESC'
        data = db.prepare(sql).all(...params) as unknown[]
      } else if (reportType === 'wastage') {
        data = db.prepare(`SELECT it.*, ii.item_name FROM inventory_transactions it
          LEFT JOIN inventory_items ii ON it.item_id=ii.id
          WHERE it.transaction_type='stock_out_wastage' ORDER BY it.transaction_date DESC`).all() as unknown[]
      } else if (reportType === 'expiry') {
        data = db.prepare(`SELECT it.*, ii.item_name FROM inventory_transactions it
          LEFT JOIN inventory_items ii ON it.item_id=ii.id
          WHERE it.expiry_date IS NOT NULL ORDER BY it.expiry_date ASC`).all() as unknown[]
      } else {
        data = []
      }
      return { success: true, data }
    } catch (e: unknown) { return { success: false, error: String(e) } }
  })
}
