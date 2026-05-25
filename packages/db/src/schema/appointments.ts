import { pgTable, uuid, text, timestamp, smallint } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clinics } from './clinics'
import { branches } from './branches'
import { patients } from './patients'
import { chairs } from './branches'
import { staff } from './staff'

// treatments is defined here to avoid circular deps
export const treatments = pgTable('treatments', {
  id:                       uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:                uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  name:                     text('name').notNull(),
  category:                 text('category').notNull(),
  default_duration_minutes: smallint('default_duration_minutes').notNull().default(30),
  default_price:            text('default_price').notNull().default('0'),  // numeric stored as text to avoid float issues
  applicable_chairs:        text('applicable_chairs').notNull().default('[]'),  // JSON array of chair UUIDs
  is_active:                text('is_active').notNull().default('true'),
})

export const appointments = pgTable('appointments', {
  id:               uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:        uuid('clinic_id').notNull().references(() => clinics.id),
  branch_id:        uuid('branch_id').notNull().references(() => branches.id),
  patient_id:       uuid('patient_id').notNull().references(() => patients.id),
  chair_id:         uuid('chair_id').notNull().references(() => chairs.id),
  treatment_id:     uuid('treatment_id').notNull().references(() => treatments.id),
  doctor_id:        uuid('doctor_id').references(() => staff.id),
  scheduled_at:     timestamp('scheduled_at', { withTimezone: true }).notNull(),
  duration_minutes: smallint('duration_minutes').notNull().default(30),
  status:           text('status').notNull().default('scheduled'),
  custom_status:    text('custom_status'),
  notes:            text('notes'),
  confirmed_by:     uuid('confirmed_by').references(() => staff.id),
  completed_at:     timestamp('completed_at', { withTimezone: true }),
  created_at:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const treatmentRecords = pgTable('treatment_records', {
  id:             uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:      uuid('clinic_id').notNull().references(() => clinics.id),
  patient_id:     uuid('patient_id').notNull().references(() => patients.id),
  appointment_id: uuid('appointment_id').references(() => appointments.id),
  treatment_id:   uuid('treatment_id').notNull().references(() => treatments.id),
  treated_by:     uuid('treated_by').references(() => staff.id),
  treated_at:     timestamp('treated_at', { withTimezone: true }).notNull().defaultNow(),
  notes:          text('notes'),
})

export const customFields = pgTable('custom_fields', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:   uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  entity:      text('entity').notNull(),   // appointment | patient
  field_name:  text('field_name').notNull(),
  field_type:  text('field_type').notNull(),  // text | number | date | select | checkbox
  options:     text('options'),   // JSON array of string options for 'select'
  is_required: text('is_required').notNull().default('false'),
  sort_order:  smallint('sort_order').notNull().default(0),
})

export type Appointment    = typeof appointments.$inferSelect
export type NewAppointment = typeof appointments.$inferInsert
export type Treatment      = typeof treatments.$inferSelect
