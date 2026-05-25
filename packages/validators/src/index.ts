/**
 * @vorsa/validators — Zod schemas shared between the Hono API and the Next.js frontend.
 *
 * Every schema here validates BOTH the HTTP request body server-side AND
 * the form inputs client-side (React Hook Form + Zod resolver) — single source of truth.
 */
import { z } from 'zod'

// ── Primitives ────────────────────────────────────────────────────────────────

export const uuidSchema     = z.string().uuid()
export const emailSchema    = z.string().email()
export const phoneSchema    = z.string().min(7).max(20).regex(/^[+\d\s\-()]+$/, 'Invalid phone number')
export const dateSchema     = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
export const timeSchema     = z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM')
export const slugSchema     = z.string().min(3).max(60).regex(/^[a-z0-9-]+$/, 'Slug: lowercase letters, numbers and hyphens only')
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters')

export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// ── Auth ──────────────────────────────────────────────────────────────────────

export const RegisterClinicSchema = z.object({
  clinic_name:   z.string().min(2).max(100),
  clinic_slug:   slugSchema,
  clinic_email:  emailSchema,
  clinic_phone:  phoneSchema.optional(),
  clinic_address: z.string().max(300).optional(),
  owner_name:    z.string().min(2).max(100),
  owner_email:   emailSchema,
  password:      passwordSchema,
  plan:          z.enum(['starter', 'business', 'enterprise']).default('starter'),
  timezone:      z.string().max(60).default('Asia/Kolkata'),
  country:       z.string().length(2).optional(),  // ISO 3166-1 alpha-2
})

export const LoginSchema = z.object({
  email:    emailSchema,
  password: z.string().min(1),
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     passwordSchema,
})

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
})

export const InviteStaffSchema = z.object({
  email:       emailSchema,
  name:        z.string().min(2).max(100),
  role:        z.enum(['branch_manager', 'doctor', 'receptionist']),
  branch_id:   uuidSchema.nullable().optional(),
  designation: z.string().max(80).optional(),
})

// ── Branches ──────────────────────────────────────────────────────────────────

export const CreateBranchSchema = z.object({
  name:     z.string().min(2).max(100),
  address:  z.string().max(300).optional(),
  phone:    phoneSchema.optional(),
  timezone: z.string().max(60).default('Asia/Kolkata'),
})

export const UpdateBranchSchema = CreateBranchSchema.partial()

export const WorkingHoursSchema = z.object({
  hours: z.array(z.object({
    day_of_week: z.number().int().min(0).max(6),
    open_time:   timeSchema,
    close_time:  timeSchema,
    is_open:     z.boolean(),
  })).length(7),
})

export const ApptConfigSchema = z.object({
  booking_mode:         z.enum(['slot', 'open', 'token']),
  default_slot_mins:    z.number().int().min(5).max(240),
  allow_online_booking: z.boolean(),
  advance_booking_days: z.number().int().min(1).max(365),
  cancellation_hours:   z.number().int().min(0).max(72),
})

export const CreateChairSchema = z.object({
  name:              z.string().min(1).max(80),
  type:              z.enum(['general', 'minor']),
  default_slot_mins: z.number().int().min(5).max(240).default(30),
})

// ── Staff ─────────────────────────────────────────────────────────────────────

export const CreateStaffSchema = z.object({
  name:         z.string().min(2).max(100),
  email:        emailSchema,
  phone:        phoneSchema.optional(),
  role:         z.enum(['branch_manager', 'doctor', 'receptionist']),
  branch_id:    uuidSchema.nullable().optional(),
  designation:  z.string().max(80).optional(),
  password:     passwordSchema,
})

export const UpdateStaffSchema = CreateStaffSchema.omit({ password: true }).partial()

// ── Patients ──────────────────────────────────────────────────────────────────

export const CreatePatientSchema = z.object({
  name:                 z.string().min(2).max(120),
  contact_number:       phoneSchema,
  branch_id:            uuidSchema,
  address:              z.string().max(300).optional(),
  date_of_birth:        dateSchema.optional(),
  gender:               z.enum(['Male', 'Female', 'Other']).optional(),
  blood_group:          z.string().max(5).optional(),
  emergency_contact:    z.string().max(100).optional(),
  past_medical_history: z.string().max(2000).optional(),
})

export const UpdatePatientSchema = CreatePatientSchema.omit({ branch_id: true }).partial()

// ── Appointments ──────────────────────────────────────────────────────────────

export const CreateAppointmentSchema = z.object({
  patient_id:       uuidSchema,
  branch_id:        uuidSchema,
  chair_id:         uuidSchema,
  treatment_id:     uuidSchema,
  doctor_id:        uuidSchema.optional(),
  scheduled_at:     z.string().datetime(),
  duration_minutes: z.number().int().min(5).max(480).default(30),
  notes:            z.string().max(1000).optional(),
})

export const UpdateAppointmentSchema = CreateAppointmentSchema.partial().extend({
  status:        z.enum(['scheduled','confirmed','pending','completed','cancelled','rescheduled']).optional(),
  custom_status: z.string().max(50).optional(),
})

// ── Billing ───────────────────────────────────────────────────────────────────

export const CreateInvoiceSchema = z.object({
  patient_id:     uuidSchema,
  branch_id:      uuidSchema,
  appointment_id: uuidSchema.optional(),
  notes:          z.string().max(500).optional(),
  items: z.array(z.object({
    treatment_id: uuidSchema.optional(),
    description:  z.string().min(1).max(200),
    quantity:     z.number().positive(),
    unit_price:   z.number().min(0),
  })).min(1),
})

export const RecordPaymentSchema = z.object({
  amount:    z.number().positive(),
  method:    z.enum(['cash','card','upi','bank_transfer','nets','stc_pay','apple_pay','google_pay','insurance']),
  reference: z.string().max(100).optional(),
  paid_at:   z.string().datetime().optional(),
})

// ── Inventory ─────────────────────────────────────────────────────────────────

export const CreateInventoryItemSchema = z.object({
  item_name:     z.string().min(2).max(120),
  category:      z.string().max(60),
  unit:          z.string().max(20),
  current_stock: z.number().min(0).default(0),
  minimum_stock: z.number().min(0).default(5),
  unit_cost:     z.number().min(0).default(0),
  branch_id:     uuidSchema,
})

export const RecordInventoryTransactionSchema = z.object({
  item_id:          uuidSchema,
  transaction_type: z.enum(['stock_in','stock_out_treatment','stock_out_expired','adjustment']),
  quantity:         z.number().positive(),
  unit_cost:        z.number().min(0),
  notes:            z.string().max(300).optional(),
})

// ── Customisation ─────────────────────────────────────────────────────────────

export const NotationUpdateSchema = z.object({
  notation: z.enum(['fdi', 'universal', 'palmer']),
})

export const CurrencyUpdateSchema = z.object({
  currency:            z.string().length(3),   // ISO 4217
  currency_symbol:     z.string().max(8),
  tax_label:           z.string().max(30).optional(),
  tax_rate:            z.number().min(0).max(100).optional(),
  invoice_prefix:      z.string().max(10).optional(),
  invoice_year_in_num: z.boolean().optional(),
  invoice_footer:      z.string().max(300).optional(),
})

export const ModulesUpdateSchema = z.object({
  inventory:      z.boolean(),
  analytics:      z.boolean(),
  patient_portal: z.boolean(),
  custom_fields:  z.boolean(),
  api_access:     z.boolean(),
})

export const ApplyTemplateSchema = z.object({
  template: z.enum(['india', 'usa', 'uae', 'uk', 'generic']),
})

// ── Custom fields ─────────────────────────────────────────────────────────────

export const UpsertCustomFieldSchema = z.object({
  id:          uuidSchema.optional(),
  entity:      z.enum(['appointment', 'patient']),
  field_name:  z.string().min(1).max(60),
  field_type:  z.enum(['text', 'number', 'date', 'select', 'checkbox']),
  options:     z.array(z.string()).optional(),
  is_required: z.boolean().default(false),
  sort_order:  z.number().int().min(0).default(0),
})

export const UpsertCustomStatusSchema = z.object({
  id:          uuidSchema.optional(),
  label:       z.string().min(1).max(60),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/),
  is_terminal: z.boolean().default(false),
  sort_order:  z.number().int().min(0).default(0),
})

// ── Treatment catalogue ───────────────────────────────────────────────────────

export const CreateTreatmentSchema = z.object({
  name:                     z.string().min(2).max(120),
  category:                 z.string().max(60),
  default_duration_minutes: z.number().int().min(5).max(480).default(30),
  default_price:            z.number().min(0).default(0),
  applicable_chairs:        z.array(uuidSchema).default([]),
})

export const UpdateTreatmentSchema = CreateTreatmentSchema.partial()

// ── Type exports ──────────────────────────────────────────────────────────────

export type RegisterClinicInput    = z.infer<typeof RegisterClinicSchema>
export type LoginInput             = z.infer<typeof LoginSchema>
export type CreatePatientInput     = z.infer<typeof CreatePatientSchema>
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>
export type CreateInvoiceInput     = z.infer<typeof CreateInvoiceSchema>
export type RecordPaymentInput     = z.infer<typeof RecordPaymentSchema>
export type CreateStaffInput       = z.infer<typeof CreateStaffSchema>
export type CreateBranchInput      = z.infer<typeof CreateBranchSchema>
