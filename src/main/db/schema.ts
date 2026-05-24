import type Database from 'better-sqlite3'

export function initializeSchema(db: Database.Database): void {
  db.exec(`PRAGMA journal_mode = WAL;`)
  db.exec(`PRAGMA foreign_keys = ON;`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('doctor','receptionist')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS chairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('general','minor')),
      default_slot_minutes INTEGER NOT NULL DEFAULT 30
    );

    CREATE TABLE IF NOT EXISTS treatments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      default_duration_minutes INTEGER NOT NULL DEFAULT 30,
      default_price REAL NOT NULL DEFAULT 0,
      applicable_chairs TEXT NOT NULL DEFAULT '[1,2,3]',
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      op_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      address TEXT,
      date_of_birth TEXT,
      gender TEXT CHECK(gender IN ('Male','Female','Other')),
      blood_group TEXT,
      emergency_contact TEXT,
      past_medical_history TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS allergies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      allergen_name TEXT NOT NULL,
      allergy_type TEXT NOT NULL CHECK(allergy_type IN ('Drug','Food','Material','Other')),
      severity TEXT NOT NULL CHECK(severity IN ('Mild','Moderate','Severe')),
      reaction_description TEXT,
      noted_at TEXT DEFAULT (date('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      medication_name TEXT NOT NULL,
      dosage TEXT,
      frequency TEXT,
      duration TEXT,
      prescribed_by TEXT,
      prescribed_on TEXT,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Completed','Discontinued'))
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      chair_id INTEGER NOT NULL REFERENCES chairs(id),
      treatment_id INTEGER NOT NULL REFERENCES treatments(id),
      scheduled_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK(status IN ('scheduled','confirmed','pending','completed','cancelled','rescheduled')),
      notes TEXT,
      confirmed_by INTEGER REFERENCES users(id),
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS dental_chart_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      tooth_number TEXT NOT NULL,
      surface TEXT NOT NULL CHECK(surface IN ('mesial','distal','buccal','lingual','occlusal','full')),
      procedure_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','completed','ongoing')),
      notes TEXT,
      done_at TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS clinical_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      appointment_id INTEGER REFERENCES appointments(id),
      subjective TEXT,
      objective TEXT,
      assessment TEXT,
      plan TEXT,
      session_date TEXT NOT NULL DEFAULT (date('now','localtime')),
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS treatment_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      appointment_id INTEGER REFERENCES appointments(id),
      treatment_id INTEGER NOT NULL REFERENCES treatments(id),
      tooth_area TEXT,
      chair_id INTEGER REFERENCES chairs(id),
      status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','ongoing','planned')),
      notes TEXT,
      treated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      created_by INTEGER NOT NULL REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS patient_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      treatment_id INTEGER REFERENCES treatments(id),
      appointment_id INTEGER REFERENCES appointments(id),
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      image_type TEXT NOT NULL DEFAULT 'other'
        CHECK(image_type IN ('xray','intraoral_photo','before','after','other')),
      procedure_tag TEXT,
      tooth_number TEXT,
      notes TEXT,
      capture_date TEXT,
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      appointment_id INTEGER REFERENCES appointments(id),
      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      discount_reason TEXT,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK(status IN ('unpaid','partial','paid','voided')),
      void_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      created_by INTEGER NOT NULL REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id),
      treatment_id INTEGER REFERENCES treatments(id),
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      total_price REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id),
      amount REAL NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('cash','upi','card')),
      reference_number TEXT,
      paid_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      recorded_by INTEGER NOT NULL REFERENCES users(id),
      is_verified INTEGER NOT NULL DEFAULT 0,
      verified_by INTEGER REFERENCES users(id),
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER NOT NULL DEFAULT 1,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL
        CHECK(category IN ('consumable','material','instrument','medicine','ppe','equipment')),
      unit_of_measure TEXT NOT NULL DEFAULT 'Piece',
      minimum_stock_level INTEGER NOT NULL DEFAULT 0,
      reorder_quantity INTEGER NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0,
      storage_location TEXT,
      supplier_name TEXT,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES inventory_items(id),
      branch_id INTEGER NOT NULL DEFAULT 1,
      transaction_type TEXT NOT NULL
        CHECK(transaction_type IN (
          'stock_in_purchase','stock_in_return',
          'stock_out_procedure','stock_out_wastage','stock_out_transfer','adjustment'
        )),
      quantity REAL NOT NULL,
      unit_cost REAL,
      batch_number TEXT,
      expiry_date TEXT,
      supplier_ref TEXT,
      linked_appointment_id INTEGER REFERENCES appointments(id),
      reason_notes TEXT,
      recorded_by INTEGER NOT NULL REFERENCES users(id),
      transaction_date TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      old_value TEXT,
      new_value TEXT,
      performed_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      appointment_id INTEGER REFERENCES appointments(id),
      prescribed_by INTEGER NOT NULL REFERENCES users(id),
      diagnosis TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','dispensed','cancelled')),
      prescribed_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS prescription_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
      medicine_name TEXT NOT NULL,
      dosage TEXT,
      frequency TEXT,
      duration TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      instructions TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);

    CREATE INDEX IF NOT EXISTS idx_patients_op_id ON patients(op_id);
    CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
    CREATE INDEX IF NOT EXISTS idx_patients_contact ON patients(contact_number);
    CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_chair ON appointments(chair_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
    CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_tx_item ON inventory_transactions(item_id);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
  `)
}

// ── Run migrations for columns added after initial release ────────────────────
export function runMigrations(db: Database.Database): void {
  // Add billing_type to invoices (pharmacy vs treatment)
  try { db.prepare(`ALTER TABLE invoices ADD COLUMN billing_type TEXT NOT NULL DEFAULT 'treatment'`).run() } catch { /* already exists */ }
}

export function seedDefaults(db: Database.Database): void {
  const branchCount = (db.prepare('SELECT COUNT(*) as c FROM branches').get() as { c: number }).c
  if (branchCount === 0) {
    db.prepare(`INSERT INTO branches(name, address) VALUES ('Main Clinic', 'Main Location')`).run()
  }

  const chairCount = (db.prepare('SELECT COUNT(*) as c FROM chairs').get() as { c: number }).c
  if (chairCount === 0) {
    db.prepare(`INSERT INTO chairs(name,type,default_slot_minutes) VALUES
      ('Chair 1 (OP1)','general',60),
      ('Chair 2 (OP2)','minor',30),
      ('Chair 3 (OP3)','minor',15)`).run()
  }

  const treatmentCount = (db.prepare('SELECT COUNT(*) as c FROM treatments').get() as { c: number }).c
  if (treatmentCount === 0) {
    const treatments = [
      ['Scaling & Polishing', 'Preventive', 45, 800, '[1,2,3]'],
      ['Dental Examination', 'Preventive', 15, 300, '[1,2,3]'],
      ['Composite Filling', 'Restorative', 60, 1500, '[1,2,3]'],
      ['Glass Ionomer Filling', 'Restorative', 45, 1000, '[1,2,3]'],
      ['Root Canal Treatment', 'Endodontic', 90, 5000, '[1]'],
      ['Tooth Extraction (Simple)', 'Surgical', 30, 1000, '[1,2]'],
      ['Tooth Extraction (Surgical)', 'Surgical', 60, 2500, '[1]'],
      ['Crown (PFM)', 'Prosthodontic', 60, 8000, '[1]'],
      ['Crown (Zirconia)', 'Prosthodontic', 60, 12000, '[1]'],
      ['Dental Implant', 'Prosthodontic', 120, 35000, '[1]'],
      ['Orthodontic Consultation', 'Orthodontic', 30, 500, '[1,2]'],
      ['X-Ray (Periapical)', 'Preventive', 15, 300, '[1,2,3]'],
      ['X-Ray (OPG)', 'Preventive', 15, 600, '[1,2,3]'],
      ['Denture (Complete)', 'Prosthodontic', 60, 15000, '[1]'],
      ['Teeth Whitening', 'Cosmetic', 60, 8000, '[1]']
    ]
    const stmt = db.prepare(`INSERT INTO treatments(name,category,default_duration_minutes,default_price,applicable_chairs)
      VALUES (?,?,?,?,?)`)
    treatments.forEach(t => stmt.run(...t))
  }

  const settingCount = (db.prepare('SELECT COUNT(*) as c FROM app_settings').get() as { c: number }).c
  if (settingCount === 0) {
    const defaults: [string, string][] = [
      ['clinic_name', 'My Dental Clinic'],
      ['clinic_address', ''],
      ['clinic_phone', ''],
      ['tax_rate', '18'],
      ['discount_threshold', '20'],
      ['session_timeout_minutes', '30'],
      ['backup_enabled', '0'],
      ['backup_time', '23:00'],
      ['backup_retain_count', '7'],
      ['backup_path', ''],
      ['expiry_alert_days', '30']
    ]
    const stmt = db.prepare('INSERT OR IGNORE INTO app_settings(key,value) VALUES (?,?)')
    defaults.forEach(([k, v]) => stmt.run(k, v))
  }
}
