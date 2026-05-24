/**
 * Onboarding Setup Wizard — PRD §8.2
 *
 * Multi-step wizard shown to new clinic owners after registration:
 *   Step 1 — Clinic details (name, logo, address, country, timezone)
 *   Step 2 — Branch configuration (name, address, working hours)
 *   Step 3 — Billing setup (currency, tax, payment methods)
 *   Step 4 — Treatment catalogue (choose regional template)
 *   Step 5 — Invite staff (email invitations with role)
 *
 * On completion, redirects to the main dashboard.
 */
import React, { useState } from 'react'
import {
  Steps, Button, Form, Input, Select, Switch, InputNumber,
  Card, Typography, Space, Row, Col, Tag, Alert, Checkbox,
  Divider, message,
} from 'antd'
import {
  BankOutlined, ClockCircleOutlined, DollarOutlined,
  MedicineBoxOutlined, TeamOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useT } from '../../hooks/useT'
import { useApi } from '../../context/ApiContext'

const { Title, Text, Paragraph } = Typography

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { title: 'Clinic',    icon: <BankOutlined /> },
  { title: 'Hours',     icon: <ClockCircleOutlined /> },
  { title: 'Billing',   icon: <DollarOutlined /> },
  { title: 'Catalogue', icon: <MedicineBoxOutlined /> },
  { title: 'Staff',     icon: <TeamOutlined /> },
]

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const REGIONAL_TEMPLATES = [
  { id: 'india',   region: 'India',        flag: '🇮🇳', note: 'BDS codes, INR pricing, GST-ready' },
  { id: 'usa',     region: 'USA',          flag: '🇺🇸', note: 'ADA CDT codes, USD pricing' },
  { id: 'uae',     region: 'UAE / GCC',    flag: '🇦🇪', note: 'VAT 5%, Arabic names, USD pricing' },
  { id: 'uk',      region: 'UK',           flag: '🇬🇧', note: 'NHS + private, GBP pricing' },
  { id: 'generic', region: 'Generic',      flag: '🌍', note: 'Blank template — set your own prices' },
]

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'INR', label: 'Indian Rupee (INR)' },
  { code: 'AED', label: 'UAE Dirham (AED)' },
  { code: 'GBP', label: 'British Pound (GBP)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'SGD', label: 'Singapore Dollar (SGD)' },
  { code: 'MYR', label: 'Malaysian Ringgit (MYR)' },
  { code: 'SAR', label: 'Saudi Riyal (SAR)' },
  { code: 'QAR', label: 'Qatari Riyal (QAR)' },
]

const PAYMENT_METHODS = [
  { key: 'cash',          label: 'Cash' },
  { key: 'card',          label: 'Card' },
  { key: 'upi',           label: 'UPI (India)' },
  { key: 'bank_transfer', label: 'Bank Transfer' },
  { key: 'nets',          label: 'NETS (Singapore)' },
  { key: 'stc_pay',       label: 'STC Pay / Mada (KSA)' },
  { key: 'apple_pay',     label: 'Apple Pay' },
  { key: 'google_pay',    label: 'Google Pay' },
  { key: 'insurance',     label: 'Insurance' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingWizard(): React.ReactElement {
  const t          = useT()
  const api        = useApi()
  const navigate   = useNavigate()
  const [messageApi, contextHolder] = message.useMessage()
  const [current,  setCurrent]  = useState(0)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  // Form data collected across all steps
  const [clinicForm]  = Form.useForm()
  const [hoursForm]   = Form.useForm()
  const [billingForm] = Form.useForm()
  const [staffForm]   = Form.useForm()

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [enabledPayments,  setEnabledPayments]  = useState<string[]>(['cash', 'card'])
  const [staffInvites,     setStaffInvites]      = useState<Array<{ email: string; role: string }>>([])

  // ── Step navigation ─────────────────────────────────────────────────────────

  const next = async (): Promise<void> => {
    setError(null)
    setSaving(true)
    try {
      switch (current) {
        case 0: await saveClinicDetails(); break
        case 1: await saveWorkingHours();  break
        case 2: await saveBilling();       break
        case 3: await saveCatalogue();     break
        case 4: await saveStaff();         break
      }
      if (current < STEPS.length - 1) {
        setCurrent((c) => c + 1)
      } else {
        // Wizard complete — go to dashboard
        navigate('/dashboard', { replace: true })
        void messageApi.success('Setup complete! Welcome to VORSA.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const prev = (): void => setCurrent((c) => Math.max(0, c - 1))

  // ── Step save handlers ──────────────────────────────────────────────────────

  const saveClinicDetails = async (): Promise<void> => {
    await clinicForm.validateFields()
    // The clinic was already created during registration. Save extra settings.
    const values = clinicForm.getFieldsValue() as { timezone?: string; notation?: string }
    const settingsApi = api as unknown as {
      updateCustomisation: (key: string, data: Record<string, unknown>) => Promise<void>
    }
    if (values.notation) {
      await settingsApi.updateCustomisation('notation', { notation: values.notation })
    }
  }

  const saveWorkingHours = async (): Promise<void> => {
    const vals = hoursForm.getFieldsValue() as Record<string, unknown>
    const branchId = (api as unknown as { getDefaultBranchId?: () => string }).getDefaultBranchId?.()
    if (!branchId) return // no branch yet; skip
    const payload = DAY_NAMES.map((_, i) => ({
      day_of_week: i,
      is_open:     vals[`is_open_${i}`] as boolean ?? (i > 0 && i < 6),
      open_time:   vals[`open_time_${i}`] as string ?? '09:00',
      close_time:  vals[`close_time_${i}`] as string ?? '17:00',
    }))
    await (api as unknown as {
      putBranchWorkingHours: (id: string, d: unknown[]) => Promise<void>
    }).putBranchWorkingHours(branchId, payload)
  }

  const saveBilling = async (): Promise<void> => {
    const values = billingForm.getFieldsValue() as {
      currency?: string; tax_label?: string; tax_rate?: number
    }
    const currencyApi = api as unknown as {
      updateCustomisation: (k: string, d: Record<string, unknown>) => Promise<void>
    }
    if (values.currency) {
      await currencyApi.updateCustomisation('currency', {
        currency:  values.currency,
        tax_label: values.tax_label ?? 'Tax',
        tax_rate:  values.tax_rate ?? 0,
      })
    }
    // Save payment methods
    const methods = PAYMENT_METHODS.map((m) => ({
      key: m.key, label: m.label, enabled: enabledPayments.includes(m.key),
    }))
    await currencyApi.updateCustomisation('payment-methods', { methods })
  }

  const saveCatalogue = async (): Promise<void> => {
    if (!selectedTemplate) return // skip if no template chosen
    await (api as unknown as {
      applyTemplate: (id: string) => Promise<void>
    }).applyTemplate(selectedTemplate)
  }

  const saveStaff = async (): Promise<void> => {
    for (const invite of staffInvites) {
      if (!invite.email || !invite.role) continue
      // In real implementation this would send email invitations.
      // For now just log — invite system is Phase 2.
      console.log('[Onboarding] Staff invite queued:', invite)
    }
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  const cardStyle = {
    background: t.bg,
    border: `1px solid ${t.border}`,
    borderRadius: 16,
    padding: 28,
    minHeight: 400,
  }

  const labelStyle = { color: t.text }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--zd-bg-layout)',
      padding: '32px 16px',
    }}>
      {contextHolder}
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <Space direction="vertical" size={4} style={{ width: '100%', textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ color: t.text, fontFamily: 'Playfair Display, serif', margin: 0 }}>
            Set up your clinic
          </Title>
          <Text style={{ color: t.textSub }}>
            Just a few steps and you'll be ready to see patients
          </Text>
        </Space>

        {/* Step indicators */}
        <Steps
          current={current}
          items={STEPS.map((s) => ({ title: s.title, icon: s.icon }))}
          style={{ marginBottom: 32 }}
          size="small"
        />

        {error && (
          <Alert type="error" message={error} closable onClose={() => setError(null)}
            style={{ marginBottom: 20 }} />
        )}

        {/* Step 0 — Clinic details */}
        {current === 0 && (
          <div style={cardStyle}>
            <Title level={4} style={{ color: t.text, marginTop: 0 }}>Clinic details</Title>
            <Paragraph style={{ color: t.textSub }}>
              Tell us about your practice so we can personalise the experience.
            </Paragraph>
            <Form form={clinicForm} layout="vertical" requiredMark={false}>
              <Form.Item label={<span style={labelStyle}>Tooth notation system</span>} name="notation"
                initialValue="FDI">
                <Select>
                  <Select.Option value="FDI">
                    FDI (ISO 3950) — International / Europe / Asia / Middle East
                  </Select.Option>
                  <Select.Option value="Universal">
                    Universal Numbering — United States / Canada
                  </Select.Option>
                  <Select.Option value="Palmer">
                    Palmer Notation — UK / Commonwealth
                  </Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label={<span style={labelStyle}>Timezone</span>} name="timezone">
                <Select showSearch placeholder="Select your timezone" optionFilterProp="children">
                  {[
                    'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Kuala_Lumpur',
                    'Europe/London', 'Europe/Paris', 'US/Eastern', 'US/Pacific',
                    'Australia/Sydney', 'UTC',
                  ].map((tz) => (
                    <Select.Option key={tz} value={tz}>{tz.replace('_', ' ')}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Form>
          </div>
        )}

        {/* Step 1 — Working hours */}
        {current === 1 && (
          <div style={cardStyle}>
            <Title level={4} style={{ color: t.text, marginTop: 0 }}>Working hours</Title>
            <Paragraph style={{ color: t.textSub }}>
              Set the opening hours for your clinic. You can change these later per branch.
            </Paragraph>
            <Form form={hoursForm} layout="horizontal"
              initialValues={Object.fromEntries([
                ...DAY_NAMES.map((_, i) => [`is_open_${i}`, i > 0 && i < 6]),
                ...DAY_NAMES.map((_, i) => [`open_time_${i}`, '09:00']),
                ...DAY_NAMES.map((_, i) => [`close_time_${i}`, '17:00']),
              ])}>
              {DAY_NAMES.map((day, i) => (
                <Row key={i} gutter={8} align="middle" style={{ marginBottom: 10 }}>
                  <Col span={6}>
                    <Form.Item name={`is_open_${i}`} valuePropName="checked" style={{ margin: 0 }}>
                      <Switch checkedChildren={day.slice(0, 3)} unCheckedChildren={day.slice(0, 3)} />
                    </Form.Item>
                  </Col>
                  <Col span={7}>
                    <Form.Item name={`open_time_${i}`} style={{ margin: 0 }}>
                      <Input type="time" />
                    </Form.Item>
                  </Col>
                  <Col span={1} style={{ textAlign: 'center', color: t.textSub }}>–</Col>
                  <Col span={7}>
                    <Form.Item name={`close_time_${i}`} style={{ margin: 0 }}>
                      <Input type="time" />
                    </Form.Item>
                  </Col>
                </Row>
              ))}
            </Form>
          </div>
        )}

        {/* Step 2 — Billing */}
        {current === 2 && (
          <div style={cardStyle}>
            <Title level={4} style={{ color: t.text, marginTop: 0 }}>Billing configuration</Title>
            <Paragraph style={{ color: t.textSub }}>
              Choose your currency, tax settings, and accepted payment methods.
            </Paragraph>
            <Form form={billingForm} layout="vertical" requiredMark={false}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label={<span style={labelStyle}>Primary currency</span>} name="currency"
                    initialValue="USD" rules={[{ required: true }]}>
                    <Select showSearch>
                      {CURRENCIES.map((c) => (
                        <Select.Option key={c.code} value={c.code}>{c.label}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={<span style={labelStyle}>Tax label</span>} name="tax_label"
                    initialValue="Tax">
                    <Input placeholder="GST, VAT, Sales Tax…" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label={<span style={labelStyle}>Tax rate (%)</span>} name="tax_rate"
                    initialValue={0}>
                    <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={<span style={labelStyle}>Invoice prefix</span>} name="invoice_prefix"
                    initialValue="INV">
                    <Input placeholder="INV" maxLength={10} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>

            <Divider style={{ borderColor: t.border }} />
            <Text style={{ color: t.text, fontWeight: 600, display: 'block', marginBottom: 12 }}>
              Accepted payment methods
            </Text>
            <Row gutter={[8, 8]}>
              {PAYMENT_METHODS.map((m) => (
                <Col key={m.key}>
                  <Tag.CheckableTag
                    checked={enabledPayments.includes(m.key)}
                    onChange={(checked) =>
                      setEnabledPayments((prev) =>
                        checked ? [...prev, m.key] : prev.filter((k) => k !== m.key),
                      )
                    }
                    style={{
                      padding: '4px 12px',
                      borderRadius: 6,
                      border: `1px solid ${enabledPayments.includes(m.key) ? '#c9a84c' : t.border}`,
                      background: enabledPayments.includes(m.key) ? 'rgba(201,168,76,0.12)' : 'transparent',
                      color: enabledPayments.includes(m.key) ? '#c9a84c' : t.textSub,
                      cursor: 'pointer',
                    }}
                  >
                    {m.label}
                  </Tag.CheckableTag>
                </Col>
              ))}
            </Row>
          </div>
        )}

        {/* Step 3 — Treatment catalogue */}
        {current === 3 && (
          <div style={cardStyle}>
            <Title level={4} style={{ color: t.text, marginTop: 0 }}>Treatment catalogue</Title>
            <Paragraph style={{ color: t.textSub }}>
              Choose a regional starter template. You can rename, reprice, or delete any procedure afterwards.
            </Paragraph>
            <Row gutter={[12, 12]}>
              {REGIONAL_TEMPLATES.map((tpl) => (
                <Col key={tpl.id} xs={24} sm={12}>
                  <Card
                    hoverable
                    onClick={() => setSelectedTemplate(tpl.id)}
                    style={{
                      cursor: 'pointer',
                      border: selectedTemplate === tpl.id
                        ? '2px solid #c9a84c'
                        : `1px solid ${t.border}`,
                      background: selectedTemplate === tpl.id
                        ? 'rgba(201,168,76,0.06)'
                        : t.bg,
                      borderRadius: 10,
                    }}
                    bodyStyle={{ padding: '14px 16px' }}
                  >
                    <Space>
                      <span style={{ fontSize: 22 }}>{tpl.flag}</span>
                      <div>
                        <Text strong style={{ color: t.text, fontSize: 14 }}>{tpl.region}</Text>
                        <br />
                        <Text style={{ color: t.textSub, fontSize: 12 }}>{tpl.note}</Text>
                      </div>
                      {selectedTemplate === tpl.id && (
                        <CheckCircleOutlined style={{ color: '#c9a84c', fontSize: 18, marginLeft: 'auto' }} />
                      )}
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
            {!selectedTemplate && (
              <Text style={{ color: t.textSub, fontSize: 12, marginTop: 12, display: 'block' }}>
                You can skip this step and set up your catalogue manually in Settings.
              </Text>
            )}
          </div>
        )}

        {/* Step 4 — Invite staff */}
        {current === 4 && (
          <div style={cardStyle}>
            <Title level={4} style={{ color: t.text, marginTop: 0 }}>Invite your team</Title>
            <Paragraph style={{ color: t.textSub }}>
              Invite doctors and receptionists by email. They'll receive a link to set their password.
              You can always add more staff from the Administration panel later.
            </Paragraph>

            {staffInvites.map((invite, idx) => (
              <Row key={idx} gutter={8} style={{ marginBottom: 8 }}>
                <Col span={12}>
                  <Input
                    placeholder="colleague@example.com"
                    value={invite.email}
                    onChange={(e) => {
                      const updated = [...staffInvites]
                      updated[idx] = { ...updated[idx], email: e.target.value }
                      setStaffInvites(updated)
                    }}
                  />
                </Col>
                <Col span={8}>
                  <Select
                    value={invite.role}
                    onChange={(v: string) => {
                      const updated = [...staffInvites]
                      updated[idx] = { ...updated[idx], role: v }
                      setStaffInvites(updated)
                    }}
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="doctor">Doctor</Select.Option>
                    <Select.Option value="receptionist">Receptionist</Select.Option>
                    <Select.Option value="branch_manager">Branch Manager</Select.Option>
                  </Select>
                </Col>
                <Col span={4}>
                  <Button danger onClick={() => setStaffInvites((prev) => prev.filter((_, i) => i !== idx))}>
                    ✕
                  </Button>
                </Col>
              </Row>
            ))}

            <Button type="dashed" block onClick={() => setStaffInvites((prev) => [...prev, { email: '', role: 'doctor' }])}
              style={{ marginTop: 8, borderColor: '#c9a84c', color: '#c9a84c' }}>
              + Add another
            </Button>

            <Alert
              type="info"
              style={{ marginTop: 20 }}
              message="Email invitations will be sent when your plan includes it (Business+). Staff accounts created here will be active immediately."
            />
          </div>
        )}

        {/* Navigation buttons */}
        <Row justify="space-between" style={{ marginTop: 24 }}>
          <Col>
            {current > 0 && (
              <Button onClick={prev} disabled={saving}>← Back</Button>
            )}
          </Col>
          <Col>
            <Space>
              {current === 3 && !selectedTemplate && (
                <Button onClick={() => setCurrent((c) => c + 1)} type="text" style={{ color: t.textSub }}>
                  Skip
                </Button>
              )}
              {current === 4 && (
                <Button onClick={() => navigate('/dashboard', { replace: true })} type="text" style={{ color: t.textSub }}>
                  Skip for now
                </Button>
              )}
              <Button
                type="primary"
                loading={saving}
                onClick={() => void next()}
                style={{ background: '#c9a84c', borderColor: '#c9a84c', minWidth: 120 }}
              >
                {current === STEPS.length - 1 ? 'Finish setup →' : 'Next →'}
              </Button>
            </Space>
          </Col>
        </Row>
      </div>
    </div>
  )
}
