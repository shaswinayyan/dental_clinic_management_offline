import { useEffect, useState } from 'react'
import { Table, Tag, Button, Select, DatePicker, Input, Space, Card, message, Modal, Form, Popconfirm, InputNumber } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import type { Appointment, Chair, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import dayjs from 'dayjs'

interface Props { navigate: (r: Route) => void }

const STATUS_COLOR: Record<string, string> = {
  scheduled: 'blue', confirmed: 'green', pending: 'orange',
  completed: 'default', cancelled: 'red', rescheduled: 'purple'
}

export default function AppointmentList({ navigate }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [chairs, setChairs] = useState<Chair[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<{ dateFrom?: string; dateTo?: string; chairId?: number; status?: string; search?: string }>({})
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null)
  const [rescheduleForm] = Form.useForm()

  async function load() {
    setLoading(true)
    const [apptRes, chairRes] = await Promise.all([
      window.api.appointments.list(filters) as Promise<IpcResult<Appointment[]>>,
      window.api.appointments.listChairs() as Promise<IpcResult<Chair[]>>
    ])
    if (apptRes.success && apptRes.data) {
      let data = apptRes.data
      if (filters.search) {
        const s = filters.search.toLowerCase()
        data = data.filter(a => a.patient_name?.toLowerCase().includes(s) || a.patient_op_id?.toLowerCase().includes(s))
      }
      setAppointments(data)
    }
    if (chairRes.success && chairRes.data) setChairs(chairRes.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [filters])

  async function handleStatusChange(id: number, status: string) {
    const r = await window.api.appointments.updateStatus(id, status) as IpcResult
    if (r.success) load()
    else message.error(r.error)
  }

  async function handleReschedule(values: { new_datetime: dayjs.Dayjs; duration: number }) {
    if (!rescheduleAppt) return
    const r = await window.api.appointments.reschedule(
      rescheduleAppt.id,
      values.new_datetime.format('YYYY-MM-DDTHH:mm:ss'),
      values.duration
    ) as IpcResult<number>
    if (r.success) { message.success('Appointment rescheduled'); setRescheduleAppt(null); rescheduleForm.resetFields(); load() }
    else message.error(r.error)
  }

  const columns = [
    { title: 'Date & Time', dataIndex: 'scheduled_at', sorter: true, width: 150, render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm') },
    { title: 'Patient', dataIndex: 'patient_name', render: (v: string, r: Appointment) => (
      <Button type="link" style={{ padding: 0 }} onClick={() => navigate({ page: 'patient-detail', id: r.patient_id })}>{v}</Button>
    )},
    { title: 'OP ID', dataIndex: 'patient_op_id', width: 130, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
    { title: 'Chair', dataIndex: 'chair_name', width: 130 },
    { title: 'Treatment', dataIndex: 'treatment_name', ellipsis: true },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v: string) => <Tag color={STATUS_COLOR[v]}>{v.toUpperCase()}</Tag> },
    {
      title: 'Actions', width: 260,
      render: (_: unknown, r: Appointment) => {
        const canAct = ['scheduled', 'confirmed', 'pending'].includes(r.status)
        return (
          <Space size={4}>
            {r.status === 'scheduled' && <Button size="small" onClick={() => handleStatusChange(r.id, 'confirmed')}>Confirm</Button>}
            {r.status === 'scheduled' && <Button size="small" onClick={() => handleStatusChange(r.id, 'pending')}>Pending</Button>}
            {canAct && <Button size="small" onClick={() => handleStatusChange(r.id, 'completed')} style={{ color: '#16a34a' }}>Complete</Button>}
            {canAct && <Button size="small" onClick={() => { setRescheduleAppt(r); rescheduleForm.setFieldValue('duration', r.duration_minutes) }}>Reschedule</Button>}
            {canAct && <Popconfirm title="Cancel this appointment?" onConfirm={() => handleStatusChange(r.id, 'cancelled')}><Button size="small" danger>Cancel</Button></Popconfirm>}
          </Space>
        )
      }
    }
  ]

  return (
    <Card>
      <Space wrap style={{ marginBottom: 16 }}>
        <DatePicker placeholder="From date" format="DD/MM/YYYY" onChange={d => setFilters(f => ({ ...f, dateFrom: d?.format('YYYY-MM-DD') }))} />
        <DatePicker placeholder="To date" format="DD/MM/YYYY" onChange={d => setFilters(f => ({ ...f, dateTo: d?.format('YYYY-MM-DD') }))} />
        <Select placeholder="Chair" style={{ width: 150 }} allowClear onChange={v => setFilters(f => ({ ...f, chairId: v }))}
          options={[{ value: undefined, label: 'All Chairs' }, ...chairs.map(c => ({ value: c.id, label: c.name }))]} />
        <Select placeholder="Status" style={{ width: 130 }} allowClear onChange={v => setFilters(f => ({ ...f, status: v }))}
          options={['scheduled', 'confirmed', 'pending', 'completed', 'cancelled', 'rescheduled'].map(s => ({ value: s, label: s }))} />
        <Input.Search placeholder="Search patient..." prefix={<SearchOutlined />} onSearch={v => setFilters(f => ({ ...f, search: v }))} allowClear style={{ width: 240 }} />
        <Button icon={<ReloadOutlined />} onClick={load} />
      </Space>
      <Table
        dataSource={appointments}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20, showTotal: t => `${t} appointments` }}
      />

      <Modal open={!!rescheduleAppt} title="Reschedule Appointment" footer={null} onCancel={() => setRescheduleAppt(null)} destroyOnClose>
        <Form form={rescheduleForm} layout="vertical" onFinish={handleReschedule}>
          <Form.Item name="new_datetime" label="New Date & Time" rules={[{ required: true }]}>
            <DatePicker showTime={{ format: 'HH:mm', minuteStep: 15 }} format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="duration" label="Duration (minutes)" rules={[{ required: true }]}>
            <InputNumber min={5} max={480} step={15} style={{ width: '100%' }} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setRescheduleAppt(null)}>Cancel</Button>
            <Button type="primary" htmlType="submit">Reschedule</Button>
          </div>
        </Form>
      </Modal>
    </Card>
  )
}
