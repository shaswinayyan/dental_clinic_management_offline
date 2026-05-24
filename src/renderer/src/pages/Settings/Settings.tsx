import { useEffect, useState } from 'react'
import { Card, Form, Input, InputNumber, Button, message, Spin, Divider, Typography } from 'antd'
import {
  BankOutlined, MedicineBoxOutlined,
  SafetyOutlined, ControlOutlined
} from '@ant-design/icons'
import type { AppSettings, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'

interface Props { navigate: (r: Route) => void }

const GOLD = '#c9a84c'
const NAVY = '#0a1628'

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: GOLD, fontSize: 16
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--zd-text-1)', letterSpacing: '0.01em' }}>{title}</div>
        <div style={{ width: 28, height: 2, background: `linear-gradient(90deg, ${GOLD}, transparent)`, marginTop: 3 }} />
      </div>
    </div>
  )
}

export default function SettingsPage({ navigate: _navigate }: Props) {
  const [form]   = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const r = await window.api.settings.get() as IpcResult<AppSettings>
      if (r.success && r.data) form.setFieldsValue(r.data)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(values: AppSettings) {
    setSaving(true)
    try {
      const r = await window.api.settings.update(values) as IpcResult
      if (r.success) message.success('Settings saved successfully')
      else message.error(r.error)
    } finally { setSaving(false) }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}><Spin size="large" /></div>

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Card
        bordered={false}
        style={{ borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
            <div style={{
              width: 4, height: 24, borderRadius: 2,
              background: `linear-gradient(180deg, ${GOLD}, #8a6020)`
            }} />
            <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--zd-text-1)', letterSpacing: '-0.2px' }}>
              Clinic Settings
            </span>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>

          {/* ── Clinic Information ─────────────────────────────────── */}
          <SectionTitle icon={<BankOutlined />} title="Clinic Information" />
          <Form.Item name="clinic_name" label="Clinic Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Vorsa Dental Clinic" />
          </Form.Item>
          <Form.Item name="clinic_address" label="Clinic Address">
            <Input.TextArea rows={2} placeholder="Full clinic address" />
          </Form.Item>
          <Form.Item name="clinic_phone" label="Clinic Phone">
            <Input placeholder="Contact number" />
          </Form.Item>

          <Divider style={{ borderColor: 'rgba(201,168,76,0.18)' }} />

          <Divider style={{ borderColor: 'rgba(201,168,76,0.18)' }} />

          {/* ── Billing ────────────────────────────────────────────── */}
          <SectionTitle icon={<ControlOutlined />} title="Billing & Tax" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="tax_rate" label="GST / Tax Rate (%)">
              <InputNumber min={0} max={100} style={{ width: '100%' }} suffix="%" />
            </Form.Item>
            <Form.Item name="discount_threshold" label="Max Discount (%) without approval">
              <InputNumber min={0} max={100} style={{ width: '100%' }} suffix="%" />
            </Form.Item>
          </div>

          <Divider style={{ borderColor: 'rgba(201,168,76,0.18)' }} />

          {/* ── Security ───────────────────────────────────────────── */}
          <SectionTitle icon={<SafetyOutlined />} title="Security" />
          <Form.Item name="session_timeout_minutes" label="Session Timeout (minutes)" style={{ maxWidth: 260 }}>
            <InputNumber min={5} max={480} style={{ width: '100%' }} />
          </Form.Item>

          <Divider style={{ borderColor: 'rgba(201,168,76,0.18)' }} />

          {/* ── Inventory ──────────────────────────────────────────── */}
          <SectionTitle icon={<MedicineBoxOutlined />} title="Inventory Alerts" />
          <Form.Item name="expiry_alert_days" label="Expiry Alert Window (days)" style={{ maxWidth: 260 }}>
            <InputNumber min={1} max={365} style={{ width: '100%' }} />
          </Form.Item>

          <Divider style={{ borderColor: 'rgba(201,168,76,0.18)' }} />

          {/* Save */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              size="large"
              style={{ minWidth: 160, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              Save Settings
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
