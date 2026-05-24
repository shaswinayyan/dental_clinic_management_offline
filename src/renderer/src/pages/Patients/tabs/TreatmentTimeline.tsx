import { useEffect, useState } from 'react'
import { Card, Tag, Button, Collapse, Image, Spin, Select, DatePicker, Input, Row, Col } from 'antd'
import { CalendarOutlined, DollarOutlined, FileImageOutlined } from '@ant-design/icons'
import type { IpcResult } from '../../../../../shared/types'
import type { Route } from '../../../components/Layout/MainLayout'
import { useT } from '../../../hooks/useT'
import dayjs from 'dayjs'

interface TimelineEntry {
  id: number
  treatment_name: string
  tooth_area?: string
  treated_at: string
  status: string
  chair_name?: string
  doctor_name?: string
  notes?: string
  images: { id: number; file_path: string; image_type: string }[]
  assessment?: { subjective?: string; objective?: string; assessment?: string; plan?: string }
  invoice?: { id: number; invoice_number: string; total_amount: number }
}

interface Props { patientId: number; navigate: (r: Route) => void }

export default function TreatmentTimeline({ patientId, navigate }: Props) {
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [filtered, setFiltered] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ search: '', status: '', dateFrom: '', dateTo: '' })
  const t = useT()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const r = await window.api.patients.getTimeline(patientId) as IpcResult<TimelineEntry[]>
      if (r.success && r.data) { setEntries(r.data); setFiltered(r.data) }
      setLoading(false)
    }
    load()
  }, [patientId])

  function applyFilters(f: typeof filter, data = entries) {
    let result = [...data]
    if (f.search) result = result.filter(e => e.treatment_name.toLowerCase().includes(f.search.toLowerCase()) || e.tooth_area?.toLowerCase().includes(f.search.toLowerCase()))
    if (f.status) result = result.filter(e => e.status === f.status)
    if (f.dateFrom) result = result.filter(e => e.treated_at >= f.dateFrom)
    if (f.dateTo) result = result.filter(e => e.treated_at <= f.dateTo + 'T23:59:59')
    setFiltered(result)
  }

  function updateFilter(key: string, value: string) {
    const newFilter = { ...filter, [key]: value }
    setFilter(newFilter)
    applyFilters(newFilter)
  }

  const STATUS_COLOR: Record<string, string> = { completed: 'green', ongoing: 'orange', planned: 'default' }

  const planned = filtered.filter(e => e.status === 'planned')
  const done = filtered.filter(e => e.status !== 'planned')

  if (loading) return <Spin />

  function renderEntry(e: TimelineEntry) {
    return (
      <div key={e.id} className={`timeline-card ${e.status === 'planned' ? 'timeline-card-planned' : ''}`}
        style={{ background: t.bg, borderRadius: 8, padding: '16px', marginBottom: 12, border: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <CalendarOutlined style={{ color: '#c9a84c' }} />
              <span style={{ fontWeight: 600, color: '#c9a84c' }}>{dayjs(e.treated_at).format('DD MMM YYYY')}</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{e.treatment_name}</span>
              {e.tooth_area && <Tag>{e.tooth_area}</Tag>}
              <Tag color={STATUS_COLOR[e.status]}>{e.status}</Tag>
            </div>
            <div style={{ fontSize: 12, color: t.textSub }}>
              {e.chair_name && <span>{e.chair_name} • </span>}
              {e.doctor_name && <span>Dr. {e.doctor_name}</span>}
            </div>
          </div>
          {e.invoice && (
            <Button type="link" icon={<DollarOutlined />} onClick={() => navigate({ page: 'invoice-detail', id: e.invoice!.id })} style={{ padding: 0 }}>
              ₹{e.invoice.total_amount.toLocaleString('en-IN')}
            </Button>
          )}
        </div>

        {e.notes && <div style={{ marginTop: 8, color: t.textSub, fontStyle: 'italic', fontSize: 13 }}>"{e.notes}"</div>}

        {e.assessment && (e.assessment.subjective || e.assessment.plan) && (
          <Collapse ghost size="small" style={{ marginTop: 8 }} items={[{
            key: 'soap', label: <span style={{ fontSize: 12, color: '#c9a84c' }}>SOAP Notes</span>,
            children: (
              <div style={{ fontSize: 12 }}>
                {e.assessment.subjective && <div><strong>S:</strong> {e.assessment.subjective}</div>}
                {e.assessment.objective && <div><strong>O:</strong> {e.assessment.objective}</div>}
                {e.assessment.assessment && <div><strong>A:</strong> {e.assessment.assessment}</div>}
                {e.assessment.plan && <div><strong>P:</strong> {e.assessment.plan}</div>}
              </div>
            )
          }]} />
        )}

        {e.images.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <FileImageOutlined style={{ color: t.textHint, marginTop: 4 }} />
            <Image.PreviewGroup>
              {e.images.map(img => (
                <Image key={img.id} src={`file://${img.file_path}`} width={80} height={60}
                  style={{ objectFit: 'cover', borderRadius: 4 }}
                  fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />
              ))}
            </Image.PreviewGroup>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={12}>
          <Col span={8}>
            <Input placeholder="Search procedure or tooth..." value={filter.search} onChange={e => updateFilter('search', e.target.value)} />
          </Col>
          <Col span={4}>
            <Select placeholder="Status" style={{ width: '100%' }} allowClear onChange={v => updateFilter('status', v ?? '')}
              options={[{ value: 'completed', label: 'Completed' }, { value: 'ongoing', label: 'Ongoing' }, { value: 'planned', label: 'Planned' }]} />
          </Col>
          <Col span={5}>
            <DatePicker placeholder="From date" format="DD/MM/YYYY" style={{ width: '100%' }}
              onChange={d => updateFilter('dateFrom', d?.format('YYYY-MM-DD') ?? '')} />
          </Col>
          <Col span={5}>
            <DatePicker placeholder="To date" format="DD/MM/YYYY" style={{ width: '100%' }}
              onChange={d => updateFilter('dateTo', d?.format('YYYY-MM-DD') ?? '')} />
          </Col>
          <Col span={2}>
            <Button onClick={() => { setFilter({ search: '', status: '', dateFrom: '', dateTo: '' }); setFiltered(entries) }}>Clear</Button>
          </Col>
        </Row>
      </Card>

      {planned.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#d97706', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarOutlined /> UPCOMING ({planned.length})
          </div>
          {planned.map(renderEntry)}
        </div>
      )}

      {done.length > 0 ? done.map(renderEntry) : (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>No treatment history found.</div>
      )}
    </div>
  )
}
