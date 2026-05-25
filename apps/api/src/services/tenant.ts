/**
 * Tenant provisioning service — creates a new clinic + owner staff record.
 *
 * Called from POST /api/v2/auth/register after the user has completed
 * Supabase sign-up. Sets up:
 *   1. clinics row (with default 'starter' plan)
 *   2. clinicSettings row (defaults seeded)
 *   3. branches row  (head office branch)
 *   4. branchWorkingHours rows (Mon–Fri open by default)
 *   5. apptConfig row
 *   6. staff row  (clinic_owner role, linked to Clerk userId)
 */
import {
  db,
  clinics,
  clinicSettings,
  branches,
  branchWorkingHours,
  apptConfig,
  staff,
} from '@vorsa/db'
import { RegisterClinicSchema } from '@vorsa/validators'
import { z } from 'zod'

export type RegisterClinicInput = z.infer<typeof RegisterClinicSchema> & {
  supabaseUserId: string
}

export async function registerClinic(input: RegisterClinicInput) {
  const { supabaseUserId, clinic_name, owner_name, owner_email, owner_phone, timezone } = input

  // 1. Create clinic
  const [clinic] = await db.insert(clinics)
    .values({
      name:      clinic_name,
      plan:      'starter',
      is_active: true,
    })
    .returning()

  // 2. Seed clinic settings
  await db.insert(clinicSettings)
    .values({
      clinic_id:       clinic.id,
      tooth_notation:  'fdi',
      currency_code:   'USD',
      currency_symbol: '$',
      tax_label:       'Tax',
      tax_rate:        '0',
      payment_methods: ['cash', 'card', 'bank_transfer'],
      modules_enabled: {
        inventory:   true,
        billing:     true,
        analytics:   false,
        dental_chart: true,
      },
      templates: [],
    })

  // 3. Create head-office branch
  const [branch] = await db.insert(branches)
    .values({
      clinic_id: clinic.id,
      name:      'Main Branch',
      is_active: true,
    })
    .returning()

  // 4. Seed 7-day working hours (Mon–Fri open)
  await db.insert(branchWorkingHours).values(
    Array.from({ length: 7 }, (_, i) => ({
      branch_id:   branch.id,
      day_of_week: i,
      is_open:     i >= 1 && i <= 5,
      open_time:   i >= 1 && i <= 5 ? '09:00' : null,
      close_time:  i >= 1 && i <= 5 ? '18:00' : null,
    }))
  )

  // 5. Seed default appt config
  await db.insert(apptConfig).values({ branch_id: branch.id })

  // 6. Create clinic_owner staff record
  const [owner] = await db.insert(staff)
    .values({
      clinic_id:     clinic.id,
      branch_id:     branch.id,
      user_id:       supabaseUserId,
      name:          owner_name,
      email:         owner_email,
      phone:         owner_phone ?? null,
      role:          'clinic_owner',
      designation:   'Owner',
      is_active:     true,
    })
    .returning()

  return {
    clinic,
    branch,
    owner: {
      id:        owner.id,
      name:      owner.name,
      email:     owner.email,
      role:      owner.role,
      branch_id: owner.branch_id,
    },
  }
}
