import { useEffect, useState } from 'react'
import { Table, DatePicker, Card, Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import dayjs from 'dayjs'

interface Props { navigate: (r: Route) => void }

interface AuditEntry {
  id: number
  username?: string
  action: string
  entity_type: string
  entity_id?: number
  performed_at: string
}

export default function AuditLog({ navigate }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<{ dateFrom?: string; dateTo?: string }>({})

  async function load() {
    setLoading(true)
    const r = await window.api.settings.getAuditLog(filters) as IpcResult<AuditEntry[]>
    if (r.success && r.data) setEntries(r.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [filters])

  const columns = [
    { title: 'Timestamp', dataIndex: 'performed_at', width: 160, render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm:ss') },
    { title: 'User', dataIndex: 'username', width: 120 },
    { title: 'Action', dataIndex: 'action', width: 120 },
    { title: 'Entity Type', dataIndex: 'entity_type', width: 120 },
    { title: 'Entity ID', dataIndex: 'entity_id', width: 90, render: (v: number) => v || '—' }
  ]

  return (
    <Card title="Audit Log">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <DatePicker placeholder="From date" format="DD/MM/YYYY" onChange={d => setFilters(f => ({ ...f, dateFrom: d?.format('YYYY-MM-DD') }))} />
        <DatePicker placeholder="To date" format="DD/MM/YYYY" onChange={d => setFilters(f => ({ ...f, dateTo: d?.format('YYYY-MM-DD') }))} />
        <Button icon={<ReloadOutlined />} onClick={load} />
      </div>
      <Table dataSource={entries} columns={columns} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 30 }} />
    </Card>
  )
}
