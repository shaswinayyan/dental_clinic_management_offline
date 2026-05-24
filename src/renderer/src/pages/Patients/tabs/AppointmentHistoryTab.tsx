import { useEffect, useState } from 'react'
import { Table, Tag, Button, Spin } from 'antd'
import type { Appointment, IpcResult } from '../../../../../shared/types'
import type { Route } from '../../../components/Layout/MainLayout'
import dayjs from 'dayjs'

interface Props { patientId: number; navigate: (r: Route) => void }

export default function AppointmentHistoryTab({ patientId, navigate }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const r = await window.api.appointments.list({ patientId }) as IpcResult<Appointment[]>
      if (r.success && r.data) setAppointments(r.data)
      setLoading(false)
    }
    load()
  }, [patientId])

  const STATUS_COLOR: Record<string, string> = {
    scheduled: 'blue', confirmed: 'green', pending: 'orange',
    completed: 'default', cancelled: 'red', rescheduled: 'purple'
  }

  const columns = [
    { title: 'Date & Time', dataIndex: 'scheduled_at', width: 150, render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm') },
    { title: 'Chair', dataIndex: 'chair_name', width: 120 },
    { title: 'Treatment', dataIndex: 'treatment_name' },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v: string) => <Tag color={STATUS_COLOR[v]}>{v.toUpperCase()}</Tag> },
    { title: 'Notes', dataIndex: 'notes', ellipsis: true, render: (v: string) => v || '—' }
  ]

  if (loading) return <Spin />

  return (
    <Table dataSource={appointments} columns={columns} rowKey="id" size="small" pagination={{ pageSize: 15 }}
      locale={{ emptyText: 'No appointment history' }} />
  )
}
