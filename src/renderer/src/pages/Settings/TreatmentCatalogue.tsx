import { useEffect, useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, InputNumber, Switch, message, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { Treatment, TreatmentCategory, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import { useAuthStore } from '../../store/authStore'
import { useT } from '../../hooks/useT'

interface Props { navigate: (r: Route) => void }

const CATEGORIES: TreatmentCategory[] = ['Preventive', 'Restorative', 'Surgical', 'Orthodontic', 'Cosmetic', 'Periodontal', 'Endodontic', 'Prosthodontic', 'Other']

export default function TreatmentCatalogue({ navigate }: Props) {
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editTreatment, setEditTreatment] = useState<Treatment | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const { user } = useAuthStore()
  const t = useT()

  async function load() {
    const r = await window.api.appointments.allTreatments() as IpcResult<Treatment[]>
    if (r.success && r.data) setTreatments(r.data)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setEditTreatment(null); form.resetFields(); form.setFieldValue('applicable_chairs', '[1,2,3]'); form.setFieldValue('is_active', true); setShowForm(true) }
  function openEdit(t: Treatment) {
    setEditTreatment(t)
    form.setFieldsValue({ ...t, applicable_chairs_arr: JSON.parse(t.applicable_chairs), is_active: !!t.is_active })
    setShowForm(true)
  }

  async function handleSubmit(values: { name: string; category: string; default_duration_minutes: number; default_price: number; applicable_chairs_arr: number[]; is_active: boolean }) {
    setSaving(true)
    try {
      const data = {
        name: values.name,
        category: values.category as TreatmentCategory,
        default_duration_minutes: values.default_duration_minutes,
        default_price: values.default_price,
        applicable_chairs: JSON.stringify(values.applicable_chairs_arr || [1, 2, 3]),
        is_active: values.is_active ? 1 : 0
      }
      let r: IpcResult
      if (editTreatment) {
        r = await window.api.appointments.updateTreatment(editTreatment.id, data) as IpcResult
      } else {
        r = await window.api.appointments.createTreatment(data) as IpcResult
      }
      if (r.success) { message.success(editTreatment ? 'Updated' : 'Created'); setShowForm(false); load() }
      else message.error(r.error)
    } finally { setSaving(false) }
  }

  const columns = [
    { title: 'Treatment Name', dataIndex: 'name', render: (v: string) => <strong>{v}</strong> },
    { title: 'Category', dataIndex: 'category', width: 130, render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Duration', dataIndex: 'default_duration_minutes', width: 90, render: (v: number) => `${v} min` },
    { title: 'Default Price', dataIndex: 'default_price', width: 120, render: (v: number) => `₹${v.toLocaleString('en-IN')}` },
    { title: 'Chairs', dataIndex: 'applicable_chairs', width: 120, render: (v: string) => {
      const chairs: number[] = JSON.parse(v)
      return chairs.map(c => <Tag key={c} style={{ fontSize: 10 }}>Chair {c}</Tag>)
    }},
    { title: 'Active', dataIndex: 'is_active', width: 80, render: (v: number) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag> },
    { title: 'Actions', width: 80, render: (_: unknown, r: Treatment) => (
      user?.role === 'doctor' ? <Button size="small" onClick={() => openEdit(r)}>Edit</Button> : null
    )}
  ]

  return (
    <div style={{ background: t.bg, borderRadius: 12, border: `1px solid ${t.border}`, padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: t.text }}>Treatment Catalogue</div>
        {user?.role === 'doctor' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Treatment</Button>
        )}
      </div>
      <Table dataSource={treatments} columns={columns} rowKey="id" size="small" pagination={{ pageSize: 20 }} />

      <Modal open={showForm} title={editTreatment ? 'Edit Treatment' : 'Add Treatment'} footer={null} onCancel={() => setShowForm(false)} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Treatment Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true }]}>
            <Select options={CATEGORIES.map(c => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="default_duration_minutes" label="Default Duration (minutes)" rules={[{ required: true }]}>
            <InputNumber min={5} max={480} step={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="default_price" label="Default Price (₹)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="applicable_chairs_arr" label="Applicable Chairs" rules={[{ required: true }]}>
            <Select mode="multiple" options={[{ value: 1, label: 'Chair 1 (OP1)' }, { value: 2, label: 'Chair 2 (OP2)' }, { value: 3, label: 'Chair 3 (OP3)' }]} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>{editTreatment ? 'Update' : 'Add'}</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
