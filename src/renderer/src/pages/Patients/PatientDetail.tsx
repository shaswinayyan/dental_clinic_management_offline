import { useEffect, useState } from 'react'
import {
  Card, Tabs, Button, Tag, Space, Modal, Spin, Typography, Alert, Descriptions, message, Radio
} from 'antd'
import {
  EditOutlined, ArrowLeftOutlined, ExclamationCircleOutlined, WhatsAppOutlined
} from '@ant-design/icons'
import type { Patient, Allergy, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import { useT } from '../../hooks/useT'
import PatientForm from './PatientForm'
import GeneralInfo from './tabs/GeneralInfo'
import TreatmentsTab from './tabs/TreatmentsTab'
import BillingTab from './tabs/BillingTab'
import ImagesTab from './tabs/ImagesTab'
import AppointmentHistoryTab from './tabs/AppointmentHistoryTab'
import ClinicalAssessmentTab from './tabs/ClinicalAssessmentTab'
import DentalChartTab from './tabs/DentalChartTab'
import TreatmentTimeline from './tabs/TreatmentTimeline'
import AllergiesTab from './tabs/AllergiesTab'
import MedicationsTab from './tabs/MedicationsTab'
import PrescriptionsTab from './tabs/PrescriptionsTab'

interface Props { id: number; navigate: (r: Route) => void }

const WA_TEMPLATES = [
  {
    key: 'appointment',
    label: 'Appointment Reminder',
    message: (name: string) =>
      `Hello ${name}, this is a reminder for your upcoming dental appointment. Kindly arrive 10 minutes early. For any changes, please contact us. Thank you! 🦷`
  },
  {
    key: 'followup',
    label: 'Follow-up Check',
    message: (name: string) =>
      `Hello ${name}, we hope you are recovering well after your recent dental treatment. If you have any concerns or discomfort, please do not hesitate to contact us. Thank you for choosing our clinic! 🦷`
  },
  {
    key: 'payment',
    label: 'Payment Due',
    message: (name: string) =>
      `Hello ${name}, we kindly remind you that there is an outstanding payment due for your recent dental treatment. Please visit us at your earliest convenience to clear the balance. Thank you! 🦷`
  },
  {
    key: 'checkup',
    label: 'Routine Check-up',
    message: (name: string) =>
      `Hello ${name}, it has been a while since your last dental visit. We recommend scheduling a routine check-up to keep your oral health in top condition. Please call us to book an appointment. 🦷`
  }
]

export default function PatientDetail({ id, navigate }: Props) {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [allergies, setAllergies] = useState<Allergy[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [waTemplate, setWaTemplate] = useState('appointment')
  const t = useT()

  async function loadPatient() {
    const r = await window.api.patients.get(id) as IpcResult<Patient>
    if (r.success && r.data) setPatient(r.data)
    const ar = await window.api.patients.listAllergies(id) as IpcResult<Allergy[]>
    if (ar.success && ar.data) setAllergies(ar.data)
    setLoading(false)
  }

  useEffect(() => { loadPatient() }, [id])

  async function sendWhatsApp() {
    if (!patient) return
    const tpl = WA_TEMPLATES.find(t => t.key === waTemplate) || WA_TEMPLATES[0]
    const text = tpl.message(patient.name)
    // Normalize phone: strip non-digits and prepend country code if needed
    let phone = patient.contact_number.replace(/\D/g, '')
    if (phone.length === 10) phone = '91' + phone // India
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    const r = await window.api.settings.openExternal(url) as IpcResult
    if (!r.success) message.error('Could not open WhatsApp')
    setWaOpen(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!patient) return <Alert type="error" message="Patient not found" />

  const severeAllergies = allergies.filter(a => a.severity === 'Severe')
  const hasSevereAllergy = severeAllergies.length > 0

  return (
    <div>
      {/* Header */}
      <Card style={{ marginBottom: 16, border: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate({ page: 'patients' })}>Back</Button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography.Title level={4} style={{ margin: 0, color: t.text }}>{patient.name}</Typography.Title>
                {patient.gender && <Tag>{patient.gender}</Tag>}
                {patient.blood_group && <Tag color="red">{patient.blood_group}</Tag>}
              </div>
              <div style={{ color: t.textSub, fontSize: 13, marginTop: 2 }}>
                <code style={{ background: 'var(--zd-border-sub)', padding: '2px 6px', borderRadius: 4, color: '#c9a84c' }}>{patient.op_id}</code>
                <span style={{ marginLeft: 8 }}>{patient.contact_number}</span>
                {patient.date_of_birth && <span style={{ marginLeft: 8 }}>DOB: {new Date(patient.date_of_birth).toLocaleDateString('en-IN')}</span>}
              </div>
            </div>
          </div>
          <Space>
            <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>Edit</Button>
            <Button
              icon={<WhatsAppOutlined />}
              style={{ background: '#25D366', borderColor: '#25D366', color: '#fff' }}
              onClick={() => setWaOpen(true)}
            >
              WhatsApp
            </Button>
            <Button type="primary" onClick={() => navigate({ page: 'invoice-create', patientId: patient.id })}>New Invoice</Button>
          </Space>
        </div>

        {hasSevereAllergy && (
          <div className="allergy-banner" style={{ marginTop: 12 }}>
            <ExclamationCircleOutlined style={{ marginRight: 8 }} />
            <strong>ALLERGY ALERT:</strong>{' '}
            {severeAllergies.map(a => `${a.allergen_name} (${a.allergy_type} — Severe)`).join(', ')}
          </div>
        )}
      </Card>

      {/* Tabs */}
      <Card style={{ border: `1px solid ${t.border}` }}>
        <Tabs defaultActiveKey="general" type="card" destroyInactiveTabPane items={[
          { key: 'general', label: 'General Info', children: <GeneralInfo patient={patient} /> },
          { key: 'treatments', label: 'Treatments', children: <TreatmentsTab patientId={id} navigate={navigate} /> },
          { key: 'billing', label: 'Billing', children: <BillingTab patientId={id} navigate={navigate} /> },
          { key: 'images', label: 'Images', children: <ImagesTab patientId={id} patient={patient} /> },
          { key: 'appointments', label: 'Appointments', children: <AppointmentHistoryTab patientId={id} navigate={navigate} /> },
          { key: 'assessment', label: 'Clinical Assessment', children: <ClinicalAssessmentTab patientId={id} /> },
          { key: 'chart', label: 'Dental Chart', children: <DentalChartTab patientId={id} /> },
          { key: 'timeline', label: 'Treatment Timeline', children: <TreatmentTimeline patientId={id} navigate={navigate} /> },
          { key: 'allergies', label: <span>{allergies.length > 0 ? <Tag color="red">{allergies.length}</Tag> : null} Allergies</span>, children: <AllergiesTab patientId={id} onChanged={loadPatient} /> },
          { key: 'medications', label: 'Medications', children: <MedicationsTab patientId={id} /> },
          { key: 'prescriptions', label: 'Prescriptions', children: <PrescriptionsTab patientId={id} navigate={navigate} /> }
        ]} />
      </Card>

      <Modal open={editOpen} title="Edit Patient" footer={null} onCancel={() => setEditOpen(false)} width={600} destroyOnClose>
        <PatientForm
          patient={patient}
          onSuccess={(updated) => { setEditOpen(false); setPatient(updated) }}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>

      {/* WhatsApp Modal */}
      <Modal
        open={waOpen}
        title={
          <span>
            <WhatsAppOutlined style={{ color: '#25D366', marginRight: 8 }} />
            Send WhatsApp to {patient.name}
          </span>
        }
        onCancel={() => setWaOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setWaOpen(false)}>Cancel</Button>,
          <Button
            key="send"
            style={{ background: '#25D366', borderColor: '#25D366', color: '#fff' }}
            icon={<WhatsAppOutlined />}
            onClick={sendWhatsApp}
          >
            Open WhatsApp
          </Button>
        ]}
        width={520}
      >
        <div style={{ marginBottom: 12, color: t.textSub, fontSize: 13 }}>
          Select a message template for <strong>{patient.name}</strong> ({patient.contact_number}):
        </div>
        <Radio.Group
          value={waTemplate}
          onChange={e => setWaTemplate(e.target.value)}
          style={{ width: '100%' }}
        >
          {WA_TEMPLATES.map(tpl => (
            <div key={tpl.key} style={{ marginBottom: 10 }}>
              <Radio value={tpl.key} style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{tpl.label}</div>
                  <div style={{
                    marginTop: 4, padding: '8px 10px',
                    background: 'rgba(34,197,94,0.08)', borderRadius: 6,
                    border: '1px solid rgba(34,197,94,0.25)', fontSize: 12,
                    color: t.textSub, lineHeight: 1.5
                  }}>
                    {tpl.message(patient.name)}
                  </div>
                </div>
              </Radio>
            </div>
          ))}
        </Radio.Group>
        <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
          ℹ️ Clicking "Open WhatsApp" will open WhatsApp Web/App with this pre-filled message.
          The message is editable before sending.
        </div>
      </Modal>
    </div>
  )
}
