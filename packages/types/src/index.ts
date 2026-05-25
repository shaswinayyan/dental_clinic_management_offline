/**
 * @vorsa/types — Shared TypeScript types across all apps and packages.
 *
 * These types are the single source of truth for the VORSA data model.
 * They are used in:
 *  - The Hono API server (request/response types)
 *  - The Next.js frontend (component props, form types)
 *  - The Drizzle schema (inference targets)
 *  - The migration CLI
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type CloudRole = 'clinic_owner' | 'branch_manager' | 'doctor' | 'receptionist'

/** Subscription plan tiers — PRD §8.1. */
export type ClinicPlan = 'starter' | 'business' | 'enterprise'

export type BookingMode = 'slot' | 'open' | 'token'

export type AppointmentStatus =
  | 'scheduled' | 'confirmed' | 'pending'
  | 'completed' | 'cancelled' | 'rescheduled'

export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox'

export type NotationSystem = 'fdi' | 'universal' | 'palmer'

// ── Core entities ─────────────────────────────────────────────────────────────

export interface Clinic {
  id:         string
  slug:       string
  name:       string
  address?:   string | null
  phone?:     string | null
  email:      string
  logo_url?:  string | null
  plan:       ClinicPlan
  is_active:  boolean
  created_at: string
  updated_at: string
}

export interface Branch {
  id:         string
  clinic_id:  string
  name:       string
  address?:   string | null
  phone?:     string | null
  timezone:   string
  is_active:  boolean
  created_at: string
  updated_at: string
}

export interface WorkingHours {
  id:          string
  branch_id:   string
  day_of_week: number    // 0 = Sunday … 6 = Saturday
  open_time:   string    // HH:MM
  close_time:  string    // HH:MM
  is_open:     boolean
}

export interface StaffMember {
  id:            string
  clinic_id:     string
  branch_id:     string | null
  clerk_user_id: string | null   // Clerk user ID (null until Clerk invite accepted)
  name:          string
  email:         string
  phone?:        string | null
  role:          CloudRole
  designation?:  string | null
  is_active:     boolean
  created_at:    string
  updated_at:    string
  /** Populated by /auth/me from the parent clinic record. */
  plan?:         ClinicPlan
  clinic_name?:  string
}

export interface Chair {
  id:                string
  clinic_id:         string
  branch_id:         string
  name:              string
  type:              'general' | 'minor'
  default_slot_mins: number
  is_active:         boolean
}

export interface Treatment {
  id:                       string
  clinic_id:                string
  name:                     string
  category:                 string
  default_duration_minutes: number
  default_price:            number
  applicable_chairs:        string[]
  is_active:                boolean
}

export interface Patient {
  id:                   string
  clinic_id:            string
  branch_id:            string
  op_id:                string
  name:                 string
  contact_number:       string
  address?:             string | null
  date_of_birth?:       string | null
  gender?:              'Male' | 'Female' | 'Other' | null
  blood_group?:         string | null
  emergency_contact?:   string | null
  past_medical_history?: string | null
  archived_at?:         string | null
  created_at:           string
  updated_at:           string
}

export interface PatientFormData {
  name:                 string
  contact_number:       string
  address?:             string
  date_of_birth?:       string
  gender?:              'Male' | 'Female' | 'Other'
  blood_group?:         string
  emergency_contact?:   string
  past_medical_history?: string
}

export interface Appointment {
  id:               string
  clinic_id:        string
  branch_id:        string
  patient_id:       string
  chair_id:         string
  treatment_id:     string
  doctor_id?:       string | null
  scheduled_at:     string
  duration_minutes: number
  status:           AppointmentStatus
  custom_status?:   string | null
  notes?:           string | null
  created_at:       string
  updated_at:       string
}

export interface AppointmentFormData {
  patient_id:       string
  chair_id:         string
  treatment_id:     string
  doctor_id?:       string
  scheduled_at:     string
  duration_minutes?: number
  notes?:           string
}

export interface Invoice {
  id:             string
  clinic_id:      string
  branch_id:      string
  patient_id:     string
  appointment_id?: string | null
  invoice_number: string
  total_amount:   number
  amount_paid:    number
  status:         'unpaid' | 'partial' | 'paid' | 'void'
  notes?:         string | null
  created_at:     string
  updated_at:     string
}

export interface InvoiceItem {
  id:           string
  invoice_id:   string
  treatment_id?: string | null
  description:  string
  quantity:     number
  unit_price:   number
  total_price:  number
}

export interface Payment {
  id:             string
  invoice_id:     string
  clinic_id:      string
  amount:         number
  method:         string
  reference?:     string | null
  paid_at:        string
  recorded_by:    string
}

export interface InventoryItem {
  id:            string
  clinic_id:     string
  branch_id:     string
  item_name:     string
  category:      string
  unit:          string
  current_stock: number
  minimum_stock: number
  unit_cost:     number
  is_active:     boolean
}

export interface InventoryTransaction {
  id:               string
  item_id:          string
  clinic_id:        string
  transaction_type: string
  quantity:         number
  unit_cost:        number
  notes?:           string | null
  transaction_date: string
}

// ── Configuration types ───────────────────────────────────────────────────────

export interface ApptConfig {
  id:                  string
  branch_id:           string
  booking_mode:        BookingMode
  default_slot_mins:   number
  allow_online_booking: boolean
  advance_booking_days: number
  cancellation_hours:  number
}

export interface ApptCustomStatus {
  id:         string
  clinic_id:  string
  label:      string
  color:      string
  is_terminal: boolean
  sort_order:  number
}

export interface CustomField {
  id:          string
  clinic_id:   string
  entity:      'appointment' | 'patient'
  field_name:  string
  field_type:  CustomFieldType
  options?:    string[] | null
  is_required: boolean
  sort_order:  number
}

// ── Auth types ────────────────────────────────────────────────────────────────

export interface CloudAuthSession {
  accessToken:  string
  refreshToken?: string
  expiresIn:    number
  staff:        StaffMember
}

// ── Plan enforcement types ────────────────────────────────────────────────────

export interface PlanLimits {
  branches:  number
  doctors:   number
  patients:  number
  chairs:    number
}

export const PLAN_LIMITS: Record<ClinicPlan, PlanLimits> = {
  starter:    { branches: 1,         doctors: 2,         patients: 2_000,        chairs: 3         },
  business:   { branches: 5,         doctors: 15,        patients: 20_000,       chairs: 20        },
  enterprise: { branches: 999_999,   doctors: 999_999,   patients: 999_999_999,  chairs: 999_999   },
}

// ── API response wrappers ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: true
  data:    T
}

export interface ApiErrorResponse {
  success: false
  error:   string
  issues?: Array<{ path: string; message: string }>
  upgrade?: boolean
  resource?: string
  current?:  number
  limit?:    number
  plan?:     ClinicPlan
}

export interface PagedResponse<T> {
  items: T[]
  total: number
  page:  number
  limit: number
  pages: number
}

// ── Raw HTTP escape hatch ─────────────────────────────────────────────────────

export interface HttpEscapeHatch {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body?: unknown): Promise<T>
  patch<T>(path: string, body?: unknown): Promise<T>
  del<T>(path: string): Promise<T>
}
