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
