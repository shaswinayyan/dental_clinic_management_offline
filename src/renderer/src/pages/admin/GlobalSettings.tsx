/**
 * Global Settings — PRD §6  (Cloud / Admin)
 *
 * Tabs:
 *   1. Tooth Notation  — FDI / Universal / Palmer selector
 *   2. Currency & Tax  — currency, tax label, rate, invoice prefix/footer
 *   3. Payment Methods — 9 method toggles with display-name override
 *   4. Modules         — inventory, analytics, patient_portal, custom_fields, api_access
 *
 * Consumes:   GET/PATCH /api/v2/customisation/{notation,currency,payment-methods,modules}
 * Guards:     clinic_owner only (RBAC enforced server-side; UI hides from others)
 */
import { useEffect, useState } from 'react'
import {
  Tabs, Form, Select, Input, InputNumber, Switch, Button,
  Card, Tag, Divider, Alert, Spin, Space, message, Tooltip,
  Radio, Badge
} from 'antd'
import {
  GlobalOutlined, DollarOutlined, CreditCardOutlined,
  AppstoreOutlined, SaveOutlined, InfoCircleOutlined,
  CheckCircleOutlined, LockOutlined
} from '@ant-design/icons'
import { useApi } from '../../context/ApiContext'
import { useAuthStore } from '../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type NotationSystem = 'fdi' | 'universal' | 'palmer'

interface NotationConfig {
  notation:   NotationSystem
  description: string
  usage:       string
}

interface CurrencyConfig {
  currency:             string
  currency_symbol:      string
  tax_label:            string
  tax_rate:             number
  invoice_prefix:       string
  invoice_year_in_num:  boolean
  invoice_footer:       string
}

type PaymentMethodType =
  | 'cash' | 'card' | 'upi' | 'bank_transfer' | 'nets'
  | 'stc_pay' | 'apple_pay' | 'google_pay' | 'insurance'

interface PaymentMethodConfig {
  type:        PaymentMethodType
  label:       string
  enabled:     boolean
  display_name?: string
}

interface ModuleConfig {
  inventory:      boolean
  analytics:      boolean
  patient_portal: boolean
  custom_fields:  boolean
  api_access:     boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NOTATION_OPTIONS: { value: NotationSystem; label: string; tag: string; region: string; desc: string }[] = [
  {
    value: 'fdi',
    label: 'FDI World Dental Federation',
    tag: 'International',
    region: 'Europe, Asia, Middle East, Africa',
    desc: 'Two-digit system: first digit = quadrant (1–4 permanent, 5–8 primary), second = tooth number (1–8). E.g. 11 = upper-right central incisor.',
  },
  {
    value: 'universal',
    label: 'Universal Numbering System',
    tag: 'USA',
    region: 'United States',
    desc: 'Permanent teeth numbered 1–32 starting upper-right third molar. Primary teeth lettered A–T. Most common in US practices.',
  },
  {
    value: 'palmer',
    label: 'Palmer Notation',
    tag: 'UK / Historic',
    region: 'United Kingdom, Australia',
    desc: 'Quadrant grid using brackets: tooth number 1–8 within a right-angle symbol per quadrant. Widely used in orthodontics.',
  },
]

const PAYMENT_METHOD_META: Record<PaymentMethodType, { icon: string; region: string }> = {
  cash:          { icon: '💵', region: 'Global' },
  card:          { icon: '💳', region: 'Global' },
  upi:           { icon: '📱', region: 'India' },
  bank_transfer: { icon: '🏦', region: 'Global' },
  nets:          { icon: '🟦', region: 'Singapore' },
  stc_pay:       { icon: '📲', region: 'Saudi Arabia' },
  apple_pay:     { icon: '🍎', region: 'Global' },
  google_pay:    { icon: '🔵', region: 'Global' },
  insurance:     { icon: '🩺', region: 'Global' },
}

const POPULAR_CURRENCIES = [
  { code: 'USD', symbol: '$',  name: 'US Dollar' },
  { code: 'INR', symbol: '₹',  name: 'Indian Rupee' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'GBP', symbol: '£',  name: 'British Pound' },
  { code: 'EUR', symbol: '€',  name: 'Euro' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal' },
  { code: 'BHD', symbol: '.د.ب', name: 'Bahraini Dinar' },
]

const MODULE_META: Record<keyof ModuleConfig, { label: string; desc: string; plan?: string }> = {
  inventory:      { label: 'Inventory Management', desc: 'Track stock levels, expiry dates, and low-stock alerts for dental materials.' },
  analytics:      { label: 'Analytics & Reports', desc: 'Revenue breakdowns, doctor performance, patient retention insights.', plan: 'Business+' },
  patient_portal: { label: 'Patient Portal', desc: 'Allow patients to book appointments online and view their treatment history.', plan: 'Enterprise' },
  custom_fields:  { label: 'Custom Patient Fields', desc: 'Add custom data fields to patient records (e.g. referral source, insurance ID).' },
  api_access:     { label: 'API Access', desc: 'Enable REST API access for third-party integrations and webhooks.', plan: 'Enterprise' },
}

// ── Colour palette ─────────────────────────────────────────────────────────────

const C = { gold: '#c9a84c', navy: '#0d1b2a' }

// ── Main Component ────────────────────────────────────────────────────────────

export default function GlobalSettings() {
  const api  = useApi()
  const auth = useAuthStore()

  const isOwner = auth.role === 'clinic_owner'

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('notation')

  const [notation,  setNotation]  = useState<NotationConfig | null>(null)
  const [currency,  setCurrency]  = useState<CurrencyConfig | null>(null)
  const [methods,   setMethods]   = useState<PaymentMethodConfig[]>([])
  const [modules,   setModules]   = useState<ModuleConfig | null>(null)

  // Form values (local edits before save)
  const [notationDraft, setNotationDraft]   = useState<NotationSystem>('fdi')
  const [currencyForm]                       = Form.useForm<CurrencyConfig>()
  const [modulesDraft, setModulesDraft]     = useState<ModuleConfig>({
    inventory: true, analytics: false, patient_portal: false, custom_fields: false, api_access: false
  })
  const [methodsDraft, setMethodsDraft]     = useState<PaymentMethodConfig[]>([])

  // ── Load all settings on mount ─────────────────────────────────────────────

  useEffect(() => {
    if (!isOwner) { setLoading(false); return }
    async function loadAll() {
      setLoading(true)
      setError(null)
      try {
        const [n, c, m, mod] = await Promise.all([
          api.http.get<NotationConfig>('/customisation/notation'),
          api.http.get<CurrencyConfig>('/customisation/currency'),
          api.http.get<PaymentMethodConfig[]>('/customisation/payment-methods'),
          api.http.get<ModuleConfig>('/customisation/modules'),
        ])
        setNotation(n)
        setNotationDraft(n.notation)

        setCurrency(c)
        currencyForm.setFieldsValue(c)

        setMethods(m)
        setMethodsDraft(m)

        setModules(mod)
        setModulesDraft(mod)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load settings'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [api, isOwner, currencyForm])

  // ── Savers ─────────────────────────────────────────────────────────────────

  async function saveNotation() {
    setSaving('notation')
    try {
      const updated = await api.http.patch<NotationConfig>('/customisation/notation', { notation: notationDraft })
      setNotation(updated)
      message.success('Tooth notation updated')
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  async function saveCurrency() {
    setSaving('currency')
    try {
      const values = await currencyForm.validateFields()
      // Find symbol for selected currency code
      const match = POPULAR_CURRENCIES.find(c => c.code === values.currency)
      const payload = { ...values, currency_symbol: match?.symbol ?? values.currency_symbol }
      const updated = await api.http.patch<CurrencyConfig>('/customisation/currency', payload)
      setCurrency(updated)
      currencyForm.setFieldsValue(updated)
      message.success('Currency & billing settings updated')
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown[] }).errorFields) return // Ant Design validation
      message.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  async function savePaymentMethods() {
    setSaving('methods')
    try {
      const updated = await api.http.patch<PaymentMethodConfig[]>('/customisation/payment-methods', { methods: methodsDraft })
      setMethods(updated)
      setMethodsDraft(updated)
      message.success('Payment methods updated')
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  async function saveModules() {
    setSaving('modules')
    try {
      const updated = await api.http.patch<ModuleConfig>('/customisation/modules', modulesDraft)
      setModules(updated)
      setModulesDraft(updated)
      message.success('Module settings updated')
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  function toggleMethod(type: PaymentMethodType, field: 'enabled' | 'display_name', value: boolean | string) {
    setMethodsDraft(prev => prev.map(m => m.type === type ? { ...m, [field]: value } : m))
  }

  // ── Access guard ────────────────────────────────────────────────────────────

  if (!isOwner) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: 400, gap: 16, textAlign: 'center'
      }}>
        <LockOutlined style={{ fontSize: 40, color: C.gold }} />
        <div style={{ fontSize: 18, fontWeight: 700 }}>Clinic Owner access required</div>
        <div style={{ color: 'var(--text-secondary)' }}>
          Global settings can only be configured by the Clinic Owner.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Spin size="large" />
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 860 }}>

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
          Global Settings
        </h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
          Clinic-wide configuration — applies to all branches
        </p>
      </div>

      {error && <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} style={{ marginBottom: 20 }} />}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          /* ──────────── NOTATION ──────────── */
          {
            key: 'notation',
            label: (
              <span><GlobalOutlined style={{ marginRight: 6 }} />Tooth Notation</span>
            ),
            children: (
              <div style={{ paddingTop: 8 }}>
                <Alert
                  type="info"
                  showIcon
                  message="Affects dental chart display and treatment records"
                  description="Changing the notation system affects how tooth numbers are displayed throughout the app. Existing records are not modified — only the display format changes."
                  style={{ marginBottom: 20 }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                  {NOTATION_OPTIONS.map(opt => {
                    const active = notationDraft === opt.value
                    return (
                      <Card
                        key={opt.value}
                        size="small"
                        style={{
                          border: `2px solid ${active ? C.gold : 'var(--border-subtle, #e5e7eb)'}`,
                          borderRadius: 10,
                          cursor: 'pointer',
                          background: active ? `${C.gold}08` : undefined,
                          transition: 'border-color 0.2s',
                        }}
                        onClick={() => setNotationDraft(opt.value)}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                          <Radio checked={active} onChange={() => setNotationDraft(opt.value)} style={{ marginTop: 2 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontWeight: 700, fontSize: 15 }}>{opt.label}</span>
                              <Tag color={active ? 'gold' : 'default'} className="notation-badge">{opt.tag}</Tag>
                              {notation?.notation === opt.value && (
                                <Tag color="success" icon={<CheckCircleOutlined />}>Current</Tag>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                              📍 {opt.region}
                            </div>
                            <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                              {opt.desc}
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>

                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving === 'notation'}
                  onClick={saveNotation}
                  disabled={notationDraft === notation?.notation}
                  style={{ background: C.gold, borderColor: C.gold, color: C.navy, fontWeight: 700 }}
                >
                  Save Notation
                </Button>
              </div>
            ),
          },

          /* ──────────── CURRENCY & TAX ──────────── */
          {
            key: 'currency',
            label: (
              <span><DollarOutlined style={{ marginRight: 6 }} />Currency &amp; Tax</span>
            ),
            children: (
              <div style={{ paddingTop: 8 }}>
                <Form form={currencyForm} layout="vertical" style={{ maxWidth: 580 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                    <Form.Item
                      label="Currency"
                      name="currency"
                      rules={[{ required: true }]}
                    >
                      <Select
                        showSearch
                        options={POPULAR_CURRENCIES.map(c => ({
                          value: c.code,
                          label: `${c.symbol}  ${c.code} — ${c.name}`
                        }))}
                        optionFilterProp="label"
                        onChange={code => {
                          const match = POPULAR_CURRENCIES.find(c => c.code === code)
                          if (match) currencyForm.setFieldValue('currency_symbol', match.symbol)
                        }}
                      />
                    </Form.Item>

                    <Form.Item
                      label={
                        <span>
                          Currency Symbol&nbsp;
                          <Tooltip title="Auto-filled when selecting from the list. Can be overridden.">
                            <InfoCircleOutlined style={{ color: 'var(--text-muted)' }} />
                          </Tooltip>
                        </span>
                      }
                      name="currency_symbol"
                      rules={[{ required: true, max: 8 }]}
                    >
                      <Input placeholder="e.g. $" maxLength={8} style={{ width: 100 }} />
                    </Form.Item>

                    <Form.Item label="Tax Label" name="tax_label" rules={[{ max: 30 }]}>
                      <Input placeholder="e.g. GST, VAT, Tax" />
                    </Form.Item>

                    <Form.Item label="Tax Rate (%)" name="tax_rate">
                      <InputNumber min={0} max={100} step={0.5} precision={2} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item label="Invoice Prefix" name="invoice_prefix">
                      <Input placeholder="e.g. INV, BILL" maxLength={10} />
                    </Form.Item>

                    <Form.Item
                      label={
                        <span>
                          Year in Invoice Number&nbsp;
                          <Tooltip title="E.g. INV-2025-0001 vs INV-0001">
                            <InfoCircleOutlined style={{ color: 'var(--text-muted)' }} />
                          </Tooltip>
                        </span>
                      }
                      name="invoice_year_in_num"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </div>

                  <Form.Item label="Invoice Footer Note" name="invoice_footer">
                    <Input.TextArea
                      rows={3}
                      maxLength={300}
                      placeholder="e.g. Thank you for choosing Vorsa Dental Care. All treatments carry a 6-month warranty."
                      showCount
                    />
                  </Form.Item>

                  {currency && (
                    <Alert
                      type="success"
                      showIcon
                      message={`Currently: ${currency.currency} (${currency.currency_symbol}) · Tax: ${currency.tax_label} ${currency.tax_rate}%`}
                      style={{ marginBottom: 16 }}
                    />
                  )}

                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving === 'currency'}
                    onClick={saveCurrency}
                    style={{ background: C.gold, borderColor: C.gold, color: C.navy, fontWeight: 700 }}
                  >
                    Save Currency &amp; Tax
                  </Button>
                </Form>
              </div>
            ),
          },

          /* ──────────── PAYMENT METHODS ──────────── */
          {
            key: 'payment-methods',
            label: (
              <span><CreditCardOutlined style={{ marginRight: 6 }} />Payment Methods</span>
            ),
            children: (
              <div style={{ paddingTop: 8 }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
                  Enable the payment methods accepted at your clinic. Enabled methods appear in the billing module.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {methodsDraft.map(method => {
                    const meta = PAYMENT_METHOD_META[method.type]
                    return (
                      <Card key={method.type} size="small" style={{ borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <span style={{ fontSize: 22, flexShrink: 0 }}>{meta.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                                {method.display_name || method.label}
                              </span>
                              <Tag color="default" style={{ fontSize: 10 }}>{meta.region}</Tag>
                            </div>
                            {method.enabled && (
                              <Input
                                size="small"
                                placeholder={`Display name (default: ${method.label})`}
                                value={method.display_name ?? ''}
                                onChange={e => toggleMethod(method.type, 'display_name', e.target.value)}
                                style={{ marginTop: 6, maxWidth: 280 }}
                              />
                            )}
                          </div>
                          <Switch
                            checked={method.enabled}
                            onChange={v => toggleMethod(method.type, 'enabled', v)}
                            checkedChildren="On"
                            unCheckedChildren="Off"
                          />
                        </div>
                      </Card>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving === 'methods'}
                    onClick={savePaymentMethods}
                    style={{ background: C.gold, borderColor: C.gold, color: C.navy, fontWeight: 700 }}
                  >
                    Save Payment Methods
                  </Button>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {methodsDraft.filter(m => m.enabled).length} of {methodsDraft.length} enabled
                  </span>
                </div>
              </div>
            ),
          },

          /* ──────────── MODULES ──────────── */
          {
            key: 'modules',
            label: (
              <span>
                <AppstoreOutlined style={{ marginRight: 6 }} />
                Modules
                {modules && !modules.analytics && (
                  <Badge dot style={{ marginLeft: 4 }} />
                )}
              </span>
            ),
            children: (
              <div style={{ paddingTop: 8 }}>
                <Alert
                  type="warning"
                  showIcon
                  message="Disabling a module hides it from the sidebar but does not delete any data."
                  style={{ marginBottom: 20 }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                  {(Object.keys(MODULE_META) as (keyof ModuleConfig)[]).map(key => {
                    const meta = MODULE_META[key]
                    const enabled = modulesDraft[key]
                    const plan = meta.plan

                    return (
                      <Card key={key} size="small" style={{ borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontWeight: 600 }}>{meta.label}</span>
                              {plan && <Tag color="gold" style={{ fontSize: 10 }}>{plan}</Tag>}
                              {enabled && <Tag color="success" style={{ fontSize: 10 }}>Active</Tag>}
                            </div>
                            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              {meta.desc}
                            </div>
                          </div>
                          <Switch
                            checked={enabled}
                            onChange={v => setModulesDraft(prev => ({ ...prev, [key]: v }))}
                            checkedChildren="On"
                            unCheckedChildren="Off"
                          />
                        </div>
                      </Card>
                    )
                  })}
                </div>

                <Space>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving === 'modules'}
                    onClick={saveModules}
                    style={{ background: C.gold, borderColor: C.gold, color: C.navy, fontWeight: 700 }}
                  >
                    Save Modules
                  </Button>
                  <Button
                    onClick={() => { if (modules) setModulesDraft(modules) }}
                    disabled={!modules}
                  >
                    Reset
                  </Button>
                </Space>

                <Divider />

                <div style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.7 }}>
                  <strong>Note on plan restrictions:</strong> Modules marked <Tag color="gold" style={{ fontSize: 10 }}>Business+</Tag> or <Tag color="gold" style={{ fontSize: 10 }}>Enterprise</Tag> require
                  the corresponding subscription plan. Enabling them on a lower plan will show a plan-gate screen when accessed.
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
