import { Descriptions, Tag } from 'antd'
import type { Patient } from '../../../../../shared/types'
import dayjs from 'dayjs'

interface Props { patient: Patient }

export default function GeneralInfo({ patient }: Props) {
  return (
    <Descriptions bordered column={2} size="small">
      <Descriptions.Item label="OP ID" span={1}><code>{patient.op_id}</code></Descriptions.Item>
      <Descriptions.Item label="Full Name">{patient.name}</Descriptions.Item>
      <Descriptions.Item label="Contact Number">{patient.contact_number}</Descriptions.Item>
      <Descriptions.Item label="Emergency Contact">{patient.emergency_contact || '—'}</Descriptions.Item>
      <Descriptions.Item label="Date of Birth">
        {patient.date_of_birth ? dayjs(patient.date_of_birth).format('DD MMM YYYY') : '—'}
      </Descriptions.Item>
      <Descriptions.Item label="Gender">{patient.gender ? <Tag>{patient.gender}</Tag> : '—'}</Descriptions.Item>
      <Descriptions.Item label="Blood Group">{patient.blood_group ? <Tag color="red">{patient.blood_group}</Tag> : '—'}</Descriptions.Item>
      <Descriptions.Item label="Address" span={2}>{patient.address || '—'}</Descriptions.Item>
      <Descriptions.Item label="Past Medical History" span={2}>
        <div style={{ whiteSpace: 'pre-wrap' }}>{patient.past_medical_history || '—'}</div>
      </Descriptions.Item>
      <Descriptions.Item label="Registered On">
        {dayjs(patient.created_at).format('DD MMM YYYY, HH:mm')}
      </Descriptions.Item>
      <Descriptions.Item label="Last Updated">
        {dayjs(patient.updated_at).format('DD MMM YYYY, HH:mm')}
      </Descriptions.Item>
    </Descriptions>
  )
}
