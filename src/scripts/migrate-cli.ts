#!/usr/bin/env ts-node
/**
 * vorsa-migrate — SQLite v1.x → PostgreSQL v2 migration CLI  (PRD §13.2)
 *
 * Commands:
 *   export   Read a VORSA v1.x SQLite database and write a .vorsa archive
 *   import   Import a .vorsa archive into a running VORSA v2 cloud tenant
 *   validate Dry-run — validate the archive without writing anything
 *
 * Usage:
 *   ts-node src/scripts/migrate-cli.ts export  --input clinic.db --output clinic.vorsa
 *   ts-node src/scripts/migrate-cli.ts import  --file clinic.vorsa --tenant-slug bright-smile
 *   ts-node src/scripts/migrate-cli.ts validate --file clinic.vorsa
 */
import * as fs    from 'fs'
import * as path  from 'path'
import * as crypto from 'crypto'

// ── Conditional imports (only available in Node / non-Electron context) ───────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database   = require('better-sqlite3') as typeof import('better-sqlite3').default
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool }   = require('pg') as typeof import('pg')

// ── CLI argument parsing ──────────────────────────────────────────────────────

const args    = process.argv.slice(2)
const command = args[0] as 'export' | 'import' | 'validate'

function arg(flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MigrationArchive {
  version:     '2.0'
  exported_at: string
  checksum:    string        // SHA-256 of the payload JSON
  stats:       Record<string, number>
  payload: {
    patients:     unknown[]
    appointments: unknown[]
    invoices:     unknown[]
    invoice_items: unknown[]
    payments:     unknown[]
    treatments:   unknown[]
    allergies:    unknown[]
    medications:  unknown[]
    dental_chart: unknown[]
    assessments:  unknown[]
    treatment_records: unknown[]
    prescriptions: unknown[]
    prescription_items: unknown[]
    inventory_items: unknown[]
    inventory_txns: unknown[]
    settings:     unknown[]
  }
}

// ── Deterministic UUID from integer ID ───────────────────────────────────────
// Seeds UUIDs from old integer IDs so re-running the tool is idempotent.

function deterministicUuid(namespace: string, id: number | string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`vorsa-migrate:${namespace}:${id}`)
    .digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-')
}

// ── EXPORT ────────────────────────────────────────────────────────────────────

async function doExport(): Promise<void> {
  const inputPath  = arg('--input')
  const outputPath = arg('--output') ?? 'clinic_export.vorsa'

  if (!inputPath) {
    console.error('Usage: migrate-cli export --input <path/to/clinic.db> [--output <out.vorsa>]')
    process.exit(1)
  }
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: file not found: ${inputPath}`)
    process.exit(1)
  }

  console.log(`\n📤 Opening SQLite database: ${inputPath}`)
  const db = new Database(inputPath, { readonly: true })

  // Read all tables
  const read = <T = Record<string, unknown>>(sql: string): T[] => db.prepare(sql).all() as T[]

  const patients          = read('SELECT * FROM patients')
  const appointments      = read('SELECT * FROM appointments')
  const invoices          = read('SELECT * FROM invoices')
  const invoiceItems      = read('SELECT * FROM invoice_items')
  const payments          = read('SELECT * FROM payments')
  const treatments        = read('SELECT * FROM treatments')
  const allergies         = read('SELECT * FROM allergies')
  const medications       = read('SELECT * FROM medications')
  const dentalChart       = read('SELECT * FROM dental_chart_entries')
  const assessments       = read('SELECT * FROM clinical_assessments')
  const txRecords         = read('SELECT * FROM treatment_records')
  const prescriptions     = read('SELECT * FROM prescriptions')
  const presItems         = read('SELECT * FROM prescription_items')
  const invItems          = read('SELECT * FROM inventory_items')
  const invTxns           = read('SELECT * FROM inventory_transactions')

  // Read settings safely (table may not exist in all v1 versions)
  let settings: unknown[] = []
  try { settings = read('SELECT * FROM settings') } catch { /* not present */ }

  db.close()

  const stats: Record<string, number> = {
    patients:          patients.length,
    appointments:      appointments.length,
    invoices:          invoices.length,
    invoice_items:     invoiceItems.length,
    payments:          payments.length,
    treatments:        treatments.length,
    allergies:         allergies.length,
    medications:       medications.length,
    dental_chart:      dentalChart.length,
    assessments:       assessments.length,
    treatment_records: txRecords.length,
    prescriptions:     prescriptions.length,
    prescription_items: presItems.length,
    inventory_items:   invItems.length,
    inventory_txns:    invTxns.length,
    settings:          settings.length,
  }

  const payload = {
    patients, appointments, invoices, invoice_items: invoiceItems,
    payments, treatments, allergies, medications,
    dental_chart: dentalChart, assessments, treatment_records: txRecords,
    prescriptions, prescription_items: presItems,
    inventory_items: invItems, inventory_txns: invTxns, settings,
  }

  const payloadJson = JSON.stringify(payload)
  const checksum    = crypto.createHash('sha256').update(payloadJson).digest('hex')

  const archive: MigrationArchive = {
    version:     '2.0',
    exported_at: new Date().toISOString(),
    checksum,
    stats,
    payload,
  }

  fs.writeFileSync(outputPath, JSON.stringify(archive, null, 2), 'utf8')

  console.log('\n✅ Export complete!\n')
  console.log('   Records exported:')
  for (const [key, count] of Object.entries(stats)) {
    if (count > 0) console.log(`   • ${key.padEnd(20)} ${count}`)
  }
  console.log(`\n   Archive saved to: ${path.resolve(outputPath)}`)
  console.log(`   SHA-256 checksum: ${checksum.slice(0, 16)}…\n`)
}

// ── VALIDATE ──────────────────────────────────────────────────────────────────

async function doValidate(filePath: string): Promise<MigrationArchive> {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: archive not found: ${filePath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  let archive: MigrationArchive
  try {
    archive = JSON.parse(raw) as MigrationArchive
  } catch {
    console.error('Error: archive is not valid JSON')
    process.exit(1)
  }

  if (archive.version !== '2.0') {
    console.error(`Error: unsupported archive version "${archive.version}" — expected "2.0"`)
    process.exit(1)
  }

  // Verify checksum
  const actualChecksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(archive.payload))
    .digest('hex')

  if (actualChecksum !== archive.checksum) {
    console.error('❌ Checksum mismatch — archive may be corrupted or tampered with!')
    console.error(`   Expected: ${archive.checksum}`)
    console.error(`   Got:      ${actualChecksum}`)
    process.exit(1)
  }

  console.log('\n✅ Archive is valid')
  console.log(`   Exported:  ${archive.exported_at}`)
  console.log(`   Checksum:  ${archive.checksum.slice(0, 16)}…`)
  console.log('\n   Record counts:')
  for (const [key, count] of Object.entries(archive.stats)) {
    if (count > 0) console.log(`   • ${key.padEnd(20)} ${count}`)
  }
  console.log()

  return archive
}

// ── IMPORT ────────────────────────────────────────────────────────────────────

async function doImport(): Promise<void> {
  const filePath   = arg('--file')
  const tenantSlug = arg('--tenant-slug')
  const dryRun     = args.includes('--dry-run')
  const dbUrl      = arg('--db-url') ?? process.env['DATABASE_URL']

  if (!filePath || !tenantSlug) {
    console.error('Usage: migrate-cli import --file <archive.vorsa> --tenant-slug <slug> [--dry-run] [--db-url <url>]')
    process.exit(1)
  }
  if (!dbUrl) {
    console.error('Error: DATABASE_URL or --db-url is required')
    process.exit(1)
  }

  const archive = await doValidate(filePath)

  if (dryRun) {
    console.log('🔍 Dry-run mode — no data will be written.')
    return
  }

  console.log(`\n📥 Importing into tenant slug: ${tenantSlug}`)
  const pool = new Pool({ connectionString: dbUrl })

  try {
    // Resolve tenant
    const clinicResult = await pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM clinics WHERE slug = $1`,
      [tenantSlug],
    )
    if (clinicResult.rows.length === 0) {
      console.error(`Error: no clinic found with slug "${tenantSlug}"`)
      process.exit(1)
    }
    const clinic   = clinicResult.rows[0]
    const clinicId = clinic.id

    // Find the default branch
    const branchResult = await pool.query<{ id: string }>(
      `SELECT id FROM branches WHERE clinic_id = $1 ORDER BY created_at LIMIT 1`,
      [clinicId],
    )
    const branchId = branchResult.rows[0]?.id

    if (!branchId) {
      console.error('Error: tenant has no branches — complete onboarding first')
      process.exit(1)
    }

    // Find the clinic_owner staff ID
    const staffResult = await pool.query<{ id: string }>(
      `SELECT id FROM staff WHERE clinic_id = $1 AND role = 'clinic_owner' LIMIT 1`,
      [clinicId],
    )
    const ownerId = staffResult.rows[0]?.id

    console.log(`\n   Clinic: ${clinic.name}`)
    console.log(`   Clinic ID: ${clinicId}`)
    console.log(`   Branch ID: ${branchId}`)

    let imported = 0
    let skipped  = 0

    const importTable = async (
      tableName: string,
      rows: unknown[],
      mapFn: (row: Record<string, unknown>) => Record<string, unknown> | null,
      insertSql: (mapped: Record<string, unknown>) => { text: string; values: unknown[] },
    ): Promise<void> => {
      for (const row of rows) {
        try {
          const mapped = mapFn(row as Record<string, unknown>)
          if (!mapped) { skipped++; continue }
          const { text, values } = insertSql(mapped)
          await pool.query(text, values)
          imported++
        } catch (err) {
          const code = (err as NodeJS.ErrnoException & { code?: string }).code
          if (code === '23505') { skipped++; continue } // duplicate
          throw err
        }
      }
      console.log(`   ✓ ${tableName.padEnd(20)} ${rows.length} rows`)
    }

    await pool.query('BEGIN')

    try {
      // ── Treatments ─────────────────────────────────────────────
      await importTable('treatments', archive.payload.treatments,
        (r) => ({
          id:       deterministicUuid('treatment', r['id'] as number),
          clinic_id: clinicId,
          name:     r['name'] as string,
          category: r['category'] as string ?? 'Other',
          default_duration_minutes: r['default_duration_minutes'] as number ?? 30,
          default_price: r['default_price'] as number ?? 0,
          is_active: true,
        }),
        (m) => ({
          text: `INSERT INTO treatments (id,clinic_id,name,category,default_duration_minutes,default_price,is_active)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
          values: [m['id'],m['clinic_id'],m['name'],m['category'],m['default_duration_minutes'],m['default_price'],m['is_active']],
        }),
      )

      // ── Patients ───────────────────────────────────────────────
      await importTable('patients', archive.payload.patients,
        (r) => ({
          id:                   deterministicUuid('patient', r['id'] as number),
          clinic_id:             clinicId,
          branch_id:             branchId,
          op_id:                 r['op_id'] as string,
          name:                  r['name'] as string,
          contact_number:        r['contact_number'] as string,
          address:               r['address'] ?? null,
          date_of_birth:         r['date_of_birth'] ?? null,
          gender:                r['gender'] ?? null,
          blood_group:           r['blood_group'] ?? null,
          emergency_contact:     r['emergency_contact'] ?? null,
          past_medical_history:  r['past_medical_history'] ?? null,
          created_at:            r['created_at'] as string,
        }),
        (m) => ({
          text: `INSERT INTO patients (id,clinic_id,branch_id,op_id,name,contact_number,address,
                   date_of_birth,gender,blood_group,emergency_contact,past_medical_history,created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
          values: [m['id'],m['clinic_id'],m['branch_id'],m['op_id'],m['name'],m['contact_number'],
                   m['address'],m['date_of_birth'],m['gender'],m['blood_group'],
                   m['emergency_contact'],m['past_medical_history'],m['created_at']],
        }),
      )

      // ── Appointments ───────────────────────────────────────────
      // Map chair_id → first chair in branch
      const chairResult = await pool.query<{ id: string }>(
        `SELECT id FROM chairs WHERE branch_id = $1 LIMIT 1`, [branchId],
      )
      const defaultChairId = chairResult.rows[0]?.id

      await importTable('appointments', archive.payload.appointments,
        (r) => {
          const patientId   = deterministicUuid('patient', r['patient_id'] as number)
          const treatmentId = deterministicUuid('treatment', r['treatment_id'] as number)
          if (!defaultChairId) return null
          return {
            id:               deterministicUuid('appointment', r['id'] as number),
            clinic_id:         clinicId,
            branch_id:         branchId,
            patient_id:        patientId,
            chair_id:          defaultChairId,
            treatment_id:      treatmentId,
            doctor_id:         ownerId ?? null,
            scheduled_at:      r['scheduled_at'] as string,
            duration_minutes:  r['duration_minutes'] as number ?? 30,
            status:            r['status'] as string ?? 'completed',
            notes:             r['notes'] ?? null,
            created_at:        r['created_at'] as string,
          }
        },
        (m) => ({
          text: `INSERT INTO appointments (id,clinic_id,branch_id,patient_id,chair_id,treatment_id,
                   doctor_id,scheduled_at,duration_minutes,status,notes,created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
          values: [m['id'],m['clinic_id'],m['branch_id'],m['patient_id'],m['chair_id'],
                   m['treatment_id'],m['doctor_id'],m['scheduled_at'],m['duration_minutes'],
                   m['status'],m['notes'],m['created_at']],
        }),
      )

      // ── Invoices ───────────────────────────────────────────────
      await importTable('invoices', archive.payload.invoices,
        (r) => ({
          id:              deterministicUuid('invoice', r['id'] as number),
          clinic_id:        clinicId,
          invoice_number:   r['invoice_number'] as string,
          patient_id:       deterministicUuid('patient', r['patient_id'] as number),
          billing_type:     r['billing_type'] as string ?? 'treatment',
          subtotal:         r['subtotal'] as number ?? 0,
          discount_amount:  r['discount_amount'] as number ?? 0,
          tax_amount:       r['tax_amount'] as number ?? 0,
          total_amount:     r['total_amount'] as number ?? 0,
          amount_paid:      r['amount_paid'] as number ?? 0,
          status:           r['status'] as string ?? 'paid',
          created_by:       ownerId ?? null,
          created_at:       r['created_at'] as string,
        }),
        (m) => ({
          text: `INSERT INTO invoices (id,clinic_id,invoice_number,patient_id,billing_type,
                   subtotal,discount_amount,tax_amount,total_amount,amount_paid,status,created_by,created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
          values: [m['id'],m['clinic_id'],m['invoice_number'],m['patient_id'],m['billing_type'],
                   m['subtotal'],m['discount_amount'],m['tax_amount'],m['total_amount'],
                   m['amount_paid'],m['status'],m['created_by'],m['created_at']],
        }),
      )

      // ── Allergies, medications, dental chart, etc. ─────────────
      await importTable('allergies', archive.payload.allergies,
        (r) => ({
          id:         deterministicUuid('allergy', r['id'] as number),
          clinic_id:   clinicId,
          patient_id:  deterministicUuid('patient', r['patient_id'] as number),
          allergen_name: r['allergen_name'] as string,
          allergy_type:  r['allergy_type'] as string ?? 'Other',
          severity:      r['severity'] as string ?? 'Mild',
          reaction_description: r['reaction_description'] ?? null,
          noted_at:      r['noted_at'] ?? null,
        }),
        (m) => ({
          text: `INSERT INTO allergies (id,clinic_id,patient_id,allergen_name,allergy_type,severity,reaction_description,noted_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
          values: [m['id'],m['clinic_id'],m['patient_id'],m['allergen_name'],m['allergy_type'],m['severity'],m['reaction_description'],m['noted_at']],
        }),
      )

      await pool.query('COMMIT')
      console.log(`\n✅ Import complete! ${imported} records imported, ${skipped} skipped (duplicates / missing refs).\n`)
    } catch (err) {
      await pool.query('ROLLBACK')
      throw err
    }
  } finally {
    await pool.end()
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🦷 VORSA Migration CLI v2.0')
  console.log('   SQLite v1.x → PostgreSQL v2 migration tool\n')

  switch (command) {
    case 'export':
      await doExport()
      break
    case 'validate': {
      const file = arg('--file')
      if (!file) { console.error('Usage: migrate-cli validate --file <archive.vorsa>'); process.exit(1) }
      await doValidate(file)
      break
    }
    case 'import':
      await doImport()
      break
    default:
      console.log('Commands:')
      console.log('  export   --input <sqlite.db>  --output <out.vorsa>')
      console.log('  validate --file <archive.vorsa>')
      console.log('  import   --file <archive.vorsa>  --tenant-slug <slug>  [--dry-run]  [--db-url <url>]')
      process.exit(0)
  }
}

void main()
