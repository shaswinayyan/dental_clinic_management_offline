import { pgTable, uuid, text, boolean, timestamp, date, unique } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clinics } from './clinics'
import { branches } from './branches'
import { staff } from './staff'

export const patients = pgTable('patients', {
  id:                   uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:            uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  branch_id:            uuid('branch_id').notNull().references(() => branches.id),
  op_id:                text('op_id').notNull(),
  name:                 text('name').notNull(),
  contact_number:       text('contact_number').notNull(),
  address:              text('address'),
  date_of_birth:        date('date_of_birth'),
  gender:               text('gender'),   // Male | Female | Other
  blood_group:          text('blood_group'),
  emergency_contact:    text('emergency_contact'),
  past_medical_history: text('past_medical_history'),
  archived_at:          timestamp('archived_at', { withTimezone: true }),
  created_at:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqOpId: unique().on(t.clinic_id, t.op_id),
}))

export const allergies = pgTable('allergies', {
  id:                   uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:            uuid('clinic_id').notNull().references(() => clinics.id),
  patient_id:           uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  allergen_name:        text('allergen_name').notNull(),
  allergy_type:         text('allergy_type').notNull(),    // Drug | Food | Material | Other
  severity:             text('severity').notNull(),         // Mild | Moderate | Severe
  reaction_description: text('reaction_description'),
  noted_at:             date('noted_at').default(sql`CURRENT_DATE`),
})

export const medications = pgTable('medications', {
  id:              uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:       uuid('clinic_id').notNull().references(() => clinics.id),
  patient_id:      uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  medication_name: text('medication_name').notNull(),
  dosage:          text('dosage'),
  frequency:       text('frequency'),
  duration:        text('duration'),
  prescribed_by:   text('prescribed_by'),
  prescribed_on:   date('prescribed_on'),
  reason:          text('reason'),
  status:          text('status').notNull().default('Active'),  // Active | Completed | Discontinued
})

export const dentalChartEntries = pgTable('dental_chart_entries', {
  id:             uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:      uuid('clinic_id').notNull().references(() => clinics.id),
  patient_id:     uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  tooth_number:   text('tooth_number').notNull(),
  surface:        text('surface').notNull(),   // mesial | distal | buccal | lingual | occlusal | full
  procedure_type: text('procedure_type').notNull(),
  status:         text('status').notNull().default('planned'),  // planned | completed | ongoing
  notes:          text('notes'),
  done_at:        date('done_at'),
  created_by:     uuid('created_by').notNull().references(() => staff.id),
  created_at:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const clinicalAssessments = pgTable('clinical_assessments', {
  id:             uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinic_id:      uuid('clinic_id').notNull().references(() => clinics.id),
  patient_id:     uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  appointment_id: uuid('appointment_id'),
  subjective:     text('subjective'),
  objective:      text('objective'),
  assessment:     text('assessment'),
  plan:           text('plan'),
  session_date:   date('session_date').notNull().default(sql`CURRENT_DATE`),
  created_by:     uuid('created_by').notNull().references(() => staff.id),
  created_at:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Patient    = typeof patients.$inferSelect
export type NewPatient = typeof patients.$inferInsert
