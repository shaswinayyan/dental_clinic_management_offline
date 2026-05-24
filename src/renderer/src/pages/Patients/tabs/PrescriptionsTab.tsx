import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, Tag, message, Space, Divider, Popconfirm } from 'antd'
import { PlusOutlined, MinusCircleOutlined, FileTextOutlined, MedicineBoxOutlined } from '@ant-design/icons'
import type { Prescription, PrescriptionItem, IpcResult } from '../../../../../shared/types'
import type { Route } from '../../../components/Layout/MainLayout'
import { useAuthStore } from '../../../store/authStore'
import { useT } from '../../../hooks/useT'
import dayjs from 'dayjs'

interface Props { patientId: number; navigate: (r: Route) => void }

const STATUS_COLORS: Record<string, string> = {
  active: 'blue',
  dispensed: 'green',
  cancelled: 'default'
}

export default function PrescriptionsTab({ patientId, navigate }: Props) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const { user } = useAuthStore()
  const t = useT()

  async function load() {
    setLoading(true)
    const r = await window.api.patients.listPrescriptions(patientId) as IpcResult<Prescription[]>
    if (r.success && r.data) setPrescriptions(r.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [patientId])

  async function handleCreate(values: {
    diagnosis?: string
    notes?: string
    items: Array<{
      medicine_name: string
      dosage?: string
      frequency?: string
      duration?: string
      quantity: number
      unit_price: number
      instructions?: string
    }>
  }) {
    if (!user) return
    if (!values.items?.length) {
      message.warning('Add at least one medicine')
      return
    }
    setSaving(true)
    try {
      const r = await window.api.patients.createPrescription({
        patient_id: patientId,
        prescribed_by: user.id,
        diagnosis: values.diagnosis,
        notes: values.notes,
        items: values.items.map(item => ({
          ...item,
          quantity: item.quantity ?? 1,
          unit_price: item.unit_price ?? 0
        }))
      }) as IpcResult<number>
      if (r.success) {
        message.success('Prescription created')
        setShowForm(false)
        form.resetFields()
        load()
      } else {
        message.error(r.error)
      }
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: number, status: string) {
    if (!user) return
    const r = await window.api.patients.updatePrescriptionStatus(id, status, user.id) as IpcResult
    if (r.success) load()
    else message.error(r.error)
  }

  function createInvoiceFromPrescription(prescription: Prescription) {
    // Navigate to invoice creation with prescription items pre-populated
    navigate({ page: 'invoice-create', patientId, prescriptionId: prescription.id } as Route)
  }

  const expandedRowRender = (record: Prescription) => {
    const items = record.items ?? []
    return (
      <div style={{ padding: '8px 16px' }}>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12.5, color: t.textSub }}>Medicines Prescribed:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((item: PrescriptionItem) => (
            <div key={item.id} style={{
              background: t.bgFill, borderRadius: 8, padding: '8px 14px',
              border: `1px solid ${t.border}`, display: 'flex', gap: 16, flexWrap: 'wrap'
            }}>
              <div style={{ fontWeight: 600, color: t.text, minWidth: 140 }}>
                <MedicineBoxOutlined style={{ color: '#c9a84c', marginRight: 6 }} />
                {item.medicine_name}
              </div>
              {item.dosage && <div style={{ color: t.textSub, fontSize: 12.5 }}>Dose: <strong>{item.dosage}</strong></div>}
              {item.frequency && <div style={{ color: t.textSub, fontSize: 12.5 }}>Freq: <strong>{item.frequency}</strong></div>}
              {item.duration && <div style={{ color: t.textSub, fontSize: 12.5 }}>Duration: <strong>{item.duration}</strong></div>}
              <div style={{ color: t.textSub, fontSize: 12.5 }}>Qty: <strong>{item.quantity}</strong></div>
              {item.unit_price > 0 && <div style={{ color: t.textSub, fontSize: 12.5 }}>Price: <strong>₹{item.unit_price}</strong></div>}
              {item.instructions && <div style={{ color: t.textHint, fontSize: 12, fontStyle: 'italic', flex: '100%' }}>{item.instructions}</div>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const columns = [
    {
      title: 'Date', dataIndex: 'prescribed_at', width: 120,
      render: (v: string) => dayjs(v).format('DD MMM YYYY')
    },
    { title: 'Diagnosis', dataIndex: 'diagnosis', ellipsis: true, render: (v: string) => v || '—' },
    { title: 'Prescribed By', dataIndex: 'prescribed_by_name', width: 130, render: (v: string) => v || '—' },
    {
      title: 'Medicines', key: 'count',
      render: (_: unknown, r: Prescription) => (
        <Tag icon={<MedicineBoxOutlined />} color="blue">
          {r.items?.length ?? 0} item(s)
        </Tag>
      )
    },
    {
      title: 'Status', dataIndex: 'status', width: 120,
      render: (v: string) => <Tag color={STATUS_COLORS[v] ?? 'default'}>{v}</Tag>
    },
    {
      title: 'Actions', width: 240,
      render: (_: unknown, r: Prescription) => (
        <Space size="small">
          {r.status === 'active' && (
            <>
              <Button size="small" type="primary" icon={<FileTextOutlined />}
                onClick={() => createInvoiceFromPrescription(r)}>
                Bill
              </Button>
              <Popconfirm
                title="Mark as dispensed?"
                onConfirm={() => updateStatus(r.id, 'dispensed')}
                okText="Yes" cancelText="No"
              >
                <Button size="small">Mark Dispensed</Button>
              </Popconfirm>
              <Popconfirm
                title="Cancel this prescription?"
                onConfirm={() => updateStatus(r.id, 'cancelled')}
                okText="Cancel Rx" cancelText="No" okButtonProps={{ danger: true }}
              >
                <Button size="small" danger>Cancel</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        {(user?.role === 'doctor') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowForm(true)}>
            New Prescription
          </Button>
        )}
      </div>

      <Table
        dataSource={prescriptions}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 10 }}
        expandable={{ expandedRowRender }}
      />

      {/* Create prescription modal */}
      <Modal
        open={showForm}
        title={<span><MedicineBoxOutlined style={{ color: '#c9a84c', marginRight: 8 }} />New Prescription</span>}
        footer={null}
        onCancel={() => { setShowForm(false); form.resetFields() }}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="diagnosis" label="Diagnosis / Complaint">
            <Input placeholder="e.g. Post-extraction pain management" />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13, color: t.textSub }}>Medicines</Divider>

          <Form.List name="items" initialValue={[{}]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div key={key} style={{ background: t.bgFill, borderRadius: 8, padding: '12px 14px', marginBottom: 8, border: `1px solid ${t.border}` }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Form.Item
                        {...restField}
                        name={[name, 'medicine_name']}
                        label="Medicine Name"
                        rules={[{ required: true, message: 'Required' }]}
                        style={{ flex: '1 1 180px', marginBottom: 8 }}
                      >
                        <Input placeholder="e.g. Ibuprofen 400mg" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'dosage']} label="Dosage" style={{ flex: '1 1 100px', marginBottom: 8 }}>
                        <Input placeholder="e.g. 400mg" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'frequency']} label="Frequency" style={{ flex: '1 1 100px', marginBottom: 8 }}>
                        <Input placeholder="e.g. TDS" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'duration']} label="Duration" style={{ flex: '1 1 100px', marginBottom: 8 }}>
                        <Input placeholder="e.g. 5 days" />
                      </Form.Item>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <Form.Item {...restField} name={[name, 'quantity']} label="Qty" initialValue={1} style={{ width: 80, marginBottom: 0 }}>
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'unit_price']} label="Unit Price (₹)" initialValue={0} style={{ width: 120, marginBottom: 0 }}>
                        <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'instructions']} label="Instructions" style={{ flex: 1, marginBottom: 0, minWidth: 180 }}>
                        <Input placeholder="e.g. After food" />
                      </Form.Item>
                      <Button
                        type="text" danger
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(name)}
                        style={{ marginBottom: 0 }}
                      />
                    </div>
                  </div>
                ))}
                <Button type="dashed" onClick={() => add({})} block icon={<PlusOutlined />} style={{ marginBottom: 16 }}>
                  Add Medicine
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item name="notes" label="Notes / Instructions">
            <Input.TextArea rows={2} placeholder="Additional notes for the patient" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setShowForm(false); form.resetFields() }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              Save Prescription
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
