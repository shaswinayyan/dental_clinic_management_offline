import { pgTable, uuid, text, boolean, timestamp, smallint, time, unique } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clinics } from './clinics'

export const branches = pgTable('branches', {
  id:         uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:  uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  name:       text('name').notNull(),
  address:    text('address'),
  phone:      text('phone'),
  timezone:   text('timezone').notNull().default('Asia/Kolkata'),
  is_active:  boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const branchWorkingHours = pgTable('branch_working_hours', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  branch_id:   uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'cascade' }),
  day_of_week: smallint('day_of_week').notNull(),
  open_time:   time('open_time').notNull().default('09:00'),
  close_time:  time('close_time').notNull().default('18:00'),
  is_open:     boolean('is_open').notNull().default(true),
}, (t) => ({
  uniq: unique().on(t.branch_id, t.day_of_week),
}))

export const apptConfig = pgTable('appt_config', {
  id:                   uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  branch_id:            uuid('branch_id').notNull().unique().references(() => branches.id, { onDelete: 'cascade' }),
  booking_mode:         text('booking_mode').notNull().default('slot'),
  default_slot_mins:    smallint('default_slot_mins').notNull().default(30),
  allow_online_booking: boolean('allow_online_booking').notNull().default(false),
  advance_booking_days: smallint('advance_booking_days').notNull().default(60),
  cancellation_hours:   smallint('cancellation_hours').notNull().default(2),
  updated_at:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const apptCustomStatuses = pgTable('appt_custom_statuses', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:   uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  label:       text('label').notNull(),
  color:       text('color').notNull().default('#6b7280'),
  is_terminal: boolean('is_terminal').notNull().default(false),
  sort_order:  smallint('sort_order').notNull().default(0),
}, (t) => ({
  uniq: unique().on(t.clinic_id, t.label),
}))

export const chairs = pgTable('chairs', {
  id:                uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:         uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  branch_id:         uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'cascade' }),
  name:              text('name').notNull(),
  type:              text('type').notNull().default('general'),
  default_slot_mins: smallint('default_slot_mins').notNull().default(30),
  is_active:         boolean('is_active').notNull().default(true),
}, (t) => ({
  uniq: unique().on(t.branch_id, t.name),
}))

export type Branch     = typeof branches.$inferSelect
export type NewBranch  = typeof branches.$inferInsert
export type Chair      = typeof chairs.$inferSelect
export type ApptConfig = typeof apptConfig.$inferSelect
