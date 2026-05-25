/**
 * Customisation routes — /api/v2/customisation  [PRD §6]
 *
 * GET    /notation          — Get tooth notation setting
 * PATCH  /notation          — Update tooth notation [clinic_owner]
 *
 * GET    /currency          — Get currency + tax config
 * PATCH  /currency          — Update currency + tax [clinic_owner]
 *
 * GET    /payment-methods   — List accepted payment methods
 * PATCH  /payment-methods   — Update payment methods [clinic_owner]
 *
 * GET    /modules           — Get module toggles
 * PATCH  /modules           — Update module toggles [clinic_owner]
 *
 * GET    /templates         — List clinic note templates
 * POST   /templates         — Create template [branch_manager+]
 * PATCH  /templates/:id     — Update template [branch_manager+]
 * DELETE /templates/:id     — Delete template [clinic_owner]
 * POST   /templates/:id/apply — Apply template to an entity
 */
import { Hono }          from 'hono'
import { zValidator }    from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import {
  db, clinicSettings, clinics,
  eq
} from '@vorsa/db'
import {
  NotationUpdateSchema, CurrencyUpdateSchema, ModulesUpdateSchema
} from '@vorsa/validators'
import { requireAuth }    from '../middleware/auth'
import { requireMinRole } from '../middleware/rbac'
import type { AppEnv }    from '../app'

const router = new Hono<AppEnv>()
router.use('*', requireAuth)

/** Helper: get or init clinicSettings row */
async function getSettings(clinicId: string) {
  const row = await db.select().from(clinicSettings)
    .where(eq(clinicSettings.clinic_id, clinicId))
    .limit(1)
    .then(r => r[0])

  if (row) return row

  // Auto-seed defaults on first access
  const [seeded] = await db.insert(clinicSettings)
    .values({ clinic_id: clinicId })
    .returning()
  return seeded
}

/** Helper: upsert a partial settings update */
async function patchSettings(clinicId: string, patch: Record<string, unknown>) {
  const [updated] = await db.insert(clinicSettings)
    .values({ clinic_id: clinicId, ...patch })
    .onConflictDoUpdate({
      target: [clinicSettings.clinic_id],
      set:    { ...patch, updated_at: new Date() },
    })
    .returning()
  return updated
}

// ── GET /notation ──────────────────────────────────────────────────────────────

router.get('/notation', async (c) => {
  const settings = await getSettings(c.get('clinicId'))
  return c.json({ success: true, data: { notation: settings.tooth_notation } })
})

// ── PATCH /notation ────────────────────────────────────────────────────────────

router.patch('/notation',
  requireMinRole('clinic_owner'),
  zValidator('json', NotationUpdateSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const { notation } = c.req.valid('json')

    const updated = await patchSettings(clinicId, { tooth_notation: notation })
    return c.json({ success: true, data: { notation: updated.tooth_notation } })
  },
)

// ── GET /currency ──────────────────────────────────────────────────────────────

router.get('/currency', async (c) => {
  const settings = await getSettings(c.get('clinicId'))
  return c.json({
    success: true,
    data: {
      currency_code:   settings.currency_code,
      currency_symbol: settings.currency_symbol,
      tax_label:       settings.tax_label,
      tax_rate:        settings.tax_rate,
    },
  })
})

// ── PATCH /currency ────────────────────────────────────────────────────────────

router.patch('/currency',
  requireMinRole('clinic_owner'),
  zValidator('json', CurrencyUpdateSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const body     = c.req.valid('json')

    const updated = await patchSettings(clinicId, {
      currency_code:   body.currency_code,
      currency_symbol: body.currency_symbol,
      tax_label:       body.tax_label,
      tax_rate:        body.tax_rate,
    })

    return c.json({
      success: true,
      data: {
        currency_code:   updated.currency_code,
        currency_symbol: updated.currency_symbol,
        tax_label:       updated.tax_label,
        tax_rate:        updated.tax_rate,
      },
    })
  },
)

// ── GET /payment-methods ───────────────────────────────────────────────────────

router.get('/payment-methods', async (c) => {
  const settings = await getSettings(c.get('clinicId'))
  return c.json({ success: true, data: { payment_methods: settings.payment_methods ?? [] } })
})

// ── PATCH /payment-methods ─────────────────────────────────────────────────────

router.patch('/payment-methods',
  requireMinRole('clinic_owner'),
  async (c) => {
    const clinicId = c.get('clinicId')
    const { methods } = await c.req.json() as { methods: string[] }

    if (!Array.isArray(methods)) {
      throw new HTTPException(400, { message: 'methods must be an array of strings' })
    }

    const updated = await patchSettings(clinicId, { payment_methods: methods })
    return c.json({ success: true, data: { payment_methods: updated.payment_methods } })
  },
)

// ── GET /modules ───────────────────────────────────────────────────────────────

router.get('/modules', async (c) => {
  const settings = await getSettings(c.get('clinicId'))
  return c.json({
    success: true,
    data: {
      modules_enabled: settings.modules_enabled ?? {},
    },
  })
})

// ── PATCH /modules ─────────────────────────────────────────────────────────────

router.patch('/modules',
  requireMinRole('clinic_owner'),
  zValidator('json', ModulesUpdateSchema),
  async (c) => {
    const clinicId = c.get('clinicId')
    const body     = c.req.valid('json')

    const current  = await getSettings(clinicId)
    const merged   = { ...(current.modules_enabled ?? {}), ...body.modules }
    const updated  = await patchSettings(clinicId, { modules_enabled: merged })

    return c.json({ success: true, data: { modules_enabled: updated.modules_enabled } })
  },
)

// ── Templates (stored as JSONB in clinic settings for simplicity) ──────────────
//
// Each template: { id: uuid, name: string, category: string, body: string, created_at: string }

router.get('/templates', async (c) => {
  const settings = await getSettings(c.get('clinicId'))
  return c.json({ success: true, data: settings.templates ?? [] })
})

router.post('/templates',
  requireMinRole('branch_manager'),
  async (c) => {
    const clinicId = c.get('clinicId')
    const body     = await c.req.json() as {
      name: string; category?: string; body: string
    }

    if (!body.name?.trim() || !body.body?.trim()) {
      throw new HTTPException(400, { message: 'name and body are required' })
    }

    const settings  = await getSettings(clinicId)
    const templates = (settings.templates ?? []) as Record<string, unknown>[]

    const newTemplate = {
      id:         crypto.randomUUID(),
      name:       body.name,
      category:   body.category ?? 'general',
      body:       body.body,
      created_at: new Date().toISOString(),
    }

    templates.push(newTemplate)
    await patchSettings(clinicId, { templates })

    return c.json({ success: true, data: newTemplate }, 201)
  },
)

router.patch('/templates/:id',
  requireMinRole('branch_manager'),
  async (c) => {
    const clinicId   = c.get('clinicId')
    const templateId = c.req.param('id')
    const body       = await c.req.json() as Partial<{ name: string; category: string; body: string }>

    const settings  = await getSettings(clinicId)
    const templates = (settings.templates ?? []) as Record<string, unknown>[]
    const idx       = templates.findIndex(t => t['id'] === templateId)

    if (idx === -1) throw new HTTPException(404, { message: 'Template not found' })

    templates[idx] = { ...templates[idx], ...body, updated_at: new Date().toISOString() }
    await patchSettings(clinicId, { templates })

    return c.json({ success: true, data: templates[idx] })
  },
)

router.delete('/templates/:id',
  requireMinRole('clinic_owner'),
  async (c) => {
    const clinicId   = c.get('clinicId')
    const templateId = c.req.param('id')

    const settings  = await getSettings(clinicId)
    const templates = ((settings.templates ?? []) as Record<string, unknown>[])
      .filter(t => t['id'] !== templateId)

    await patchSettings(clinicId, { templates })
    return c.json({ success: true, data: null })
  },
)

router.post('/templates/:id/apply',
  async (c) => {
    const clinicId   = c.get('clinicId')
    const templateId = c.req.param('id')
    const { variables = {} } = await c.req.json() as { variables?: Record<string, string> }

    const settings  = await getSettings(clinicId)
    const templates = (settings.templates ?? []) as Record<string, unknown>[]
    const template  = templates.find(t => t['id'] === templateId)

    if (!template) throw new HTTPException(404, { message: 'Template not found' })

    // Simple variable substitution: {{variable_name}}
    let rendered = String(template['body'] ?? '')
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replaceAll(`{{${key}}}`, value)
    }

    return c.json({ success: true, data: { rendered } })
  },
)

export default router
