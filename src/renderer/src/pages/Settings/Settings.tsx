import { useEffect, useState } from 'react'
import { Card, Form, Input, InputNumber, Button, message, Spin, Switch, Divider, Typography } from 'antd'
import type { AppSettings, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'

interface Props { navigate: (r: Route) => void }

export default function SettingsPage({ navigate }: Props) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
      if (r.success) message.success('Settings saved')
      else message.error(r.error)
    } finally { setSaving(false) }
  }

  if (loading) return <Spin />

  return (
    <Card title="General Settings">
      <Form form={form} layout="vertical" onFinish={handleSave} style={{ maxWidth: 600 }}>
        <Typography.Title level={5} style={{ color: '#1e3a8a' }}>Clinic Information</Typography.Title>
        <Form.Item name="clinic_name" label="Clinic Name" rules={[{ required: true }]}>
          <Input placeholder="My Dental Clinic" />
        </Form.Item>
        <Form.Item name="clinic_address" label="Clinic Address">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="clinic_phone" label="Clinic Phone">
          <Input placeholder="Contact number" />
        </Form.Item>

        <Divider />
        <Typography.Title level={5} style={{ color: '#1e3a8a' }}>Billing Settings</Typography.Title>
        <Form.Item name="tax_rate" label="GST / Tax Rate (%)">
          <InputNumber min={0} max={100} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="discount_threshold" label="Discount Threshold (%) — Above this requires Doctor approval">
          <InputNumber min={0} max={100} style={{ width: '100%' }} />
        </Form.Item>

        <Divider />
        <Typography.Title level={5} style={{ color: '#1e3a8a' }}>Security Settings</Typography.Title>
        <Form.Item name="session_timeout_minutes" label="Session Timeout (minutes)">
          <InputNumber min={5} max={480} style={{ width: '100%' }} />
        </Form.Item>

        <Divider />
        <Typography.Title level={5} style={{ color: '#1e3a8a' }}>Inventory Settings</Typography.Title>
        <Form.Item name="expiry_alert_days" label="Expiry Alert Window (days)">
          <InputNumber min={1} max={365} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>Save Settings</Button>
        </Form.Item>
      </Form>
    </Card>
  )
}
