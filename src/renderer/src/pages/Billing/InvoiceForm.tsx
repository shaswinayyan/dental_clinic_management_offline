import { useEffect, useState } from 'react'
import { Card, Form, Select, Input, InputNumber, Button, Table, Divider, message, Spin, Space, Row, Col } from 'antd'
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import type { Patient, Treatment, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import { useT } from '../../hooks/useT'
import { useAuthStore } from '../../store/authStore'

interface Props { patientId?: number; appointmentId?: number; navigate: (r: Route) => void }

interface LineItem { key: string; treatment_id?: number; description: string; quantity: number; unit_price: number }

export default function InvoiceForm({ patientId, appointmentId, navigate }: Props) {
  const [form] = Form.useForm()
  const [patients, setPatients] = useState<Patient[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [items, setItems] = useState<LineItem[]>([{ key: '1', description: '', quantity: 1, unit_price: 0 }])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [taxRate, setTaxRate] = useState(0)
  const [discountThreshold, setDiscountThreshold] = useState(20)
  const { user } = useAuthStore()
  const t = useT()

  useEffect(() => {
    async function load() {
      const [patRes, trRes, settRes] = await Promise.all([
        window.api.patients.list() as Promise<IpcResult<Patient[]>>,
        window.api.appointments.listTreatments() as Promise<IpcResult<Treatment[]>>,
        window.api.billing.getSettings() as Promise<IpcResult<{ tax_rate: number; discount_threshold: number }>>
      ])
      if (patRes.success && patRes.data) setPatients(patRes.data)
      if (trRes.success && trRes.data) setTreatments(trRes.data)
      if (settRes.success && settRes.data) {
        setTaxRate(settRes.data.tax_rate)
        setDiscountThreshold(settRes.data.discount_threshold)
        form.setFieldValue('tax_rate', settRes.data.tax_rate)
      }
      if (patientId) form.setFieldValue('patient_id', patientId)
      setLoading(false)
    }
    load()
  }, [])

  function addItem() {
    setItems(prev => [...prev, { key: Date.now().toString(), description: '', quantity: 1, unit_price: 0 }])
  }

  function removeItem(key: string) {
    setItems(prev => prev.filter(i => i.key !== key))
  }

  function updateItem(key: string, field: string, value: unknown) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i))
  }

  function handleTreatmentSelect(key: string, treatmentId: number) {
    const t = treatments.find(t => t.id === treatmentId)
    if (t) {
      setItems(prev => prev.map(i => i.key === key ? { ...i, treatment_id: treatmentId, description: t.name, unit_price: t.default_price } : i))
    }
  }

  const [discountAmt, setDiscountAmt] = useState(0)
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const discount = discountAmt
  const tax = (subtotal - discount) * (taxRate / 100)
  const total = subtotal - discount + tax

  async function handleSubmit(values: { patient_id: number; discount_amount?: number; discount_reason?: string; tax_rate: number }) {
    if (!user) return
    if (items.length === 0 || items.every(i => !i.description)) { message.error('Add at least one item'); return }
    if (values.discount_amount && values.discount_amount / subtotal * 100 > discountThreshold && user.role !== 'doctor') {
      message.error(`Discounts above ${discountThreshold}% require Doctor authorization`); return
    }
    setSaving(true)
    try {
      const r = await window.api.billing.createInvoice({
        patient_id: values.patient_id,
        appointment_id: appointmentId,
        items: items.filter(i => i.description).map(i => ({
          treatment_id: i.treatment_id,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price
        })),
        discount_amount: values.discount_amount || 0,
        discount_reason: values.discount_reason,
        tax_rate: values.tax_rate,
        created_by: user.id
      }) as IpcResult<number>
      if (r.success && r.data) {
        message.success('Invoice created')
        navigate({ page: 'invoice-detail', id: r.data })
      } else {
        message.error(r.error || 'Failed to create invoice')
      }
    } finally { setSaving(false) }
  }

  if (loading) return <Spin />

  return (
    <Card
      title={<Space><Button icon={<ArrowLeftOutlined />} onClick={() => navigate({ page: 'invoices' })} /><span>New Invoice</span></Space>}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Row gutter={16}>
          <Col span={16}>
            <Form.Item name="patient_id" label="Patient" rules={[{ required: true }]}>
              <Select showSearch placeholder="Search patient..."
                filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                options={patients.map(p => ({ value: p.id, label: `${p.name} (${p.op_id})` }))} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="tax_rate" label={`Tax Rate (%)`}>
              <InputNumber min={0} max={100} style={{ width: '100%' }} onChange={v => setTaxRate(v || 0)} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">Line Items</Divider>
        <Table
          dataSource={items}
          pagination={false}
          size="small"
          rowKey="key"
          columns={[
            { title: 'Treatment', width: 220, render: (_, r) => (
              <Select size="small" placeholder="Select..." allowClear style={{ width: '100%' }}
                showSearch onChange={v => handleTreatmentSelect(r.key, v)}
                filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                options={treatments.map(t => ({ value: t.id, label: t.name }))} />
            )},
            { title: 'Description', render: (_, r) => (
              <Input size="small" value={r.description} onChange={e => updateItem(r.key, 'description', e.target.value)} placeholder="Description" />
            )},
            { title: 'Qty', width: 70, render: (_, r) => (
              <InputNumber size="small" min={1} value={r.quantity} onChange={v => updateItem(r.key, 'quantity', v || 1)} style={{ width: '100%' }} />
            )},
            { title: 'Unit Price (₹)', width: 130, render: (_, r) => (
              <InputNumber size="small" min={0} value={r.unit_price} onChange={v => updateItem(r.key, 'unit_price', v || 0)} style={{ width: '100%' }} />
            )},
            { title: 'Total', width: 110, render: (_, r) => `₹${(r.quantity * r.unit_price).toLocaleString('en-IN')}` },
            { title: '', width: 40, render: (_, r) => (
              <Button type="text" icon={<DeleteOutlined />} size="small" danger onClick={() => removeItem(r.key)} disabled={items.length === 1} />
            )}
          ]}
          footer={() => <Button icon={<PlusOutlined />} onClick={addItem} type="dashed" size="small">Add Item</Button>}
        />

        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Form.Item name="discount_amount" label="Discount (₹)">
              <InputNumber min={0} style={{ width: '100%' }} onChange={v => setDiscountAmt(Number(v) || 0)} />
            </Form.Item>
            <Form.Item name="discount_reason" label="Discount Reason">
              <Input placeholder="Reason for discount..." />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Card size="small" style={{ background: t.bgFill, border: `1px solid ${t.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Subtotal:</span><strong>₹{subtotal.toLocaleString('en-IN')}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Discount:</span><span style={{ color: '#dc2626' }}>-₹{discount.toLocaleString('en-IN')}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Tax ({taxRate}%):</span><span>₹{tax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ fontSize: 16 }}>Total:</strong><strong style={{ fontSize: 18, color: '#c9a84c' }}>₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></div>
            </Card>
          </Col>
        </Row>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button onClick={() => navigate({ page: 'invoices' })}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={saving}>Create Invoice</Button>
        </div>
      </Form>
    </Card>
  )
}
