import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clinics } from './clinics'
import { branches } from './branches'
import { staff } from './staff'

export const inventoryItems = pgTable('inventory_items', {
  id:            uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:     uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  branch_id:     uuid('branch_id').notNull().references(() => branches.id),
  item_name:     text('item_name').notNull(),
  category:      text('category').notNull(),
  unit:          text('unit').notNull(),
  current_stock: text('current_stock').notNull().default('0'),    // Stored as text; parse in app
  minimum_stock: text('minimum_stock').notNull().default('5'),
  unit_cost:     text('unit_cost').notNull().default('0'),
  is_active:     boolean('is_active').notNull().default(true),
  created_at:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const inventoryTransactions = pgTable('inventory_transactions', {
  id:               uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  item_id:          uuid('item_id').notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  clinic_id:        uuid('clinic_id').notNull().references(() => clinics.id),
  transaction_type: text('transaction_type').notNull(),  // stock_in | stock_out_treatment | stock_out_expired | adjustment
  quantity:         text('quantity').notNull(),
  unit_cost:        text('unit_cost').notNull().default('0'),
  notes:            text('notes'),
  transaction_date: timestamp('transaction_date', { withTimezone: true }).notNull().defaultNow(),
  recorded_by:      uuid('recorded_by').references(() => staff.id),
})

export type InventoryItem        = typeof inventoryItems.$inferSelect
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect
