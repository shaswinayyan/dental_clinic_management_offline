/**
 * Tenant (clinic) provisioning service.
 *
 * Handles new clinic registration and bootstrap:
 *  - Creates the clinic row
 *  - Creates the clinic_owner staff account
 *  - Seeds one default branch
 *  - Seeds default working hours (Mon–Fri 09:00–17:00)
 *  - Seeds default appointment config (slot-based, 30-min slots)
 *  - Seeds two default chairs
 *  - Seeds default clinic settings
 *
 * All operations run inside a single transaction so the DB is never in a
 * partially-provisioned state.
 */
import { randomUUID } from 'crypto'
import type { PoolClient } from 'pg'
import { withTransaction } from '../db/postgres'
import { hashPassword } from './authService'

// ── Public API ────────────────────────────────────────────────────────────────

export interface RegisterClinicInput {
  /** Full clinic/practice name, e.g. "Bright Smile Dental" */
  clinicName:   string
  /** URL-friendly identifier, unique across all tenants, e.g. "bright-smile" */
  slug:         string
  /** Owner's display name */
  ownerName:    string
  /** Owner's login email */
  ownerEmail:   string
  /** Owner's plain-text password (will be hashed) */
  ownerPassword: string
  /** Owner's phone number (optional) */
  ownerPhone?:  string
  /** Name for the first branch (defaults to clinic name) */
  branchName?:  string
}

export interface RegisterClinicResult {
  clinicId:  string
  branchId:  string
  staffId:   string
}

/**
 * Register a new clinic and bootstrap all default configuration.
 * Throws AppError(409) if the slug is already taken.
 */
export async function registerClinic(
  input: RegisterClinicInput,
): Promise<RegisterClinicResult> {
  const clinicId = randomUUID()
  const branchId = randomUUID()
  const staffId  = randomUUID()

  const passwordHash = await hashPassword(input.ownerPassword)

  await withTransaction(clinicId, async (client) => {
    await createClinic(client, clinicId, input)
    await createOwnerStaff(client, staffId, clinicId, input, passwordHash)
    await createDefaultBranch(client, branchId, clinicId, input)
    await createDefaultWorkingHours(client, branchId, clinicId)
    await createDefaultApptConfig(client, branchId, clinicId)
    await createDefaultChairs(client, branchId, clinicId)
    await createDefaultSettings(client, clinicId)
  })

  return { clinicId, branchId, staffId }
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function createClinic(
  client:   PoolClient,
  clinicId: string,
  input:    RegisterClinicInput,
): Promise<void> {
  await client.query(
    `INSERT INTO clinics (id, name, slug, plan, is_active)
     VALUES ($1, $2, $3, 'starter', true)`,
    [clinicId, input.clinicName.trim(), input.slug.trim().toLowerCase()],
  )
}

async function createOwnerStaff(
  client:        PoolClient,
  staffId:       string,
  clinicId:      string,
  input:         RegisterClinicInput,
  passwordHash:  string,
): Promise<void> {
  await client.query(
    `INSERT INTO staff
       (id, clinic_id, branch_id, name, email, phone, role, password_hash, is_active)
     VALUES ($1, $2, NULL, $3, $4, $5, 'clinic_owner', $6, true)`,
    [staffId, clinicId, input.ownerName.trim(), input.ownerEmail.trim().toLowerCase(),
     input.ownerPhone ?? null, passwordHash],
  )
}

async function createDefaultBranch(
  client:   PoolClient,
  branchId: string,
  clinicId: string,
  input:    RegisterClinicInput,
): Promise<void> {
  const branchName = (input.branchName ?? input.clinicName).trim()
  await client.query(
    `INSERT INTO branches (id, clinic_id, name, is_active)
     VALUES ($1, $2, $3, true)`,
    [branchId, clinicId, branchName],
  )
}

async function createDefaultWorkingHours(
  client:   PoolClient,
  branchId: string,
  clinicId: string,
): Promise<void> {
  // Monday (1) to Friday (5): 09:00 – 17:00
  const workDays = [1, 2, 3, 4, 5]
  for (const day of workDays) {
    await client.query(
      `INSERT INTO branch_working_hours
         (id, clinic_id, branch_id, day_of_week, open_time, close_time, is_open)
       VALUES ($1, $2, $3, $4, '09:00', '17:00', true)`,
      [randomUUID(), clinicId, branchId, day],
    )
  }
  // Saturday (6) and Sunday (0): closed
  for (const day of [0, 6]) {
    await client.query(
      `INSERT INTO branch_working_hours
         (id, clinic_id, branch_id, day_of_week, open_time, close_time, is_open)
       VALUES ($1, $2, $3, $4, '09:00', '17:00', false)`,
      [randomUUID(), clinicId, branchId, day],
    )
  }
}

async function createDefaultApptConfig(
  client:   PoolClient,
  branchId: string,
  clinicId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO appt_config
       (id, clinic_id, branch_id, booking_mode, slot_duration_mins,
        advance_booking_days, allow_walk_in)
     VALUES ($1, $2, $3, 'slot', 30, 30, true)`,
    [randomUUID(), clinicId, branchId],
  )
}

async function createDefaultChairs(
  client:   PoolClient,
  branchId: string,
  clinicId: string,
): Promise<void> {
  for (let i = 1; i <= 2; i++) {
    await client.query(
      `INSERT INTO chairs (id, clinic_id, branch_id, name, is_active)
       VALUES ($1, $2, $3, $4, true)`,
      [randomUUID(), clinicId, branchId, `Chair ${i}`],
    )
  }
}

async function createDefaultSettings(
  client:   PoolClient,
  clinicId: string,
): Promise<void> {
  const defaults = {
    currency:           'USD',
    date_format:        'YYYY-MM-DD',
    invoice_prefix:     'INV',
    op_id_prefix:       'OP',
    op_id_padding:      4,
    invoice_padding:    4,
    timezone:           'UTC',
  }

  for (const [key, value] of Object.entries(defaults)) {
    await client.query(
      `INSERT INTO clinic_settings (id, clinic_id, key, value)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), clinicId, key, String(value)],
    )
  }
}
