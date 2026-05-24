/**
 * Global Customisation Engine routes — /api/v2/customisation  (PRD §6)
 *
 * GET/PATCH  /notation          — Tooth notation system (FDI | Universal | Palmer)
 * GET/PATCH  /currency          — Currency, tax label, tax bands, invoice format
 * GET/PATCH  /payment-methods   — Which payment methods are enabled
 * GET/PATCH  /modules           — Module enablement flags
 * GET        /templates         — List available regional procedure templates
 * POST       /templates/apply   — Apply a regional template to the treatment catalogue
 */
import { Router }     from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, withTransaction } from '../db/postgres'
import { authenticate }     from '../middleware/auth'
import { requireRole }      from '../middleware/rbac'
import { validate }         from '../middleware/validate'
import { AppError }         from '../middleware/errorHandler'
import { z }                from 'zod'

const router = Router()
router.use(authenticate)

// ── Zod schemas ───────────────────────────────────────────────────────────────

const NotationSchema = z.object({
  notation: z.enum(['FDI', 'Universal', 'Palmer']),
})

const CurrencySchema = z.object({
  currency:            z.string().length(3).toUpperCase(),       // ISO 4217
  secondary_currency:  z.string().length(3).optional(),
  tax_label:           z.string().max(20).default('Tax'),        // GST, VAT, etc.
  tax_rate:            z.number().min(0).max(100).default(0),
  tax_inclusive:       z.boolean().default(false),
  invoice_prefix:      z.string().max(10).default('INV'),
  invoice_padding:     z.number().int().min(1).max(10).default(4),
  invoice_year_in_num: z.boolean().default(false),               // INV-2025-0001
  invoice_footer:      z.string().max(500).optional(),
})

const PaymentMethodsSchema = z.object({
  methods: z.array(z.object({
    key:     z.string().max(30),
    label:   z.string().max(50),
    enabled: z.boolean(),
  })).min(1),
})

const ModulesSchema = z.object({
  inventory:      z.boolean().optional(),
  analytics:      z.boolean().optional(),
  patient_portal: z.boolean().optional(),
  custom_fields:  z.boolean().optional(),
  api_access:     z.boolean().optional(),
})

// ── Helper: read / write clinic settings as a keyed object ───────────────────

async function getSettings(clinicId: string, prefix: string): Promise<Record<string, string>> {
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM clinic_settings WHERE clinic_id = $1 AND key LIKE $2`,
    [clinicId, `${prefix}%`],
  )
  const result: Record<string, string> = {}
  for (const r of rows) result[r.key.replace(`${prefix}`, '')] = r.value
  return result
}

async function upsertSettings(
  clinicId: string,
  prefix:   string,
  data:     Record<string, string>,
): Promise<void> {
  await withTransaction(clinicId, async (client) => {
    for (const [key, value] of Object.entries(data)) {
      await client.query(
        `INSERT INTO clinic_settings (id, clinic_id, key, value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (clinic_id, key) DO UPDATE SET value = EXCLUDED.value`,
        [randomUUID(), clinicId, `${prefix}${key}`, value],
      )
    }
  })
}

// ── Tooth notation (PRD §6.1) ─────────────────────────────────────────────────

router.get('/notation', async (req, res, next) => {
  try {
    const row = await queryOne<{ value: string }>(
      `SELECT value FROM clinic_settings WHERE clinic_id = $1 AND key = 'tooth_notation'`,
      [req.clinicId],
    )
    res.json({
      success: true,
      data: {
        notation:  row?.value ?? 'FDI',
        options: [
          { value: 'FDI',       label: 'FDI (ISO 3950)',         example: 'Tooth 46',  used_in: 'International, Europe, Asia, Middle East' },
          { value: 'Universal', label: 'Universal Numbering',     example: 'Tooth 30',  used_in: 'United States, Canada' },
          { value: 'Palmer',    label: 'Palmer Notation',         example: 'LR6',       used_in: 'UK, Commonwealth countries' },
        ],
      },
    })
  } catch (err) { next(err) }
})

router.patch('/notation', requireRole('clinic_owner'), validate(NotationSchema), async (req, res, next) => {
  try {
    const { notation } = req.body as { notation: string }
    await upsertSettings(req.clinicId, '', { tooth_notation: notation })
    res.json({ success: true, data: { notation } })
  } catch (err) { next(err) }
})

// ── Currency & tax config (PRD §6.2) ─────────────────────────────────────────

router.get('/currency', async (req, res, next) => {
  try {
    const s = await getSettings(req.clinicId, 'billing_')
    res.json({
      success: true,
      data: {
        currency:            s['currency']            ?? 'USD',
        secondary_currency:  s['secondary_currency']  ?? null,
        tax_label:           s['tax_label']           ?? 'Tax',
        tax_rate:            parseFloat(s['tax_rate'] ?? '0'),
        tax_inclusive:       s['tax_inclusive']       === 'true',
        invoice_prefix:      s['invoice_prefix']      ?? 'INV',
        invoice_padding:     parseInt(s['invoice_padding'] ?? '4', 10),
        invoice_year_in_num: s['invoice_year_in_num'] === 'true',
        invoice_footer:      s['invoice_footer']      ?? null,
      },
    })
  } catch (err) { next(err) }
})

router.patch('/currency', requireRole('clinic_owner'), validate(CurrencySchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof CurrencySchema>
    await upsertSettings(req.clinicId, 'billing_', {
      currency:            body.currency,
      secondary_currency:  body.secondary_currency ?? '',
      tax_label:           body.tax_label,
      tax_rate:            String(body.tax_rate),
      tax_inclusive:       String(body.tax_inclusive),
      invoice_prefix:      body.invoice_prefix,
      invoice_padding:     String(body.invoice_padding),
      invoice_year_in_num: String(body.invoice_year_in_num),
      invoice_footer:      body.invoice_footer ?? '',
    })
    res.json({ success: true, data: body })
  } catch (err) { next(err) }
})

// ── Payment methods (PRD §6.2) ────────────────────────────────────────────────

/** Default payment methods seeded for every clinic */
const DEFAULT_PAYMENT_METHODS = [
  { key: 'cash',          label: 'Cash',           enabled: true  },
  { key: 'card',          label: 'Card',           enabled: true  },
  { key: 'upi',           label: 'UPI',            enabled: false },
  { key: 'bank_transfer', label: 'Bank Transfer',  enabled: false },
  { key: 'nets',          label: 'NETS',           enabled: false },
  { key: 'stc_pay',       label: 'STC Pay / Mada', enabled: false },
  { key: 'apple_pay',     label: 'Apple Pay',      enabled: false },
  { key: 'google_pay',    label: 'Google Pay',     enabled: false },
  { key: 'insurance',     label: 'Insurance',      enabled: false },
]

router.get('/payment-methods', async (req, res, next) => {
  try {
    const row = await queryOne<{ value: string }>(
      `SELECT value FROM clinic_settings WHERE clinic_id = $1 AND key = 'payment_methods'`,
      [req.clinicId],
    )
    const methods = row
      ? (JSON.parse(row.value) as typeof DEFAULT_PAYMENT_METHODS)
      : DEFAULT_PAYMENT_METHODS
    res.json({ success: true, data: methods })
  } catch (err) { next(err) }
})

router.patch('/payment-methods', requireRole('clinic_owner'), validate(PaymentMethodsSchema), async (req, res, next) => {
  try {
    const { methods } = req.body as z.infer<typeof PaymentMethodsSchema>
    await upsertSettings(req.clinicId, '', {
      payment_methods: JSON.stringify(methods),
    })
    res.json({ success: true, data: methods })
  } catch (err) { next(err) }
})

// ── Module enablement (PRD §6.5) ─────────────────────────────────────────────

const MODULE_DEFAULTS: Record<string, boolean> = {
  inventory:      true,
  analytics:      false,
  patient_portal: false,
  custom_fields:  false,
  api_access:     false,
}

router.get('/modules', async (req, res, next) => {
  try {
    const s = await getSettings(req.clinicId, 'module_')
    const modules: Record<string, boolean> = {}
    for (const [key, def] of Object.entries(MODULE_DEFAULTS)) {
      modules[key] = s[key] !== undefined ? s[key] === 'true' : def
    }
    res.json({ success: true, data: modules })
  } catch (err) { next(err) }
})

router.patch('/modules', requireRole('clinic_owner'), validate(ModulesSchema), async (req, res, next) => {
  try {
    const updates = req.body as z.infer<typeof ModulesSchema>
    const toSave: Record<string, string> = {}
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) toSave[key] = String(val)
    }
    await upsertSettings(req.clinicId, 'module_', toSave)
    res.json({ success: true, data: updates })
  } catch (err) { next(err) }
})

// ── Regional procedure templates (PRD §6.1) ───────────────────────────────────

const PROCEDURE_TEMPLATES: Array<{
  id: string; region: string; description: string
  procedures: Array<{ name: string; category: string; price: number; duration: number }>
}> = [
  {
    id: 'india', region: 'India', description: 'BDS procedure codes, INR pricing tiers, GST-ready',
    procedures: [
      { name: 'Dental Consultation',       category: 'Preventive',    price: 300,    duration: 15 },
      { name: 'Scaling & Polishing',       category: 'Preventive',    price: 800,    duration: 30 },
      { name: 'Composite Filling (Small)', category: 'Restorative',   price: 1200,   duration: 30 },
      { name: 'Composite Filling (Large)', category: 'Restorative',   price: 1800,   duration: 45 },
      { name: 'Root Canal Treatment',      category: 'Endodontic',    price: 3500,   duration: 60 },
      { name: 'Extraction (Simple)',       category: 'Surgical',      price: 600,    duration: 20 },
      { name: 'Extraction (Surgical)',     category: 'Surgical',      price: 1500,   duration: 45 },
      { name: 'Metal Crown',               category: 'Prosthodontic', price: 2500,   duration: 60 },
      { name: 'Ceramic Crown',             category: 'Prosthodontic', price: 5000,   duration: 60 },
      { name: 'Full Denture (per arch)',   category: 'Prosthodontic', price: 8000,   duration: 90 },
      { name: 'Teeth Whitening',           category: 'Cosmetic',      price: 6000,   duration: 60 },
      { name: 'Braces (Metal)',            category: 'Orthodontic',   price: 25000,  duration: 30 },
    ],
  },
  {
    id: 'usa', region: 'USA', description: 'ADA CDT codes, USD pricing',
    procedures: [
      { name: 'D0120 – Periodic Oral Eval',      category: 'Preventive',    price: 65,    duration: 20 },
      { name: 'D0150 – Comprehensive Oral Eval', category: 'Preventive',    price: 110,   duration: 30 },
      { name: 'D1110 – Adult Prophylaxis',        category: 'Preventive',    price: 110,   duration: 45 },
      { name: 'D2140 – Amalgam (1 surface)',      category: 'Restorative',   price: 180,   duration: 30 },
      { name: 'D2330 – Composite (1 surface)',    category: 'Restorative',   price: 210,   duration: 30 },
      { name: 'D3310 – Root Canal (anterior)',    category: 'Endodontic',    price: 820,   duration: 60 },
      { name: 'D7140 – Extraction',               category: 'Surgical',      price: 155,   duration: 20 },
      { name: 'D2740 – Porcelain Crown',          category: 'Prosthodontic', price: 1400,  duration: 60 },
      { name: 'D5110 – Complete Denture (upper)', category: 'Prosthodontic', price: 1800,  duration: 90 },
      { name: 'D9995 – Teledentistry',            category: 'Other',         price: 50,    duration: 15 },
    ],
  },
  {
    id: 'uae', region: 'UAE / GCC', description: 'VAT-ready (5%), Arabic procedure names, USD pricing',
    procedures: [
      { name: 'Consultation / فحص أسنان',        category: 'Preventive',    price: 150,   duration: 20 },
      { name: 'Cleaning / تنظيف أسنان',          category: 'Preventive',    price: 400,   duration: 30 },
      { name: 'Filling / حشو أسنان',             category: 'Restorative',   price: 350,   duration: 30 },
      { name: 'Root Canal / علاج عصب',           category: 'Endodontic',    price: 1200,  duration: 60 },
      { name: 'Extraction / قلع أسنان',          category: 'Surgical',      price: 300,   duration: 20 },
      { name: 'Porcelain Crown / تاج خزفي',       category: 'Prosthodontic', price: 1800,  duration: 60 },
      { name: 'Teeth Whitening / تبييض',         category: 'Cosmetic',      price: 1500,  duration: 60 },
      { name: 'Implant / زراعة أسنان',           category: 'Surgical',      price: 3500,  duration: 90 },
    ],
  },
  {
    id: 'uk', region: 'UK', description: 'NHS and private treatment categories, GBP pricing',
    procedures: [
      { name: 'Band 1 – Examination & X-ray (NHS)',  category: 'Preventive',    price: 25,    duration: 20 },
      { name: 'Band 2 – Fillings (NHS)',              category: 'Restorative',   price: 68,    duration: 30 },
      { name: 'Band 3 – Crowns & Dentures (NHS)',     category: 'Prosthodontic', price: 295,   duration: 60 },
      { name: 'Private Consultation',                 category: 'Preventive',    price: 80,    duration: 30 },
      { name: 'Composite Veneer (Private)',           category: 'Cosmetic',      price: 350,   duration: 45 },
      { name: 'Tooth Whitening (Private)',            category: 'Cosmetic',      price: 500,   duration: 60 },
      { name: 'Ceramic Crown (Private)',              category: 'Prosthodontic', price: 900,   duration: 60 },
      { name: 'Implant (Private)',                    category: 'Surgical',      price: 2500,  duration: 90 },
    ],
  },
  {
    id: 'generic', region: 'Generic (Blank)', description: 'Fully manual setup — a starter set of common procedure names with $0 pricing',
    procedures: [
      { name: 'Consultation',    category: 'Preventive',    price: 0, duration: 20 },
      { name: 'X-Ray',           category: 'Preventive',    price: 0, duration: 10 },
      { name: 'Scaling',         category: 'Preventive',    price: 0, duration: 30 },
      { name: 'Filling',         category: 'Restorative',   price: 0, duration: 30 },
      { name: 'Root Canal',      category: 'Endodontic',    price: 0, duration: 60 },
      { name: 'Extraction',      category: 'Surgical',      price: 0, duration: 20 },
      { name: 'Crown',           category: 'Prosthodontic', price: 0, duration: 60 },
      { name: 'Whitening',       category: 'Cosmetic',      price: 0, duration: 60 },
    ],
  },
]

router.get('/templates', async (_req, res) => {
  res.json({
    success: true,
    data: PROCEDURE_TEMPLATES.map(({ id, region, description, procedures }) => ({
      id, region, description, procedure_count: procedures.length,
    })),
  })
})

router.post('/templates/apply', requireRole('clinic_owner'), async (req, res, next) => {
  try {
    const { templateId, replace } = req.body as { templateId: string; replace?: boolean }
    const tpl = PROCEDURE_TEMPLATES.find((t) => t.id === templateId)
    if (!tpl) throw new AppError(404, `Template "${templateId}" not found`)

    await withTransaction(req.clinicId, async (client) => {
      if (replace) {
        // Soft-delete existing catalogue
        await client.query(
          `UPDATE treatments SET is_active = false WHERE clinic_id = $1`,
          [req.clinicId],
        )
      }

      for (const proc of tpl.procedures) {
        // Skip if already exists (idempotent)
        const existing = await client.query(
          `SELECT id FROM treatments WHERE clinic_id = $1 AND name = $2 AND is_active = true`,
          [req.clinicId, proc.name],
        )
        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO treatments
               (id, clinic_id, name, category, default_duration_minutes, default_price, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, true)`,
            [randomUUID(), req.clinicId, proc.name, proc.category, proc.duration, proc.price],
          )
        }
      }
    })

    res.json({
      success: true,
      data: {
        template:         tpl.region,
        procedures_added: tpl.procedures.length,
        replaced:         replace ?? false,
      },
    })
  } catch (err) { next(err) }
})

export default router
