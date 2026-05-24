import { useEffect, useState } from 'react'
import { Form, Select, DatePicker, InputNumber, Input, Button, message, Spin } from 'antd'
import type { Patient, Chair, Treatment, IpcResult } from '../../../../shared/types'
import dayjs from 'dayjs'

interface Props {
  defaultChairId?: number
  defaultDateTime?: string
  onSuccess: () => void
  onCancel: () => void
}

export default function AppointmentForm({ defaultChairId, defaultDateTime, onSuccess, onCancel }: Props) {
  const [form] = Form.useForm()
  const [patients, setPatients] = useState<Patient[]>([])
  const [chairs, setChairs] = useState<Chair[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [patientSearch, setPatientSearch] = useState('')

  useEffect(() => {
    async function load() {
      const [cr, tr] = await Promise.all([
        window.api.appointments.listChairs() as Promise<IpcResult<Chair[]>>,
        window.api.appointments.listTreatments() as Promise<IpcResult<Treatment[]>>
      ])
      if (cr.success && cr.data) setChairs(cr.data)
      if (tr.success && tr.data) setTreatments(tr.data)
      setLoading(false)
    }
    load()
    if (defaultChairId) form.setFieldValue('chair_id', defaultChairId)
    if (defaultDateTime) form.setFieldValue('scheduled_at', dayjs(defaultDateTime))
  }, [])

  async function searchPatients(search: string) {
    const r = await window.api.patients.list(search) as IpcResult<Patient[]>
    if (r.success && r.data) setPatients(r.data)
  }

  function handleTreatmentChange(treatmentId: number) {
    const t = treatments.find(t => t.id === treatmentId)
    if (t) form.setFieldValue('duration_minutes', t.default_duration_minutes)
  }

  async function handleSubmit(values: {
    patient_id: number; chair_id: number; treatment_id: number;
    scheduled_at: dayjs.Dayjs; duration_minutes: number; notes?: string
  }) {
    setSaving(true)
    try {
      const r = await window.api.appointments.create({
        patient_id: values.patient_id,
        chair_id: values.chair_id,
        treatment_id: values.treatment_id,
        scheduled_at: values.scheduled_at.format('YYYY-MM-DDTHH:mm:ss'),
        duration_minutes: values.duration_minutes,
        notes: values.notes
      }) as IpcResult<number>
      if (r.success) { message.success('Appointment scheduled'); onSuccess() }
      else message.error(r.error || 'Failed to create appointment')
    } finally { setSaving(false) }
  }

  if (loading) return <Spin />

  const chairOptions = chairs.map(c => ({ value: c.id, label: c.name }))
  const patientOptions = patients.map(p => ({
    value: p.id,
    label: `${p.name} (${p.op_id}) — ${p.contact_number}`
  }))
  const treatmentOptions = treatments.map(t => ({ value: t.id, label: `${t.name} — ₹${t.default_price}`, category: t.category }))

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Form.Item name="patient_id" label="Patient" rules={[{ required: true, message: 'Please select a patient' }]}>
        <Select
          showSearch
          placeholder="Search patient by name, OP ID, or phone..."
          filterOption={false}
          onSearch={(v) => { setPatientSearch(v); searchPatients(v) }}
          onFocus={() => searchPatients('')}
          options={patientOptions}
          notFoundContent={patientSearch.length > 0 ? 'No patients found' : 'Start typing to search...'}
        />
      </Form.Item>
      <Form.Item name="chair_id" label="Chair" rules={[{ required: true }]}>
        <Select options={chairOptions} />
      </Form.Item>
      <Form.Item name="treatment_id" label="Treatment" rules={[{ required: true }]}>
        <Select
          showSearch
          placeholder="Select treatment"
          options={treatmentOptions}
          onChange={handleTreatmentChange}
          filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
        />
      </Form.Item>
      <Form.Item name="scheduled_at" label="Date & Time" rules={[{ required: true }]}>
        <DatePicker
          showTime={{ format: 'HH:mm', minuteStep: 15 }}
          format="DD/MM/YYYY HH:mm"
          style={{ width: '100%' }}
          disabledDate={d => d.isBefore(dayjs().startOf('day'))}
        />
      </Form.Item>
      <Form.Item name="duration_minutes" label="Duration (minutes)" rules={[{ required: true }]}>
        <InputNumber min={5} max={480} step={15} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="notes" label="Notes">
        <Input.TextArea rows={2} placeholder="Pre-appointment notes..." />
      </Form.Item>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={saving}>Schedule Appointment</Button>
      </div>
    </Form>
  )
}
