// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole = 'doctor' | 'receptionist'

export interface User {
  id: number
  username: string
  role: UserRole
  is_active: number
  created_at: string
  // Doctor / staff profile (stored per-user, populated from users table)
  full_name?: string
  designation?: string
  qualification?: string
  license_no?: string
}

export interface AuthSession {
  user: User
  token: string
}

// ─── Patient ──────────────────────────────────────────────────────────────────

export interface Patient {
  id: number
  op_id: string
  name: string
  contact_number: string
  address?: string
  date_of_birth?: string
  gender?: 'Male' | 'Female' | 'Other'
  blood_group?: string
  emergency_contact?: string
  past_medical_history?: string
  created_at: string
  updated_at: string
  archived_at?: string
}

export interface PatientFormData {
  name: string
  contact_number: string
  address?: string
  date_of_birth?: string
  gender?: 'Male' | 'Female' | 'Other'
  blood_group?: string
  emergency_contact?: string
  past_medical_history?: string
}

// ─── Allergy ──────────────────────────────────────────────────────────────────

export interface Allergy {
  id: number
  patient_id: number
  allergen_name: string
  allergy_type: 'Drug' | 'Food' | 'Material' | 'Other'
  severity: 'Mild' | 'Moderate' | 'Severe'
  reaction_description?: string
  noted_at?: string
}

// ─── Medication ───────────────────────────────────────────────────────────────

export interface Medication {
  id: number
  patient_id: number
  medication_name: string
  dosage?: string
  frequency?: string
  duration?: string
  prescribed_by?: string
  prescribed_on?: string
  reason?: string
  status: 'Active' | 'Completed' | 'Discontinued'
}

// ─── Prescription ─────────────────────────────────────────────────────────────

export interface Prescription {
  id: number
  patient_id: number
  appointment_id?: number
  prescribed_by: number
  prescribed_by_name?: string
  diagnosis?: string
  notes?: string
  status: 'active' | 'dispensed' | 'cancelled'
  prescribed_at: string
  created_at: string
  items?: PrescriptionItem[]
}

export interface PrescriptionItem {
  id: number
  prescription_id: number
  medicine_name: string
  dosage?: string
  frequency?: string
  duration?: string
  quantity: number
  unit_price: number
  instructions?: string
}

// ─── Treatment Catalogue ─────────────────────────────────────────────────────

export type TreatmentCategory = 'Preventive' | 'Restorative' | 'Surgical' | 'Orthodontic' | 'Cosmetic' | 'Periodontal' | 'Endodontic' | 'Prosthodontic' | 'Other'

export interface Treatment {
  id: number
  name: string
  category: TreatmentCategory
  default_duration_minutes: number
  default_price: number
  applicable_chairs: string // JSON array
  is_active: number
}

// ─── Dental Chart ─────────────────────────────────────────────────────────────

export type ToothSurface = 'mesial' | 'distal' | 'buccal' | 'lingual' | 'occlusal' | 'full'
export type ChartEntryStatus = 'planned' | 'completed' | 'ongoing'
export type ProcedureColor = 'blue' | 'red' | 'yellow' | 'green' | 'orange' | 'purple' | 'grey' | 'white'

export interface DentalChartEntry {
  id: number
  patient_id: number
  tooth_number: string
  surface: ToothSurface
  procedure_type: string
  status: ChartEntryStatus
  notes?: string
  done_at?: string
  created_by: number
  created_by_name?: string
  created_at: string
}

// ─── Clinical Assessment ─────────────────────────────────────────────────────

export interface ClinicalAssessment {
  id: number
  patient_id: number
  appointment_id?: number
  subjective?: string
  objective?: string
  assessment?: string
  plan?: string
  session_date: string
  created_by: number
  created_at: string
}

// ─── Patient Images ───────────────────────────────────────────────────────────

export type ImageType = 'xray' | 'intraoral_photo' | 'before' | 'after' | 'other'

export interface PatientImage {
  id: number
  patient_id: number
  treatment_id?: number
  appointment_id?: number
  file_path: string
  thumbnail_path?: string
  image_type: ImageType
  procedure_tag?: string
  tooth_number?: string
  notes?: string
  uploaded_by: number
  uploaded_at: string
  capture_date?: string
  treatment_name?: string
}

// ─── Chair ───────────────────────────────────────────────────────────────────

export interface Chair {
  id: number
  name: string
  type: 'general' | 'minor'
  default_slot_minutes: number
}

// ─── Appointment ─────────────────────────────────────────────────────────────

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'rescheduled'

export interface Appointment {
  id: number
  patient_id: number
  patient_name?: string
  patient_op_id?: string
  patient_contact_number?: string
  chair_id: number
  chair_name?: string
  treatment_id: number
  treatment_name?: string
  scheduled_at: string
  duration_minutes: number
  status: AppointmentStatus
  notes?: string
  confirmed_by?: number
  completed_at?: string
  created_at: string
}

export interface AppointmentFormData {
  patient_id: number
  chair_id: number
  treatment_id: number
  scheduled_at: string
  duration_minutes: number
  notes?: string
}

// ─── Treatment Record ─────────────────────────────────────────────────────────

export interface TreatmentRecord {
  id: number
  patient_id: number
  appointment_id?: number
  treatment_id: number
  treatment_name: string
  tooth_area?: string
  chair_id?: number
  chair_name?: string
  status: 'completed' | 'ongoing' | 'planned'
  notes?: string
  treated_at: string
  doctor_name?: string
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'voided'
export type PaymentMethod = 'cash' | 'upi' | 'card'
export type BillingType = 'treatment' | 'pharmacy'

export interface Invoice {
  id: number
  invoice_number: string
  patient_id: number
  patient_name?: string
  patient_op_id?: string
  appointment_id?: number
  billing_type: BillingType
  subtotal: number
  discount_amount: number
  discount_reason?: string
  tax_amount: number
  total_amount: number
  amount_paid: number
  status: InvoiceStatus
  void_reason?: string
  created_at: string
  created_by: number
}

export interface InvoiceItem {
  id: number
  invoice_id: number
  treatment_id?: number
  description: string
  quantity: number
  unit_price: number
  total_price: number
}

export interface Payment {
  id: number
  invoice_id: number
  amount: number
  method: PaymentMethod
  reference_number?: string
  paid_at: string
  recorded_by: number
  recorded_by_name?: string
  is_verified: number
  verified_by?: number
  verified_by_name?: string
  notes?: string
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export type ItemCategory = 'consumable' | 'material' | 'instrument' | 'medicine' | 'ppe' | 'equipment'
export type TransactionType = 'stock_in_purchase' | 'stock_in_return' | 'stock_out_procedure' | 'stock_out_wastage' | 'stock_out_transfer' | 'adjustment'

export interface InventoryItem {
  id: number
  branch_id: number
  item_name: string
  category: ItemCategory
  unit_of_measure: string
  minimum_stock_level: number
  reorder_quantity: number
  current_stock: number
  unit_cost: number
  storage_location?: string
  supplier_name?: string
  notes?: string
  is_active: number
}

export interface InventoryTransaction {
  id: number
  item_id: number
  item_name?: string
  branch_id: number
  transaction_type: TransactionType
  quantity: number
  unit_cost?: number
  batch_number?: string
  expiry_date?: string
  supplier_ref?: string
  linked_appointment_id?: number
  reason_notes?: string
  recorded_by: number
  recorded_by_name?: string
  transaction_date: string
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  clinic_name: string
  clinic_address: string
  clinic_phone: string
  tax_rate: number
  discount_threshold: number
  session_timeout_minutes: number
  backup_enabled: number
  backup_time: string
  backup_retain_count: number
  backup_path: string
  expiry_alert_days: number
}

// ─── IPC API ─────────────────────────────────────────────────────────────────

export interface IpcResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardStats {
  todayAppointments: number
  confirmedAppointments: number
  pendingAppointments: number
  totalPatients: number
  monthRevenue: number
  outstandingBalance: number
  lowStockCount: number
  expiringItemsCount: number
}

// ─── Cloud / SaaS v2 types ────────────────────────────────────────────────────
// These are used only when the app runs in cloud mode (VITE_APP_MODE=web).
// Offline mode continues to use the original types above.

/** Roles available in the cloud multi-tenant system. */
export type CloudRole = 'clinic_owner' | 'branch_manager' | 'doctor' | 'receptionist'

/** Subscription plan tiers — PRD §8.1. */
export type ClinicPlan = 'starter' | 'business' | 'enterprise'

/** Top-level tenant record. */
export interface Clinic {
  id:         string   // UUID
  name:       string
  slug:       string   // URL-friendly unique identifier
  plan:       ClinicPlan
  is_active:  boolean
  created_at: string
}

/** A physical or virtual branch of a clinic. */
export interface Branch {
  id:         string
  clinic_id:  string
  name:       string
  address?:   string
  phone?:     string
  is_active:  boolean
  created_at: string
}

/** Working hours for a single day in a branch. */
export interface WorkingHours {
  id:           string
  clinic_id:    string
  branch_id:    string
  /** 0 = Sunday … 6 = Saturday */
  day_of_week:  number
  open_time:    string   // HH:MM
  close_time:   string   // HH:MM
  is_open:      boolean
}

/** A staff member belonging to a clinic (and optionally a branch). */
export interface StaffMember {
  id:            string
  clinic_id:     string
  branch_id:     string | null   // null for clinic_owner (cross-branch)
  name:          string
  email:         string
  phone?:        string
  role:          CloudRole
  designation?:  string
  is_active:     boolean
  created_at:    string
  /** Populated by /auth/me from the parent clinic record. */
  plan?:         ClinicPlan
  clinic_name?:  string
}

/** Authenticated session tokens returned by login / refresh. */
export interface CloudAuthSession {
  accessToken:   string
  refreshToken:  string
  /** Access token TTL in seconds — use to schedule silent refresh. */
  expiresIn:     number
  staff:         StaffMember
}

// ── Appointment configuration (per branch) ────────────────────────────────────

/** How the branch accepts appointments. */
export type BookingMode = 'slot' | 'open' | 'token'

/**
 * Per-branch appointment configuration.
 *
 * slot  — Fixed time slots (e.g. 09:00, 09:30, 10:00 …)
 * open  — Walk-in queue; no fixed slot, just a date + doctor
 * token — Token numbers (T-001, T-002 …) issued per day, no specific time
 */
export interface ApptConfig {
  id:                    string
  clinic_id:             string
  branch_id:             string
  booking_mode:          BookingMode
  /** Duration of each slot in minutes (slot mode only). */
  slot_duration_mins:    number
  /** How many days ahead patients can book online. */
  advance_booking_days:  number
  allow_walk_in:         boolean
}

/** A custom appointment status label defined by the clinic. */
export interface ApptCustomStatus {
  id:         string
  clinic_id:  string
  branch_id:  string
  label:      string
  color:      string   // hex color for UI badge
  sort_order: number
  is_default: boolean
}

// ── Custom form fields ────────────────────────────────────────────────────────

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'multiselect'

/** A clinic-defined extra field that can be attached to patients or appointments. */
export interface CustomField {
  id:           string
  clinic_id:    string
  /** Which entity this field belongs to. */
  entity_type:  'patient' | 'appointment'
  label:        string
  field_type:   CustomFieldType
  /** JSON array of options for select/multiselect types. */
  options?:     string[]
  is_required:  boolean
  sort_order:   number
  is_active:    boolean
}

// ── API response envelope ─────────────────────────────────────────────────────

/** Standard success envelope for all v2 REST responses. */
export interface ApiResponse<T = void> {
  success: true
  data:    T
}

/** Standard error envelope for all v2 REST error responses. */
export interface ApiErrorResponse {
  success: false
  error:   string
  /** Field-level validation issues (422 responses only). */
  issues?: Array<{ path: string; message: string }>
}

/** Paginated list response. */
export interface PagedResponse<T> {
  success: true
  data:    T[]
  meta: {
    total:   number
    page:    number
    limit:   number
    pages:   number
  }
}

// ── Raw HTTP escape hatch ─────────────────────────────────────────────────────
// Used by cloud-only pages (Analytics, Global Settings) that call endpoints
// not enumerated in the ApiClient interface.  Throws in desktop mode.

export interface HttpEscapeHatch {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body?: unknown): Promise<T>
  patch<T>(path: string, body?: unknown): Promise<T>
  del<T>(path: string): Promise<T>
}

// ── API client interface ──────────────────────────────────────────────────────

/**
 * Abstraction that both the Electron IPC bridge and the HTTP fetch client
 * must satisfy.  Allows all pages to call the same interface regardless of
 * whether the app is running in desktop (Electron) or web (SaaS) mode.
 */
export interface ApiClient {
  // Auth
  login(email: string, password: string): Promise<CloudAuthSession>
  logout(): Promise<void>
  refreshTokens(): Promise<Pick<CloudAuthSession, 'accessToken' | 'expiresIn'>>
  getMe(): Promise<StaffMember>

  // Clinic
  getClinic(): Promise<Clinic>
  updateClinic(data: Partial<Pick<Clinic, 'name'>>): Promise<Clinic>

  // Branches
  getBranches(): Promise<Branch[]>
  getBranch(id: string): Promise<Branch>
  createBranch(data: Omit<Branch, 'id' | 'clinic_id' | 'created_at'>): Promise<Branch>
  updateBranch(id: string, data: Partial<Omit<Branch, 'id' | 'clinic_id' | 'created_at'>>): Promise<Branch>
  deleteBranch(id: string): Promise<void>

  // Staff
  getStaff(branchId?: string): Promise<StaffMember[]>
  getStaffMember(id: string): Promise<StaffMember>
  createStaff(data: Omit<StaffMember, 'id' | 'clinic_id' | 'created_at'> & { password: string }): Promise<StaffMember>
  updateStaff(id: string, data: Partial<Omit<StaffMember, 'id' | 'clinic_id' | 'created_at'>>): Promise<StaffMember>
  deleteStaff(id: string): Promise<void>

  // Patients
  getPatients(params?: { page?: number; limit?: number; search?: string; branchId?: string }): Promise<PagedResponse<Patient>>
  getPatient(id: string): Promise<Patient>
  createPatient(data: PatientFormData & { branchId: string }): Promise<Patient>
  updatePatient(id: string, data: Partial<PatientFormData>): Promise<Patient>
  archivePatient(id: string): Promise<void>

  // Appointments
  getAppointments(params?: { date?: string; branchId?: string; doctorId?: string; status?: string }): Promise<Appointment[]>
  getAppointment(id: string): Promise<Appointment>
  createAppointment(data: AppointmentFormData): Promise<Appointment>
  updateAppointment(id: string, data: Partial<AppointmentFormData & { status: AppointmentStatus }>): Promise<Appointment>
  deleteAppointment(id: string): Promise<void>

  // Billing
  getInvoices(params?: { page?: number; limit?: number; patientId?: string; status?: string }): Promise<PagedResponse<Invoice>>
  getInvoice(id: string): Promise<Invoice & { items: InvoiceItem[]; payments: Payment[] }>
  createInvoice(data: Omit<Invoice, 'id' | 'invoice_number' | 'created_at' | 'created_by'>  & { items: Omit<InvoiceItem, 'id' | 'invoice_id'>[] }): Promise<Invoice>
  voidInvoice(id: string, reason: string): Promise<Invoice>
  recordPayment(invoiceId: string, data: Omit<Payment, 'id' | 'invoice_id' | 'paid_at' | 'recorded_by'>): Promise<Payment>

  // Inventory
  getInventoryItems(branchId: string): Promise<InventoryItem[]>
  createInventoryItem(data: Omit<InventoryItem, 'id' | 'current_stock'>): Promise<InventoryItem>
  updateInventoryItem(id: string, data: Partial<Omit<InventoryItem, 'id'>>): Promise<InventoryItem>
  recordInventoryTransaction(data: Omit<InventoryTransaction, 'id' | 'transaction_date' | 'recorded_by'>): Promise<InventoryTransaction>

  // Settings
  getApptConfig(branchId: string): Promise<ApptConfig>
  updateApptConfig(branchId: string, data: Partial<Omit<ApptConfig, 'id' | 'clinic_id' | 'branch_id'>>): Promise<ApptConfig>
  getCustomStatuses(branchId: string): Promise<ApptCustomStatus[]>
  upsertCustomStatus(branchId: string, data: Omit<ApptCustomStatus, 'id' | 'clinic_id'>): Promise<ApptCustomStatus>
  deleteCustomStatus(id: string): Promise<void>
  getCustomFields(entityType: 'patient' | 'appointment'): Promise<CustomField[]>
  upsertCustomField(data: Omit<CustomField, 'id' | 'clinic_id'>): Promise<CustomField>
  deleteCustomField(id: string): Promise<void>

  /**
   * Raw HTTP escape hatch for cloud-only endpoints (Analytics, Customisation)
   * not enumerated above.  Always throws in desktop (Electron) mode.
   */
  http: HttpEscapeHatch
}
