/**
 * Zod validation schemas shared between the server (Express middleware) and
 * the client (form validation / API call helpers).
 *
 * Import from either side:
 *   import { LoginSchema, CreatePatientSchema } from '../../shared/validationSchemas'
 */
import { z } from 'zod'

// ── Primitives ────────────────────────────────────────────────────────────────

export const uuidSchema    = z.string().uuid()
export const emailSchema   = z.string().trim().email()
export const phoneSchema   = z.string().trim().min(7).max(20)
export const dateSchema    = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
export const timeSchema    = z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM')
export const slugSchema    = z
  .string()
  .trim()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// ── Auth ──────────────────────────────────────────────────────────────────────

export const RegisterClinicSchema = z.object({
  clinicName:    z.string().trim().min(2).max(120),
  slug:          slugSchema,
  ownerName:     z.string().trim().min(2).max(100),
  ownerEmail:    emailSchema,
  ownerPassword: passwordSchema,
  ownerPhone:    phoneSchema.optional(),
  branchName:    z.string().trim().min(2).max(120).optional(),
})

export const LoginSchema = z.object({
  email:    emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
})

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword:     passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path:    ['confirmPassword'],
  })

// ── Clinic / Branch ───────────────────────────────────────────────────────────

export const UpdateClinicSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
})

export const CreateBranchSchema = z.object({
  name:      z.string().trim().min(2).max(120),
  address:   z.string().trim().max(300).optional(),
  phone:     phoneSchema.optional(),
  is_active: z.boolean().default(true),
})

export const UpdateBranchSchema = CreateBranchSchema.partial()

export const WorkingHoursSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  open_time:   timeSchema,
  close_time:  timeSchema,
  is_open:     z.boolean(),
})

export const BulkWorkingHoursSchema = z.array(WorkingHoursSchema).min(1).max(7)

// ── Staff ─────────────────────────────────────────────────────────────────────

export const CloudRoleSchema = z.enum([
  'clinic_owner',
  'branch_manager',
  'doctor',
  'receptionist',
])

export const CreateStaffSchema = z.object({
  branch_id:   uuidSchema.nullable(),
  name:        z.string().trim().min(2).max(100),
  email:       emailSchema,
  password:    passwordSchema,
  phone:       phoneSchema.optional(),
  role:        CloudRoleSchema,
  designation: z.string().trim().max(80).optional(),
  is_active:   z.boolean().default(true),
})

export const UpdateStaffSchema = CreateStaffSchema.omit({ password: true }).partial()

// ── Patients ──────────────────────────────────────────────────────────────────

export const CreatePatientSchema = z.object({
  branch_id:            uuidSchema,
  name:                 z.string().trim().min(2).max(150),
  contact_number:       phoneSchema,
  address:              z.string().trim().max(300).optional(),
  date_of_birth:        dateSchema.optional(),
  gender:               z.enum(['Male', 'Female', 'Other']).optional(),
  blood_group:          z.string().max(10).optional(),
  emergency_contact:    phoneSchema.optional(),
  past_medical_history: z.string().max(2000).optional(),
})

export const UpdatePatientSchema = CreatePatientSchema.omit({ branch_id: true }).partial()

// ── Appointments ──────────────────────────────────────────────────────────────

export const AppointmentStatusSchema = z.enum([
  'scheduled',
  'confirmed',
  'pending',
  'completed',
  'cancelled',
  'rescheduled',
])

export const CreateAppointmentSchema = z.object({
  branch_id:         uuidSchema,
  patient_id:        uuidSchema,
  chair_id:          uuidSchema,
  treatment_id:      uuidSchema,
  doctor_id:         uuidSchema,
  scheduled_at:      z.string().datetime({ offset: true }),
  duration_minutes:  z.number().int().min(5).max(480),
  notes:             z.string().max(1000).optional(),
  custom_status:     z.string().max(50).optional(),
  custom_fields:     z.record(z.string(), z.unknown()).optional(),
})

export const UpdateAppointmentSchema = CreateAppointmentSchema.partial().extend({
  status: AppointmentStatusSchema.optional(),
})

// ── Appointment configuration ─────────────────────────────────────────────────

export const BookingModeSchema = z.enum(['slot', 'open', 'token'])

export const UpdateApptConfigSchema = z.object({
  booking_mode:          BookingModeSchema.optional(),
  slot_duration_mins:    z.number().int().min(5).max(120).optional(),
  advance_booking_days:  z.number().int().min(1).max(365).optional(),
  allow_walk_in:         z.boolean().optional(),
})

export const CreateCustomStatusSchema = z.object({
  label:      z.string().trim().min(1).max(50),
  color:      z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #ff0000'),
  sort_order: z.number().int().min(0).default(0),
  is_default: z.boolean().default(false),
})

// ── Custom fields ─────────────────────────────────────────────────────────────

export const CustomFieldTypeSchema = z.enum([
  'text',
  'number',
  'date',
  'boolean',
  'select',
  'multiselect',
])

export const UpsertCustomFieldSchema = z.object({
  entity_type: z.enum(['patient', 'appointment']),
  label:       z.string().trim().min(1).max(80),
  field_type:  CustomFieldTypeSchema,
  options:     z.array(z.string().trim().min(1)).optional(),
  is_required: z.boolean().default(false),
  sort_order:  z.number().int().min(0).default(0),
  is_active:   z.boolean().default(true),
})

// ── Billing ───────────────────────────────────────────────────────────────────

export const InvoiceItemSchema = z.object({
  treatment_id: uuidSchema.optional(),
  description:  z.string().trim().min(1).max(200),
  quantity:     z.number().positive(),
  unit_price:   z.number().min(0),
})

export const CreateInvoiceSchema = z.object({
  patient_id:       uuidSchema,
  appointment_id:   uuidSchema.optional(),
  billing_type:     z.enum(['treatment', 'pharmacy']),
  items:            z.array(InvoiceItemSchema).min(1),
  discount_amount:  z.number().min(0).default(0),
  discount_reason:  z.string().max(200).optional(),
  tax_amount:       z.number().min(0).default(0),
  notes:            z.string().max(500).optional(),
})

export const VoidInvoiceSchema = z.object({
  reason: z.string().trim().min(1).max(300),
})

export const RecordPaymentSchema = z.object({
  amount:           z.number().positive(),
  method:           z.enum(['cash', 'upi', 'card']),
  reference_number: z.string().max(100).optional(),
  notes:            z.string().max(300).optional(),
})

// ── Inventory ─────────────────────────────────────────────────────────────────

export const CreateInventoryItemSchema = z.object({
  branch_id:           uuidSchema,
  item_name:           z.string().trim().min(1).max(150),
  category:            z.enum(['consumable', 'material', 'instrument', 'medicine', 'ppe', 'equipment']),
  unit_of_measure:     z.string().trim().min(1).max(30),
  minimum_stock_level: z.number().min(0).default(0),
  reorder_quantity:    z.number().min(0).default(0),
  unit_cost:           z.number().min(0).default(0),
  storage_location:    z.string().max(100).optional(),
  supplier_name:       z.string().max(150).optional(),
  notes:               z.string().max(500).optional(),
})

export const RecordInventoryTransactionSchema = z.object({
  item_id:               uuidSchema,
  branch_id:             uuidSchema,
  transaction_type:      z.enum([
    'stock_in_purchase',
    'stock_in_return',
    'stock_out_procedure',
    'stock_out_wastage',
    'stock_out_transfer',
    'adjustment',
  ]),
  quantity:              z.number().refine((v) => v !== 0, 'Quantity cannot be zero'),
  unit_cost:             z.number().min(0).optional(),
  batch_number:          z.string().max(50).optional(),
  expiry_date:           dateSchema.optional(),
  supplier_ref:          z.string().max(100).optional(),
  linked_appointment_id: uuidSchema.optional(),
  reason_notes:          z.string().max(300).optional(),
})

// ── Inferred TypeScript types ─────────────────────────────────────────────────
// These let you derive the TS type directly from the schema without duplication.

export type RegisterClinicInput   = z.infer<typeof RegisterClinicSchema>
export type LoginInput            = z.infer<typeof LoginSchema>
export type CreateBranchInput     = z.infer<typeof CreateBranchSchema>
export type CreateStaffInput      = z.infer<typeof CreateStaffSchema>
export type CreatePatientInput    = z.infer<typeof CreatePatientSchema>
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>
export type UpdateApptConfigInput = z.infer<typeof UpdateApptConfigSchema>
export type CreateInvoiceInput    = z.infer<typeof CreateInvoiceSchema>
export type RecordPaymentInput    = z.infer<typeof RecordPaymentSchema>
