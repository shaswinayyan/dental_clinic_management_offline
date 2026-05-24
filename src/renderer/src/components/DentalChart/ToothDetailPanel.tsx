import { useEffect, useState } from 'react'
import { Card, Tag, Button, Form, Input, Select, DatePicker, Space, Timeline, message, Divider } from 'antd'
import { CloseOutlined, PlusOutlined, CheckCircleFilled, ClockCircleFilled, SyncOutlined } from '@ant-design/icons'
import type { DentalChartEntry, Treatment, IpcResult } from '../../../../shared/types'
import { useAuthStore } from '../../store/authStore'
import { useT } from '../../hooks/useT'
import dayjs from 'dayjs'

interface Props {
  toothNumber: number
  toothName?: string
  patientId: number
  entries: DentalChartEntry[]
  onClose: () => void
  onEntryAdded: () => void
  readOnly?: boolean
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircleFilled style={{ color: '#22c55e' }} />,
  planned:   <ClockCircleFilled style={{ color: '#f97316' }} />,
  ongoing:   <SyncOutlined style={{ color: '#eab308' }} />,
}

const STATUS_COLOR: Record<string, string> = {
  completed: 'success', planned: 'warning', ongoing: 'processing'
}

const PROCEDURE_TYPES = [
  'Filling', 'Composite Filling', 'GIC Filling', 'Amalgam Filling',
  'Extraction', 'Surgical Extraction',
  'Crown', 'Zirconia Crown', 'PFM Crown', 'Bridge',
  'Root Canal Treatment (RCT)', 'Pulpotomy',
  'Implant', 'Implant Crown',
  'Scaling & Polishing', 'Deep Scaling',
  'Bleaching / Whitening', 'Veneer',
  'Orthodontic Bracket', 'Retainer',
  'Healthy / No Treatment', 'Missing / Extracted',
  'Other'
]

export default function ToothDetailPanel({
  toothNumber, toothName, patientId, entries, onClose, onEntryAdded, readOnly
}: Props) {
  const [form] = Form.useForm()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [useFromCatalogue, setUseFromCatalogue] = useState(false)
  const { user } = useAuthStore()
  const t = useT()

  // Load treatment catalogue for linking
  useEffect(() => {
    window.api.appointments.listTreatments().then((r) => {
      const result = r as IpcResult<Treatment[]>
      if (result.success && result.data) setTreatments(result.data)
    })
  }, [])

  function handleCatalogueSelect(treatmentId: number) {
    const t = treatments.find(t => t.id === treatmentId)
    if (t) {
      form.setFieldValue('procedure_type', t.name)
    }
  }

  async function handleAdd(values: {
    procedure_type: string
    surface: string
    status: string
    notes?: string
    done_at?: dayjs.Dayjs
  }) {
    if (!user) return
    setSaving(true)
    try {
      const r = await window.api.patients.addChartEntry({
        patient_id: patientId,
        tooth_number: String(toothNumber),
        surface: values.surface as DentalChartEntry['surface'],
        procedure_type: values.procedure_type,
        status: values.status as DentalChartEntry['status'],
        notes: values.notes,
        done_at: values.done_at?.format('YYYY-MM-DD'),
        created_by: user.id
      }) as IpcResult
      if (r.success) {
        message.success('Chart entry added')
        form.resetFields()
        setShowForm(false)
        setUseFromCatalogue(false)
        onEntryAdded()
      } else {
        message.error(r.error || 'Failed to add entry')
      }
    } finally {
      setSaving(false)
    }
  }

  const pendingEntries   = entries.filter(e => e.status === 'planned' || e.status === 'ongoing')
  const completedEntries = entries.filter(e => e.status === 'completed')

  return (
    <Card
      size="small"
      styles={{ header: { padding: '8px 14px' }, body: { padding: '14px' } }}
      title={
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: t.text }}>
            #{toothNumber} — {toothName ?? `Tooth ${toothNumber}`}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {pendingEntries.length > 0 && (
              <Tag color="orange" style={{ fontSize: 10, borderRadius: 20, margin: 0 }}>
                {pendingEntries.length} pending
              </Tag>
            )}
            {completedEntries.length > 0 && (
              <Tag color="green" style={{ fontSize: 10, borderRadius: 20, margin: 0 }}>
                {completedEntries.length} done
              </Tag>
            )}
            {entries.length === 0 && (
              <Tag color="default" style={{ fontSize: 10, borderRadius: 20, margin: 0 }}>No procedures</Tag>
            )}
          </div>
        </div>
      }
      extra={<Button type="text" icon={<CloseOutlined />} onClick={onClose} size="small" />}
    >
      {/* Pending treatments */}
      {pendingEntries.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Pending / Prescribed
          </div>
          <Timeline
            items={pendingEntries.map(e => ({
              dot: STATUS_ICON[e.status],
              children: (
                <div style={{ fontSize: 12.5 }}>
                  <div style={{ fontWeight: 600, color: t.text }}>{e.procedure_type}</div>
                  <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>
                    {e.surface.charAt(0).toUpperCase() + e.surface.slice(1)} surface
                    {' · '}
                    <Tag color={STATUS_COLOR[e.status]} style={{ fontSize: 10, borderRadius: 20 }}>{e.status}</Tag>
                  </div>
                  {e.notes && <div style={{ fontSize: 11, color: t.textSub, marginTop: 2, fontStyle: 'italic' }}>{e.notes}</div>}
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>By: {e.created_by_name}</div>
                </div>
              )
            }))}
          />
        </div>
      )}

      {/* Completed treatments */}
      {completedEntries.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Completed
          </div>
          <Timeline
            items={completedEntries.map(e => ({
              dot: <CheckCircleFilled style={{ color: '#22c55e' }} />,
              children: (
                <div style={{ fontSize: 12.5 }}>
                  <div style={{ fontWeight: 600, color: t.text }}>{e.procedure_type}</div>
                  <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>
                    {e.surface.charAt(0).toUpperCase() + e.surface.slice(1)} surface
                    {e.done_at && ` · ${dayjs(e.done_at).format('DD MMM YYYY')}`}
                  </div>
                  {e.notes && <div style={{ fontSize: 11, color: t.textSub, marginTop: 2, fontStyle: 'italic' }}>{e.notes}</div>}
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>By: {e.created_by_name}</div>
                </div>
              )
            }))}
          />
        </div>
      )}

      {entries.length === 0 && (
        <div style={{ color: '#94a3b8', fontSize: 13, padding: '8px 0 12px', textAlign: 'center' }}>
          No procedures recorded for this tooth.
        </div>
      )}

      {/* Add procedure form */}
      {!readOnly && (
        <>
          {!showForm ? (
            <Button size="small" icon={<PlusOutlined />} onClick={() => setShowForm(true)} type="dashed" block>
              Add Procedure
            </Button>
          ) : (
            <div style={{ background: t.bgFill, borderRadius: 8, padding: 12, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 10 }}>
                Add Procedure to #{toothNumber}
              </div>

              {/* Link from treatment catalogue toggle */}
              <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button
                  size="small"
                  type={useFromCatalogue ? 'primary' : 'default'}
                  onClick={() => setUseFromCatalogue(v => !v)}
                  style={{ fontSize: 11 }}
                >
                  {useFromCatalogue ? '✓ From Catalogue' : 'Link from Catalogue'}
                </Button>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>or type freely below</span>
              </div>

              {useFromCatalogue && (
                <div style={{ marginBottom: 10 }}>
                  <Select
                    showSearch
                    placeholder="Select treatment from catalogue..."
                    style={{ width: '100%' }}
                    size="small"
                    filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                    options={treatments.map(t => ({ value: t.id, label: `${t.name} — ₹${t.default_price}` }))}
                    onChange={handleCatalogueSelect}
                  />
                </div>
              )}

              <Form form={form} layout="vertical" size="small" onFinish={handleAdd}>
                <Form.Item name="procedure_type" label="Procedure" rules={[{ required: true }]}>
                  <Select
                    placeholder="Select or type procedure"
                    showSearch
                    options={PROCEDURE_TYPES.map(p => ({ value: p, label: p }))}
                  />
                </Form.Item>
                <Form.Item name="surface" label="Surface" rules={[{ required: true }]}>
                  <Select options={[
                    { value: 'buccal', label: 'Buccal / Labial (outer)' },
                    { value: 'lingual', label: 'Lingual / Palatal (inner)' },
                    { value: 'mesial', label: 'Mesial (front)' },
                    { value: 'distal', label: 'Distal (back)' },
                    { value: 'occlusal', label: 'Occlusal / Incisal (top)' },
                    { value: 'full', label: 'Full Tooth' },
                  ]} />
                </Form.Item>
                <Form.Item name="status" label="Status" initialValue="planned"
                  extra={<span style={{ fontSize: 10, color: '#94a3b8' }}>Use "Planned" for prescriptions; "Completed" after treatment</span>}
                >
                  <Select options={[
                    { value: 'planned', label: '🕐 Planned / Prescribed' },
                    { value: 'ongoing', label: '⚙️ Ongoing / In Progress' },
                    { value: 'completed', label: '✅ Completed' },
                  ]} />
                </Form.Item>
                <Form.Item name="done_at" label="Date">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
                <Form.Item name="notes" label="Clinical Notes">
                  <Input.TextArea rows={2} placeholder="Observations, materials used, etc..." />
                </Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" loading={saving} size="small">Save Entry</Button>
                  <Button size="small" onClick={() => { setShowForm(false); form.resetFields(); setUseFromCatalogue(false) }}>Cancel</Button>
                </Space>
              </Form>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
