import { useEffect, useState } from 'react'
import { Table, Tag, Button, Statistic, Row, Col, Card, Spin } from 'antd'
import type { Invoice, IpcResult } from '../../../../../shared/types'
import type { Route } from '../../../components/Layout/MainLayout'
import dayjs from 'dayjs'

interface Props { patientId: number; navigate: (r: Route) => void }

export default function BillingTab({ patientId, navigate }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const r = await window.api.billing.listInvoices({ patientId }) as IpcResult<Invoice[]>
      if (r.success && r.data) setInvoices(r.data)
      setLoading(false)
    }
    load()
  }, [patientId])

  if (loading) return <Spin />

  const totalBilled = invoices.reduce((s, i) => s + i.total_amount, 0)
  const totalPaid = invoices.reduce((s, i) => s + i.amount_paid, 0)
  const outstanding = totalBilled - totalPaid

  const STATUS_COLOR: Record<string, string> = { paid: 'green', partial: 'orange', unpaid: 'red', voided: 'default' }

  const columns = [
    { title: 'Invoice #', dataIndex: 'invoice_number', render: (v: string, r: Invoice) => (
      <Button type="link" style={{ padding: 0 }} onClick={() => navigate({ page: 'invoice-detail', id: r.id })}>{v}</Button>
    )},
    { title: 'Date', dataIndex: 'created_at', width: 110, render: (v: string) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Total', dataIndex: 'total_amount', width: 110, render: (v: number) => `₹${v.toLocaleString('en-IN')}` },
    { title: 'Paid', dataIndex: 'amount_paid', width: 110, render: (v: number) => `₹${v.toLocaleString('en-IN')}` },
    { title: 'Balance', width: 110, render: (_: unknown, r: Invoice) => `₹${(r.total_amount - r.amount_paid).toLocaleString('en-IN')}` },
    { title: 'Status', dataIndex: 'status', width: 100, render: (v: string) => <Tag color={STATUS_COLOR[v]}>{v.toUpperCase()}</Tag> }
  ]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { title: 'Total Billed', value: `₹${totalBilled.toLocaleString('en-IN')}`, color: '#1e3a8a' },
          { title: 'Total Paid', value: `₹${totalPaid.toLocaleString('en-IN')}`, color: '#16a34a' },
          { title: 'Outstanding', value: `₹${outstanding.toLocaleString('en-IN')}`, color: outstanding > 0 ? '#dc2626' : '#16a34a' }
        ].map((s, i) => (
          <Col span={8} key={i}>
            <Card size="small"><Statistic title={s.title} value={s.value} valueStyle={{ color: s.color, fontSize: 20 }} /></Card>
          </Col>
        ))}
      </Row>
      <div style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => navigate({ page: 'invoice-create', patientId })}>New Invoice</Button>
      </div>
      <Table dataSource={invoices} columns={columns} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
    </div>
  )
}
