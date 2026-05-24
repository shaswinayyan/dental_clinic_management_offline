import { useEffect, useState } from 'react'
import { Table, Button, Input, Tag, Card, Modal, Avatar, Space } from 'antd'
import { PlusOutlined, SearchOutlined, PhoneOutlined } from '@ant-design/icons'
import type { Patient, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import { useT } from '../../hooks/useT'
import PatientForm from './PatientForm'

interface Props { navigate: (r: Route) => void }

const GENDER_COLOR: Record<string, string> = { Male: 'blue', Female: 'pink', Other: 'purple' }

function avatarColor(name: string) {
  // rgba-based: readable in both light and dark mode
  const hues = [
    { bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6' },
    { bg: 'rgba(34,197,94,0.15)',   text: '#16a34a' },
    { bg: 'rgba(139,92,246,0.15)', text: '#7c3aed' },
    { bg: 'rgba(217,119,6,0.15)',   text: '#d97706' },
    { bg: 'rgba(220,38,38,0.15)',   text: '#dc2626' },
    { bg: 'rgba(8,145,178,0.15)',   text: '#0891b2' },
  ]
  const i = name.charCodeAt(0) % hues.length
  return { bg: hues[i].bg, text: hues[i].text }
}

export default function PatientList({ navigate }: Props) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const t = useT()

  async function load(s = '') {
    setLoading(true)
    const r = await window.api.patients.list(s || undefined) as IpcResult<Patient[]>
    if (r.success && r.data) setPatients(r.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function handleSearch(v: string) { setSearch(v); load(v) }

  const columns = [
    {
      title: 'Patient Name', dataIndex: 'name',
      render: (v: string, r: Patient) => {
        const { bg, text } = avatarColor(v ?? 'P')
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar size={34} style={{ background: bg, color: text, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
              {v?.charAt(0)?.toUpperCase() ?? 'P'}
            </Avatar>
            <div>
              <Button type="link" style={{ padding: 0, fontWeight: 600, fontSize: 13.5 }}
                onClick={() => navigate({ page: 'patient-detail', id: r.id })}>{v}</Button>
              <div style={{ fontSize: 11, color: t.textHint }}>{r.op_id}</div>
            </div>
          </div>
        )
      }
    },
    {
      title: 'Contact', dataIndex: 'contact_number', width: 150,
      render: (v: string) => (
        <span style={{ color: t.textSub, fontSize: 13 }}>
          <PhoneOutlined style={{ marginRight: 5, color: t.textHint }} />{v || '—'}
        </span>
      )
    },
    {
      title: 'Gender', dataIndex: 'gender', width: 90,
      render: (v: string) => v
        ? <Tag color={GENDER_COLOR[v] ?? 'default'} style={{ borderRadius: 20, fontSize: 11 }}>{v}</Tag>
        : '—'
    },
    {
      title: 'Blood Group', dataIndex: 'blood_group', width: 100,
      render: (v: string) => v ? <Tag color="red" style={{ borderRadius: 20, fontWeight: 700 }}>{v}</Tag> : '—'
    },
    {
      title: 'Registered', dataIndex: 'created_at', width: 120,
      render: (v: string) => <span style={{ color: t.textSub, fontSize: 12 }}>{new Date(v).toLocaleDateString('en-IN')}</span>
    },
    {
      title: '', width: 90,
      render: (_: unknown, r: Patient) => (
        <Button size="small" type="primary" style={{ borderRadius: 6, fontSize: 12 }}
          onClick={() => navigate({ page: 'patient-detail', id: r.id })}>
          View
        </Button>
      )
    }
  ]

  return (
    <Card style={{ border: `1px solid ${t.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Input.Search
            placeholder="Search by name, OP ID, or phone..."
            prefix={<SearchOutlined style={{ color: t.textHint }} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 320 }}
            allowClear
          />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowForm(true)}>Register Patient</Button>
      </div>
      <Table
        dataSource={patients}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${total} patients`, size: 'small' }}
        locale={{ emptyText: 'No patients found' }}
      />
      <Modal
        open={showForm}
        title="Register New Patient"
        footer={null}
        onCancel={() => setShowForm(false)}
        width={600}
        destroyOnClose
      >
        <PatientForm
          onSuccess={(patient) => {
            setShowForm(false)
            load(search)
            navigate({ page: 'patient-detail', id: patient.id })
          }}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </Card>
  )
}
