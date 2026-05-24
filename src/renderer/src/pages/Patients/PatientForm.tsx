import { useState } from 'react'
import { Form, Input, Select, DatePicker, Button, Row, Col, message } from 'antd'
import type { Patient, PatientFormData, IpcResult } from '../../../../shared/types'
import dayjs from 'dayjs'

interface Props {
  patient?: Patient
  onSuccess: (patient: Patient) => void
  onCancel: () => void
}

export default function PatientForm({ patient, onSuccess, onCancel }: Props) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(values: PatientFormData & { date_of_birth_picker?: dayjs.Dayjs }) {
    setSaving(true)
    try {
      const data: PatientFormData = {
        name: values.name,
        contact_number: values.contact_number,
        address: values.address,
        date_of_birth: values.date_of_birth_picker?.format('YYYY-MM-DD'),
        gender: values.gender,
        blood_group: values.blood_group,
        emergency_contact: values.emergency_contact,
        past_medical_history: values.past_medical_history
      }

      // Check duplicate
      const dupRes = await window.api.patients.checkDuplicateContact(data.contact_number, patient?.id) as IpcResult<boolean>
      if (dupRes.success && dupRes.data) {
        message.warning('Another patient with this contact number already exists. You may proceed, but please verify.')
      }

      let result: IpcResult<Patient>
      if (patient) {
        result = await window.api.patients.update(patient.id, data) as IpcResult<Patient>
        if (result.success) {
          const updated = await window.api.patients.get(patient.id) as IpcResult<Patient>
          onSuccess(updated.data!)
          message.success('Patient updated successfully')
        }
      } else {
        result = await window.api.patients.create(data) as IpcResult<Patient>
        if (result.success && result.data) {
          onSuccess(result.data)
          message.success('Patient registered successfully')
        }
      }
      if (!result.success) message.error(result.error || 'Failed to save patient')
    } finally {
      setSaving(false)
    }
  }

  const initialValues = patient ? {
    ...patient,
    date_of_birth_picker: patient.date_of_birth ? dayjs(patient.date_of_birth) : undefined
  } : {}

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={initialValues}>
      <Row gutter={16}>
        <Col span={16}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true }, { max: 150 }]}>
            <Input placeholder="Enter full name" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="gender" label="Gender">
            <Select placeholder="Select" allowClear options={[
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' },
              { value: 'Other', label: 'Other' }
            ]} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="contact_number" label="Contact Number" rules={[{ required: true }, { pattern: /^\d{10}$/, message: 'Must be 10 digits' }]}>
            <Input placeholder="10-digit mobile number" maxLength={10} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="emergency_contact" label="Emergency Contact">
            <Input placeholder="Emergency contact number" maxLength={10} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="date_of_birth_picker" label="Date of Birth">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="blood_group" label="Blood Group">
            <Select placeholder="Select" allowClear options={
              ['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(v => ({ value: v, label: v }))
            } />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="address" label="Address">
        <Input.TextArea rows={2} placeholder="Full address" maxLength={500} />
      </Form.Item>
      <Form.Item name="past_medical_history" label="Past Medical History">
        <Input.TextArea rows={3} placeholder="Systemic conditions, surgical history, allergies overview..." />
      </Form.Item>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={saving}>{patient ? 'Update' : 'Register Patient'}</Button>
      </div>
    </Form>
  )
}
