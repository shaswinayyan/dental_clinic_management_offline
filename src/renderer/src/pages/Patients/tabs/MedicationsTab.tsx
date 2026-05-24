import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, DatePicker, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { Medication, IpcResult } from '../../../../../shared/types'
import dayjs from 'dayjs'

interface Props { patientId: number }

const STATUS_COLOR: Record<string, string> = { Active: 'green', Completed: 'default', Discontinued: 'red' }

export default function MedicationsTab({ patientId }: Props) {
  const [medications, setMedications] = useState<Medication[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  async function load() {
    const r = await window.api.patients.listMedications(patientId) as IpcResult<Medication[]>
    if (r.success && r.data) setMedications(r.data)
  }

  useEffect(() => { load() }, [patientId])

  async function handleAdd(values: Omit<Medication, 'id'> & { prescribed_on_picker?: dayjs.Dayjs }) {
    setSaving(true)
    try {
      const r = await window.api.patients.addMedication({
        patient_id: patientId,
        medication_name: values.medication_name,
        dosage: values.dosage,
        frequency: values.frequency,
        duration: values.duration,
        prescribed_by: values.prescribed_by,
        prescribed_on: values.prescribed_on_picker?.format('YYYY-MM-DD'),
        reason: values.reason,
        status: values.status || 'Active'
      }) as IpcResult
      if (r.success) { message.success('Medication added'); setShowForm(false); form.resetFields(); load() }
      else message.error(r.error)
    } finally { setSaving(false) }
  }

  async function handleUpdateStatus(id: number, status: string) {
    const r = await window.api.patients.updateMedicationStatus(id, status) as IpcResult
    if (r.success) load()
    else message.error(r.error)
  }

  const columns = [
    { title: 'Medication', dataIndex: 'medication_name', fontWeight: 500 },
    { title: 'Dosage', dataIndex: 'dosage', render: (v: string) => v || '—' },
    { title: 'Frequency', dataIndex: 'frequency', render: (v: string) => v || '—' },
    { title: 'Duration', dataIndex: 'duration', render: (v: string) => v || '—' },
    { title: 'Prescribed By', dataIndex: 'prescribed_by', render: (v: string) => v || '—' },
    { title: 'Date', dataIndex: 'prescribed_on', width: 110, render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Status', dataIndex: 'status', width: 140, render: (v: string, r: Medication) => (
      <Select size="small" value={v} onChange={s => handleUpdateStatus(r.id, s)} style={{ width: 135 }}
        options={[{ value: 'Active', label: 'Active' }, { value: 'Completed', label: 'Completed' }, { value: 'Discontinued', label: 'Discontinued' }]}
        variant="borderless"
      />
    )}
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setShowForm(true)}>Add Medication</Button>
      </div>
      <Table dataSource={medications} columns={columns} rowKey="id" size="small" pagination={false}
        locale={{ emptyText: 'No medications recorded' }} />
      <Modal open={showForm} title="Add Medication" footer={null} onCancel={() => setShowForm(false)} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="medication_name" label="Medication Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Amoxicillin 500mg" />
          </Form.Item>
          <Form.Item name="dosage" label="Dosage"><Input placeholder="e.g. 500mg" /></Form.Item>
          <Form.Item name="frequency" label="Frequency"><Input placeholder="e.g. 3 times daily" /></Form.Item>
          <Form.Item name="duration" label="Duration"><Input placeholder="e.g. 5 days" /></Form.Item>
          <Form.Item name="prescribed_by" label="Prescribed By"><Input /></Form.Item>
          <Form.Item name="prescribed_on_picker" label="Prescribed On">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="reason" label="Reason"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="status" label="Status" initialValue="Active">
            <Select options={[{ value: 'Active' }, { value: 'Completed' }, { value: 'Discontinued' }]} />
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
