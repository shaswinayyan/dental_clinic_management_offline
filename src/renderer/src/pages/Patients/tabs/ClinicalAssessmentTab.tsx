import { useEffect, useState, useRef } from 'react'
import { Card, Input, Button, Spin, message, DatePicker } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import type { ClinicalAssessment, IpcResult } from '../../../../../shared/types'
import { useAuthStore } from '../../../store/authStore'
import { useT } from '../../../hooks/useT'
import dayjs from 'dayjs'

interface Props { patientId: number }

export default function ClinicalAssessmentTab({ patientId }: Props) {
  const [assessments, setAssessments] = useState<ClinicalAssessment[]>([])
  const [selected, setSelected] = useState<ClinicalAssessment | null>(null)
  const [form, setForm] = useState({ subjective: '', objective: '', assessment: '', plan: '', session_date: dayjs().format('YYYY-MM-DD') })
  const t = useT()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { user } = useAuthStore()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function load() {
    setLoading(true)
    const r = await window.api.patients.listAssessments(patientId) as IpcResult<ClinicalAssessment[]>
    if (r.success && r.data) {
      setAssessments(r.data)
      if (r.data.length > 0) selectAssessment(r.data[0])
      else setSelected(null)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [patientId])

  function selectAssessment(a: ClinicalAssessment) {
    setSelected(a)
    setForm({ subjective: a.subjective || '', objective: a.objective || '', assessment: a.assessment || '', plan: a.plan || '', session_date: a.session_date })
  }

  function handleChange(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(autoSave, 30000)
  }

  async function autoSave() {
    if (!user) return
    await window.api.patients.upsertAssessment({
      patient_id: patientId,
      appointment_id: selected?.appointment_id,
      ...form,
      created_by: user.id
    })
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)
    try {
      const r = await window.api.patients.upsertAssessment({
        patient_id: patientId,
        appointment_id: selected?.appointment_id,
        ...form,
        created_by: user.id
      }) as IpcResult
      if (r.success) { message.success('Assessment saved'); load() }
      else message.error(r.error)
    } finally { setSaving(false) }
  }

  function newAssessment() {
    setSelected(null)
    setForm({ subjective: '', objective: '', assessment: '', plan: '', session_date: dayjs().format('YYYY-MM-DD') })
  }

  if (loading) return <Spin />

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ width: 200, flexShrink: 0 }}>
        <Button type="dashed" block onClick={newAssessment} style={{ marginBottom: 8 }}>+ New Assessment</Button>
        {assessments.map(a => (
          <div key={a.id}
            onClick={() => selectAssessment(a)}
            style={{
              padding: '8px 10px', cursor: 'pointer', borderRadius: 6, marginBottom: 4,
              background: selected?.id === a.id ? 'rgba(201,168,76,0.12)' : t.bgFill,
              border: selected?.id === a.id ? '1px solid rgba(201,168,76,0.4)' : `1px solid ${t.border}`
            }}
          >
            <div style={{ fontWeight: 500, fontSize: 13, color: t.text }}>{dayjs(a.session_date).format('DD MMM YYYY')}</div>
            <div style={{ fontSize: 11, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.subjective?.slice(0, 30) || 'No notes'}
            </div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <Card size="small" title="SOAP Notes" extra={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <DatePicker
              value={dayjs(form.session_date)}
              onChange={(d) => handleChange('session_date', d?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'))}
              format="DD/MM/YYYY"
              size="small"
            />
            <Button type="primary" icon={<SaveOutlined />} size="small" loading={saving} onClick={handleSave}>Save</Button>
          </div>
        }>
          {[
            { key: 'subjective', label: 'S — Subjective (Patient-Reported Symptoms)', placeholder: 'Patient describes pain, discomfort, concerns...' },
            { key: 'objective', label: 'O — Objective (Clinical Findings)', placeholder: 'Clinical examination findings, X-ray findings...' },
            { key: 'assessment', label: 'A — Assessment (Diagnosis)', placeholder: 'Diagnosis, differential diagnosis...' },
            { key: 'plan', label: 'P — Plan (Treatment Plan)', placeholder: 'Proposed treatment, follow-up instructions, prescriptions...' }
          ].map(field => (
            <div key={field.key} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#c9a84c', marginBottom: 4 }}>{field.label}</div>
              <Input.TextArea
                rows={3}
                placeholder={field.placeholder}
                value={(form as Record<string, string>)[field.key]}
                onChange={e => handleChange(field.key, e.target.value)}
              />
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
