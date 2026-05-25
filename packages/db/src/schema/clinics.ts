import { pgTable, uuid, text, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const planEnum = pgEnum('clinic_plan', ['starter', 'business', 'enterprise'])

export const clinics = pgTable('clinics', {
  id:         uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  slug:       text('slug').notNull().unique(),
  name:       text('name').notNull(),
  address:    text('address'),
  phone:      text('phone'),
  email:      text('email').notNull().unique(),
  logo_url:   text('logo_url'),
  plan:       planEnum('plan').notNull().default('starter'),
  is_active:  boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const clinicSettings = pgTable('clinic_settings', {
  id:                  uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:           uuid('clinic_id').notNull().unique().references(() => clinics.id, { onDelete: 'cascade' }),
  notation_system:     text('notation_system').notNull().default('fdi'),
  currency:            text('currency').notNull().default('USD'),
  currency_symbol:     text('currency_symbol').notNull().default('$'),
  tax_label:           text('tax_label').default('Tax'),
  tax_rate:            text('tax_rate').default('0'),   // Stored as text to avoid float precision issues
  invoice_prefix:      text('invoice_prefix').default('INV'),
  invoice_year_in_num: boolean('invoice_year_in_num').notNull().default(true),
  invoice_footer:      text('invoice_footer'),
  op_id_counter:       text('op_id_counter').notNull().default('0'),
  invoice_counter:     text('invoice_counter').notNull().default('0'),
  modules:             text('modules').notNull().default('{}'),  // JSON: { inventory: true, analytics: false, ... }
  payment_methods:     text('payment_methods').notNull().default('[]'),  // JSON array
  updated_at:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const auditLogs = pgTable('audit_logs', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:   uuid('clinic_id').notNull(),
  staff_id:    uuid('staff_id'),
  action:      text('action').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id:   text('entity_id'),
  ip_address:  text('ip_address'),
  changes:     text('changes'),   // JSON snapshot
  created_at:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Clinic        = typeof clinics.$inferSelect
export type NewClinic     = typeof clinics.$inferInsert
export type ClinicSettings = typeof clinicSettings.$inferSelect
