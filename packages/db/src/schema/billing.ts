import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clinics } from './clinics'
import { branches } from './branches'
import { patients } from './patients'
import { appointments, treatments } from './appointments'
import { staff } from './staff'

export const invoices = pgTable('invoices', {
  id:             uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:      uuid('clinic_id').notNull().references(() => clinics.id),
  branch_id:      uuid('branch_id').notNull().references(() => branches.id),
  patient_id:     uuid('patient_id').notNull().references(() => patients.id),
  appointment_id: uuid('appointment_id').references(() => appointments.id),
  invoice_number: text('invoice_number').notNull(),
  total_amount:   text('total_amount').notNull().default('0'),    // Stored as text; parse to number in app
  amount_paid:    text('amount_paid').notNull().default('0'),
  status:         text('status').notNull().default('unpaid'),    // unpaid | partial | paid | void
  notes:          text('notes'),
  void_reason:    text('void_reason'),
  created_by:     uuid('created_by').references(() => staff.id),
  created_at:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const invoiceItems = pgTable('invoice_items', {
  id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  invoice_id:   uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  treatment_id: uuid('treatment_id').references(() => treatments.id),
  description:  text('description').notNull(),
  quantity:     text('quantity').notNull().default('1'),
  unit_price:   text('unit_price').notNull().default('0'),
  total_price:  text('total_price').notNull().default('0'),
})

export const payments = pgTable('payments', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  invoice_id:  uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  clinic_id:   uuid('clinic_id').notNull().references(() => clinics.id),
  amount:      text('amount').notNull(),
  method:      text('method').notNull(),   // cash | card | upi | bank_transfer | nets | stc_pay | apple_pay | google_pay | insurance
  reference:   text('reference'),
  paid_at:     timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
  recorded_by: uuid('recorded_by').references(() => staff.id),
})

export type Invoice    = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
export type Payment    = typeof payments.$inferSelect
