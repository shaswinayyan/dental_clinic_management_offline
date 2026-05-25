import { pgTable, uuid, text, boolean, timestamp, unique } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clinics } from './clinics'
import { branches } from './branches'

export const staff = pgTable('staff', {
  id:            uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:     uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  branch_id:     uuid('branch_id').references(() => branches.id),
  /** Clerk user ID — set when the invited user accepts via Clerk */
  clerk_user_id: text('clerk_user_id').unique(),
  email:         text('email').notNull(),
  name:          text('name').notNull(),
  phone:         text('phone'),
  role:          text('role').notNull(),   // clinic_owner | branch_manager | doctor | receptionist
  designation:   text('designation'),
  is_active:     boolean('is_active').notNull().default(true),
  last_login_at: timestamp('last_login_at', { withTimezone: true }),
  created_at:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqEmail: unique().on(t.clinic_id, t.email),
}))

/** Pending staff invitations (email invite link flow) */
export const staffInvites = pgTable('staff_invites', {
  id:         uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:  uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  branch_id:  uuid('branch_id').references(() => branches.id),
  email:      text('email').notNull(),
  role:       text('role').notNull(),
  token:      text('token').notNull().unique(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  accepted_at:timestamp('accepted_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type StaffMember = typeof staff.$inferSelect
export type NewStaff    = typeof staff.$inferInsert
