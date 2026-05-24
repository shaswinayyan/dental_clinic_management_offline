import { useEffect, useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, DatePicker, message, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { Allergy, IpcResult } from '../../../../../shared/types'
import dayjs from 'dayjs'

interface Props { patientId: number; onChanged: () => void }

const SEVERITY_COLOR: Record<string, string> = { Mild: 'green', Moderate: 'orange', Severe: 'red' }

export default function AllergiesTab({ patientId, onChanged }: Props) {
  const [allergies, setAllergies] = useState<Allergy[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  async function load() {
    const r = await window.api.patients.listAllergies(patientId) as IpcResult<Allergy[]>
    if (r.success && r.data) setAllergies(r.data)
  }

  useEffect(() => { load() }, [patientId])

  async function handleAdd(values: Omit<Allergy, 'id'> & { noted_at_picker?: dayjs.Dayjs }) {
    setSaving(true)
    try {
      const r = await window.api.patients.addAllergy({
        patient_id: patientId,
        allergen_name: values.allergen_name,
        allergy_type: values.allergy_type,
        severity: values.severity,
        reaction_description: values.reaction_description,
        noted_at: values.noted_at_picker?.format('YYYY-MM-DD')
      }) as IpcResult
      if (r.success) { message.success('Allergy added'); setShowForm(false); form.resetFields(); load(); onChanged() }
      else message.error(r.error)
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    const r = await window.api.patients.deleteAllergy(id) as IpcResult
    if (r.success) { message.success('Allergy removed'); load(); onChanged() }
    else message.error(r.error)
  }

  const columns = [
    { title: 'Allergen', dataIndex: 'allergen_name', fontWeight: 500 },
    { title: 'Type', dataIndex: 'allergy_type', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Severity', dataIndex: 'severity', width: 100, render: (v: string) => <Tag color={SEVERITY_COLOR[v]}>{v}</Tag> },
    { title: 'Reaction', dataIndex: 'reaction_description', ellipsis: true, render: (v: string) => v || '—' },
    { title: 'Noted', dataIndex: 'noted_at', width: 110, render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: '', width: 50, render: (_: unknown, r: Allergy) => (
      <Popconfirm title="Remove this allergy?" onConfirm={() => handleDelete(r.id)}>
        <Button type="text" icon={<DeleteOutlined />} size="small" danger />
      </Popconfirm>
    )}
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setShowForm(true)}>Add Allergy</Button>
      </div>
      <Table dataSource={allergies} columns={columns} rowKey="id" size="small" pagination={false}
        locale={{ emptyText: 'No allergies recorded' }} />
      <Modal open={showForm} title="Add Allergy" footer={null} onCancel={() => setShowForm(false)} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="allergen_name" label="Allergen Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Penicillin, Latex" />
          </Form.Item>
          <Form.Item name="allergy_type" label="Type" rules={[{ required: true }]}>
            <Select options={[{ value: 'Drug' }, { value: 'Food' }, { value: 'Material' }, { value: 'Other' }]} />
          </Form.Item>
          <Form.Item name="severity" label="Severity" rules={[{ required: true }]}>
            <Select options={[{ value: 'Mild', label: 'Mild' }, { value: 'Moderate', label: 'Moderate' }, { value: 'Severe', label: 'Severe' }]} />
          </Form.Item>
          <Form.Item name="reaction_description" label="Reaction Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="noted_at_picker" label="Date Noted">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Add</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
