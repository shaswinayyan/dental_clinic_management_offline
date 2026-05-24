/**
 * Full PostgreSQL DDL for the Vorsa SaaS platform.
 * Tables are created with full tenant isolation from the start.
 * This schema is designed for zero-downtime addition of multi-branch
 * and multi-clinic features without structural migrations.
 */
import { pool } from './postgres'

export async function initPgSchema(): Promise<void> {
  await pool.query(`
    -- ── Extensions ────────────────────────────────────────────────────────────
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid()
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- trigram indexes for fast LIKE search

    -- ── Clinics (tenants) ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS clinics (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug         TEXT UNIQUE NOT NULL,
      name         TEXT NOT NULL,
      address      TEXT,
      phone        TEXT,
      email        TEXT UNIQUE NOT NULL,
      logo_url     TEXT,
      plan         TEXT NOT NULL DEFAULT 'starter'
                     CHECK(plan IN ('starter','pro','enterprise')),
      is_active    BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- ── Branches ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS branches (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      address      TEXT,
      phone        TEXT,
      timezone     TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      is_active    BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_branches_clinic ON branches(clinic_id);

    -- ── Branch working hours ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS branch_working_hours (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      day_of_week  SMALLINT NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
      open_time    TIME NOT NULL DEFAULT '09:00',
      close_time   TIME NOT NULL DEFAULT '18:00',
      is_open      BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE(branch_id, day_of_week)
    );

    -- ── Staff ─────────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS staff (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      branch_id       UUID REFERENCES branches(id),
      email           TEXT NOT NULL,
      username        TEXT NOT NULL,
      password_hash   TEXT NOT NULL,
      role            TEXT NOT NULL CHECK(role IN (
                        'clinic_owner','branch_manager','doctor','receptionist'
                      )),
      full_name       TEXT,
      designation     TEXT,
      qualification   TEXT,
      license_no      TEXT,
      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
      last_login_at   TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(clinic_id, email),
      UNIQUE(clinic_id, username)
    );
    CREATE INDEX IF NOT EXISTS idx_staff_clinic   ON staff(clinic_id);
    CREATE INDEX IF NOT EXISTS idx_staff_branch   ON staff(clinic_id, branch_id);

    -- ── Refresh tokens ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id     UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      token_hash   TEXT NOT NULL UNIQUE,
      expires_at   TIMESTAMPTZ NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_staff ON refresh_tokens(staff_id);

    -- ── Appointment system configuration ──────────────────────────────────────
    CREATE TABLE IF NOT EXISTS appt_config (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_id            UUID NOT NULL UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
      booking_mode         TEXT NOT NULL DEFAULT 'slot'
                             CHECK(booking_mode IN ('slot','open','token')),
      default_slot_mins    SMALLINT NOT NULL DEFAULT 30,
      allow_online_booking BOOLEAN NOT NULL DEFAULT FALSE,
      advance_booking_days SMALLINT NOT NULL DEFAULT 60,
      cancellation_hours   SMALLINT NOT NULL DEFAULT 2,
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- ── Custom appointment statuses ───────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS appt_custom_statuses (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      label        TEXT NOT NULL,
      color        TEXT NOT NULL DEFAULT '#6b7280',
      is_terminal  BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order   SMALLINT NOT NULL DEFAULT 0,
      UNIQUE(clinic_id, label)
    );

    -- ── Custom form fields ────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS custom_fields (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      entity       TEXT NOT NULL CHECK(entity IN ('appointment','patient')),
      field_name   TEXT NOT NULL,
      field_type   TEXT NOT NULL CHECK(field_type IN ('text','number','date','select','checkbox')),
      options      JSONB,
      is_required  BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order   SMALLINT NOT NULL DEFAULT 0,
      UNIQUE(clinic_id, entity, field_name)
    );

    -- ── Custom field values ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS custom_field_values (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      custom_field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
      entity_id       UUID NOT NULL,
      value_text      TEXT,
      value_number    NUMERIC,
      value_date      DATE,
      value_json      JSONB,
      UNIQUE(custom_field_id, entity_id)
    );

    -- ── Chairs ────────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS chairs (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      name                TEXT NOT NULL,
      type                TEXT NOT NULL CHECK(type IN ('general','minor')),
      default_slot_mins   SMALLINT NOT NULL DEFAULT 30,
      is_active           BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE(branch_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_chairs_branch ON chairs(branch_id);

    -- ── Treatment catalogue ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS treatments (
      id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id                UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      name                     TEXT NOT NULL,
      category                 TEXT NOT NULL,
      default_duration_minutes SMALLINT NOT NULL DEFAULT 30,
      default_price            NUMERIC(12,2) NOT NULL DEFAULT 0,
      applicable_chairs        JSONB NOT NULL DEFAULT '[]',
      is_active                BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE(clinic_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_treatments_clinic ON treatments(clinic_id);

    -- ── Patients ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS patients (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id             UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      branch_id             UUID NOT NULL REFERENCES branches(id),
      op_id                 TEXT NOT NULL,
      name                  TEXT NOT NULL,
      contact_number        TEXT NOT NULL,
      address               TEXT,
      date_of_birth         DATE,
      gender                TEXT CHECK(gender IN ('Male','Female','Other')),
      blood_group           TEXT,
      emergency_contact     TEXT,
      past_medical_history  TEXT,
      archived_at           TIMESTAMPTZ,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(clinic_id, op_id)
    );
    CREATE INDEX IF NOT EXISTS idx_patients_clinic_branch ON patients(clinic_id, branch_id);
    CREATE INDEX IF NOT EXISTS idx_patients_name_trgm     ON patients USING gin(name gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_patients_contact       ON patients(clinic_id, contact_number);

    -- ── Allergies ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS allergies (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id            UUID NOT NULL REFERENCES clinics(id),
      patient_id           UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      allergen_name        TEXT NOT NULL,
      allergy_type         TEXT NOT NULL CHECK(allergy_type IN ('Drug','Food','Material','Other')),
      severity             TEXT NOT NULL CHECK(severity IN ('Mild','Moderate','Severe')),
      reaction_description TEXT,
      noted_at             DATE DEFAULT CURRENT_DATE
    );
    CREATE INDEX IF NOT EXISTS idx_allergies_patient ON allergies(patient_id);

    -- ── Medications ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS medications (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id       UUID NOT NULL REFERENCES clinics(id),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      medication_name TEXT NOT NULL,
      dosage          TEXT,
      frequency       TEXT,
      duration        TEXT,
      prescribed_by   TEXT,
      prescribed_on   DATE,
      reason          TEXT,
      status          TEXT NOT NULL DEFAULT 'Active'
                        CHECK(status IN ('Active','Completed','Discontinued'))
    );
    CREATE INDEX IF NOT EXISTS idx_medications_patient ON medications(patient_id);

    -- ── Appointments ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS appointments (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id        UUID NOT NULL REFERENCES clinics(id),
      branch_id        UUID NOT NULL REFERENCES branches(id),
      patient_id       UUID NOT NULL REFERENCES patients(id),
      chair_id         UUID NOT NULL REFERENCES chairs(id),
      treatment_id     UUID NOT NULL REFERENCES treatments(id),
      doctor_id        UUID REFERENCES staff(id),
      scheduled_at     TIMESTAMPTZ NOT NULL,
      duration_minutes SMALLINT NOT NULL DEFAULT 30,
      status           TEXT NOT NULL DEFAULT 'scheduled'
                         CHECK(status IN (
                           'scheduled','confirmed','pending',
                           'completed','cancelled','rescheduled'
                         )),
      custom_status    TEXT,
      notes            TEXT,
      confirmed_by     UUID REFERENCES staff(id),
      completed_at     TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_appts_clinic_date   ON appointments(clinic_id, scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_appts_branch_date   ON appointments(branch_id, scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_appts_patient       ON appointments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_appts_chair_date    ON appointments(chair_id, scheduled_at);

    -- ── Dental chart entries ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS dental_chart_entries (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id      UUID NOT NULL REFERENCES clinics(id),
      patient_id     UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      tooth_number   TEXT NOT NULL,
      surface        TEXT NOT NULL CHECK(surface IN ('mesial','distal','buccal','lingual','occlusal','full')),
      procedure_type TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'planned'
                       CHECK(status IN ('planned','completed','ongoing')),
      notes          TEXT,
      done_at        DATE,
      created_by     UUID NOT NULL REFERENCES staff(id),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_chart_patient ON dental_chart_entries(patient_id);

    -- ── Clinical assessments ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS clinical_assessments (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id      UUID NOT NULL REFERENCES clinics(id),
      patient_id     UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      appointment_id UUID REFERENCES appointments(id),
      subjective     TEXT,
      objective      TEXT,
      assessment     TEXT,
      plan           TEXT,
      session_date   DATE NOT NULL DEFAULT CURRENT_DATE,
      created_by     UUID NOT NULL REFERENCES staff(id),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_assessments_patient ON clinical_assessments(patient_id);

    -- ── Treatment records ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS treatment_records (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id      UUID NOT NULL REFERENCES clinics(id),
      branch_id      UUID NOT NULL REFERENCES branches(id),
      patient_id     UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      appointment_id UUID REFERENCES appointments(id),
      treatment_id   UUID NOT NULL REFERENCES treatments(id),
      tooth_area     TEXT,
      chair_id       UUID REFERENCES chairs(id),
      doctor_id      UUID REFERENCES staff(id),
      status         TEXT NOT NULL DEFAULT 'completed'
                       CHECK(status IN ('completed','ongoing','planned')),
      notes          TEXT,
      treated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by     UUID NOT NULL REFERENCES staff(id)
    );
    CREATE INDEX IF NOT EXISTS idx_txrecords_patient ON treatment_records(patient_id);

    -- ── Patient images ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS patient_images (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id       UUID NOT NULL REFERENCES clinics(id),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      treatment_id    UUID REFERENCES treatments(id),
      appointment_id  UUID REFERENCES appointments(id),
      file_path       TEXT NOT NULL,
      thumbnail_path  TEXT,
      image_type      TEXT NOT NULL DEFAULT 'other'
                        CHECK(image_type IN ('xray','intraoral_photo','before','after','other')),
      procedure_tag   TEXT,
      tooth_number    TEXT,
      notes           TEXT,
      capture_date    DATE,
      uploaded_by     UUID NOT NULL REFERENCES staff(id),
      uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_images_patient ON patient_images(patient_id);

    -- ── Prescriptions ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS prescriptions (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id      UUID NOT NULL REFERENCES clinics(id),
      patient_id     UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      appointment_id UUID REFERENCES appointments(id),
      prescribed_by  UUID NOT NULL REFERENCES staff(id),
      diagnosis      TEXT,
      notes          TEXT,
      status         TEXT NOT NULL DEFAULT 'active'
                       CHECK(status IN ('active','dispensed','cancelled')),
      prescribed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS prescription_items (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
      medicine_name   TEXT NOT NULL,
      dosage          TEXT,
      frequency       TEXT,
      duration        TEXT,
      quantity        SMALLINT NOT NULL DEFAULT 1,
      unit_price      NUMERIC(10,2) NOT NULL DEFAULT 0,
      instructions    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);

    -- ── Invoices ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS invoices (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id        UUID NOT NULL REFERENCES clinics(id),
      branch_id        UUID NOT NULL REFERENCES branches(id),
      invoice_number   TEXT NOT NULL,
      patient_id       UUID NOT NULL REFERENCES patients(id),
      appointment_id   UUID REFERENCES appointments(id),
      billing_type     TEXT NOT NULL DEFAULT 'treatment'
                         CHECK(billing_type IN ('treatment','pharmacy')),
      subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
      discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
      discount_reason  TEXT,
      tax_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
      amount_paid      NUMERIC(12,2) NOT NULL DEFAULT 0,
      status           TEXT NOT NULL DEFAULT 'unpaid'
                         CHECK(status IN ('unpaid','partial','paid','voided')),
      void_reason      TEXT,
      created_by       UUID NOT NULL REFERENCES staff(id),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(clinic_id, invoice_number)
    );
    CREATE INDEX IF NOT EXISTS idx_invoices_clinic_date ON invoices(clinic_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_invoices_patient     ON invoices(patient_id);

    CREATE TABLE IF NOT EXISTS invoice_items (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id     UUID NOT NULL REFERENCES clinics(id),
      invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      treatment_id  UUID REFERENCES treatments(id),
      description   TEXT NOT NULL,
      quantity      SMALLINT NOT NULL DEFAULT 1,
      unit_price    NUMERIC(10,2) NOT NULL DEFAULT 0,
      total_price   NUMERIC(10,2) NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_inv_items_invoice ON invoice_items(invoice_id);

    -- ── Payments ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS payments (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id        UUID NOT NULL REFERENCES clinics(id),
      invoice_id       UUID NOT NULL REFERENCES invoices(id),
      amount           NUMERIC(12,2) NOT NULL,
      method           TEXT NOT NULL CHECK(method IN ('cash','upi','card')),
      reference_number TEXT,
      paid_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      recorded_by      UUID NOT NULL REFERENCES staff(id),
      is_verified      BOOLEAN NOT NULL DEFAULT FALSE,
      verified_by      UUID REFERENCES staff(id),
      verified_at      TIMESTAMPTZ,
      notes            TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_payments_clinic_date ON payments(clinic_id, paid_at);

    -- ── Inventory ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS inventory_items (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id           UUID NOT NULL REFERENCES clinics(id),
      branch_id           UUID NOT NULL REFERENCES branches(id),
      item_name           TEXT NOT NULL,
      category            TEXT NOT NULL CHECK(category IN (
                            'consumable','material','instrument','medicine','ppe','equipment'
                          )),
      unit_of_measure     TEXT NOT NULL DEFAULT 'Piece',
      minimum_stock_level NUMERIC(10,3) NOT NULL DEFAULT 0,
      reorder_quantity    NUMERIC(10,3) NOT NULL DEFAULT 0,
      unit_cost           NUMERIC(12,2) NOT NULL DEFAULT 0,
      storage_location    TEXT,
      supplier_name       TEXT,
      notes               TEXT,
      is_active           BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE(clinic_id, branch_id, item_name)
    );
    CREATE INDEX IF NOT EXISTS idx_inv_items_branch ON inventory_items(clinic_id, branch_id);

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id             UUID NOT NULL REFERENCES clinics(id),
      item_id               UUID NOT NULL REFERENCES inventory_items(id),
      branch_id             UUID NOT NULL REFERENCES branches(id),
      transaction_type      TEXT NOT NULL CHECK(transaction_type IN (
                              'stock_in_purchase','stock_in_return',
                              'stock_out_procedure','stock_out_wastage',
                              'stock_out_transfer','adjustment'
                            )),
      quantity              NUMERIC(10,3) NOT NULL,
      unit_cost             NUMERIC(12,2),
      batch_number          TEXT,
      expiry_date           DATE,
      supplier_ref          TEXT,
      linked_appointment_id UUID REFERENCES appointments(id),
      reason_notes          TEXT,
      recorded_by           UUID NOT NULL REFERENCES staff(id),
      transaction_date      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_inv_tx_item   ON inventory_transactions(item_id);
    CREATE INDEX IF NOT EXISTS idx_inv_tx_branch ON inventory_transactions(clinic_id, branch_id, transaction_date);

    -- ── Audit logs ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS audit_logs (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id    UUID NOT NULL REFERENCES clinics(id),
      staff_id     UUID REFERENCES staff(id),
      action       TEXT NOT NULL,
      entity_type  TEXT NOT NULL,
      entity_id    TEXT,
      old_value    JSONB,
      new_value    JSONB,
      ip_address   INET,
      user_agent   TEXT,
      performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_clinic      ON audit_logs(clinic_id, performed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_entity      ON audit_logs(clinic_id, entity_type, entity_id);

    -- ── Clinic settings ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS clinic_settings (
      clinic_id                UUID PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
      tax_rate                 NUMERIC(5,2) NOT NULL DEFAULT 18,
      discount_threshold       NUMERIC(5,2) NOT NULL DEFAULT 20,
      session_timeout_minutes  SMALLINT NOT NULL DEFAULT 30,
      expiry_alert_days        SMALLINT NOT NULL DEFAULT 30,
      invoice_prefix           TEXT NOT NULL DEFAULT 'INV',
      patient_id_prefix        TEXT NOT NULL DEFAULT 'OP',
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  console.log('[DB] PostgreSQL schema initialised')
}

export async function runPgMigrations(): Promise<void> {
  // Migrations are idempotent — safe to run on every startup
  const migrations: Array<{ version: number; sql: string }> = [
    // Add future ALTER TABLE statements here as the schema evolves
    // Example:
    // {
    //   version: 1,
    //   sql: `ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_language TEXT`
    // },
  ]

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  for (const m of migrations) {
    const already = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE version = $1',
      [m.version]
    )
    if (!already.rows.length) {
      await pool.query(m.sql)
      await pool.query(
        'INSERT INTO schema_migrations(version) VALUES($1)',
        [m.version]
      )
      console.log(`[DB] Applied migration v${m.version}`)
    }
  }
}
