import { useEffect, useState } from 'react'
import { Button, Modal, Form, Select, Input, DatePicker, message, Image, Spin, Tag, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { PatientImage, Patient, IpcResult } from '../../../../../shared/types'
import { useAuthStore } from '../../../store/authStore'
import dayjs from 'dayjs'

interface Props { patientId: number; patient: Patient }

const IMAGE_TYPES = [
  { value: 'xray', label: 'X-Ray' },
  { value: 'intraoral_photo', label: 'Intraoral Photo' },
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
  { value: 'other', label: 'Other' }
]

export default function ImagesTab({ patientId, patient }: Props) {
  const [images, setImages] = useState<PatientImage[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const { user } = useAuthStore()

  async function load() {
    setLoading(true)
    const r = await window.api.patients.listImages(patientId) as IpcResult<PatientImage[]>
    if (r.success && r.data) setImages(r.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [patientId])

  async function handleSelectAndUpload() {
    const r = await window.api.settings.selectImageFile() as IpcResult<string>
    if (!r.success || !r.data) return
    form.setFieldValue('_src_path', r.data)
  }

  async function handleAdd(values: { image_type: string; procedure_tag?: string; tooth_number?: string; notes?: string; capture_date?: dayjs.Dayjs; _src_path?: string }) {
    if (!user) return
    if (!values._src_path) { message.error('Please select an image file'); return }
    setSaving(true)
    try {
      const copyResult = await window.api.settings.copyImageToStore(values._src_path, patient.op_id) as IpcResult<string>
      if (!copyResult.success || !copyResult.data) { message.error('Failed to copy image'); setSaving(false); return }

      const r = await window.api.patients.addImage({
        patient_id: patientId,
        file_path: copyResult.data,
        image_type: values.image_type as PatientImage['image_type'],
        procedure_tag: values.procedure_tag,
        tooth_number: values.tooth_number,
        notes: values.notes,
        capture_date: values.capture_date?.format('YYYY-MM-DD'),
        uploaded_by: user.id
      }) as IpcResult
      if (r.success) { message.success('Image uploaded'); setShowForm(false); form.resetFields(); load() }
      else message.error(r.error)
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    const r = await window.api.patients.deleteImage(id) as IpcResult
    if (r.success) { message.success('Image deleted'); load() }
    else message.error(r.error)
  }

  if (loading) return <Spin />

  // Group by capture_date
  const grouped = images.reduce((acc, img) => {
    const key = img.capture_date || dayjs(img.uploaded_at).format('YYYY-MM-DD')
    if (!acc[key]) acc[key] = []
    acc[key].push(img)
    return acc
  }, {} as Record<string, PatientImage[]>)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setShowForm(true)}>Upload Image</Button>
      </div>

      {Object.keys(grouped).sort().reverse().map(date => (
        <div key={date} style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 600, color: '#1e3a8a', marginBottom: 8 }}>{dayjs(date).format('DD MMM YYYY')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {grouped[date].map(img => (
              <div key={img.id} style={{ position: 'relative', textAlign: 'center' }}>
                <Image
                  src={`file://${img.file_path}`}
                  width={100}
                  height={80}
                  style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }}
                  alt={img.image_type}
                  fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                />
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                  <Tag style={{ fontSize: 10 }}>{img.image_type}</Tag>
                </div>
                {img.tooth_number && <div style={{ fontSize: 10, color: '#94a3b8' }}>Tooth {img.tooth_number}</div>}
                <Popconfirm title="Delete this image?" onConfirm={() => handleDelete(img.id)}>
                  <Button type="text" icon={<DeleteOutlined />} size="small" danger style={{ position: 'absolute', top: 0, right: 0 }} />
                </Popconfirm>
              </div>
            ))}
          </div>
        </div>
      ))}

      {images.length === 0 && <div style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>No images uploaded yet.</div>}

      <Modal open={showForm} title="Upload Clinical Image" footer={null} onCancel={() => setShowForm(false)} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item label="Image File" required>
            <Button onClick={handleSelectAndUpload}>Choose File</Button>
            <Form.Item name="_src_path" noStyle>
              <Input style={{ display: 'none' }} />
            </Form.Item>
          </Form.Item>
          <Form.Item name="image_type" label="Image Type" rules={[{ required: true }]}>
            <Select options={IMAGE_TYPES} />
          </Form.Item>
          <Form.Item name="capture_date" label="Date of Capture">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="procedure_tag" label="Procedure">
            <Input placeholder="e.g. Root Canal Treatment" />
          </Form.Item>
          <Form.Item name="tooth_number" label="Tooth Number (FDI)">
            <Input placeholder="e.g. 46" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Upload</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
