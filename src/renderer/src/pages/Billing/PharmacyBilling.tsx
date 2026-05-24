import { useEffect, useState } from 'react'
import { Card, Table, Button, Tag, Input, DatePicker, Select, Space, Row, Col, Statistic } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { Invoice, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import { useT } from '../../hooks/useT'
import dayjs from 'dayjs'

interface Props { navigate: (r: Route) => void }

const STATUS_COLOR: Record<string, string> = { paid: 'green', partial: 'orange', unpaid: 'red', voided: 'default' }

export default function PharmacyBilling({ navigate }: Props) {
  const t = useT()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | undefined>()
  const [dateFrom, setDateFrom] = useState<string | undefined>()
  const [dateTo, setDateTo] = useState<string | undefined>()

  async function load() {
    setLoading(true)
    const r = await window.api.billing.listInvoices({
      billing_type: 'pharmacy', status, dateFrom, dateTo
    }) as IpcResult<Invoice[]>
    if (r.success && r.data) setInvoices(r.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [status, dateFrom, dateTo])

  const filtered = search
    ? invoices.filter(i =>
        i.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
        i.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
        i.patient_op_id?.toLowerCase().includes(search.toLowerCase())
      )
    : invoices

  const totals = {
    total: filtered.reduce((s, i) => s + i.total_amount, 0),
    paid: filtered.reduce((s, i) => s + i.amount_paid, 0),
    outstanding: filtered
      .filter(i => i.status !== 'paid' && i.status !== 'voided')
      .reduce((s, i) => s + (i.total_amount - i.amount_paid), 0),
    count: filtered.length
  }

  const columns = [
    {
      title: 'Invoice #',
      dataIndex: 'invoice_number',
      render: (v: string) => <code style={{ color: t.primary }}>{v}</code>
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      width: 130,
      render: (v: string) => <span style={{ color: t.textSub }}>{dayjs(v).format('DD MMM YYYY')}</span>
    },
    {
      title: 'Patient',
      dataIndex: 'patient_name',
      render: (v: string, r: Invoice) => (
        <div>
          <div style={{ fontWeight: 600, color: t.text }}>{v}</div>
          <div style={{ fontSize: 12, color: t.textSub }}>{r.patient_op_id}</div>
        </div>
      )
    },
    {
      title: 'Total',
      dataIndex: 'total_amount',
      width: 120,
      render: (v: number) => <strong style={{ color: t.text }}>₹{v.toLocaleString('en-IN')}</strong>
    },
    {
      title: 'Paid',
      dataIndex: 'amount_paid',
      width: 110,
      render: (v: number) => <span style={{ color: t.success }}>₹{v.toLocaleString('en-IN')}</span>
    },
    {
      title: 'Balance',
      width: 110,
      render: (_: unknown, r: Invoice) => {
        const bal = r.total_amount - r.amount_paid
        return <span style={{ color: bal > 0 ? t.error : t.success }}>₹{bal.toLocaleString('en-IN')}</span>
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <Tag color={STATUS_COLOR[v]}>{v.toUpperCase()}</Tag>
    },
    {
      title: '',
      width: 80,
      render: (_: unknown, r: Invoice) => (
        <Button size="small" onClick={e => { e.stopPropagation(); navigate({ page: 'invoice-detail', id: r.id }) }}>
          View
        </Button>
      )
    }
  ]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ background: t.bg, border: `1px solid ${t.border}` }}>
            <Statistic
              title={<span style={{ color: t.textSub }}>Total Billed</span>}
              value={`₹${totals.total.toLocaleString('en-IN')}`}
              valueStyle={{ color: t.text, fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: t.bg, border: `1px solid ${t.border}` }}>
            <Statistic
              title={<span style={{ color: t.textSub }}>Collected</span>}
              value={`₹${totals.paid.toLocaleString('en-IN')}`}
              valueStyle={{ color: t.success, fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: t.bg, border: `1px solid ${t.border}` }}>
            <Statistic
              title={<span style={{ color: t.textSub }}>Outstanding</span>}
              value={`₹${totals.outstanding.toLocaleString('en-IN')}`}
              valueStyle={{ color: t.error, fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: t.bg, border: `1px solid ${t.border}` }}>
            <Statistic
              title={<span style={{ color: t.textSub }}>Total Bills</span>}
              value={totals.count}
              valueStyle={{ color: t.text, fontSize: 18 }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ background: t.bg, border: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <Space wrap>
            <Input
              placeholder="Search patient, invoice #..."
              prefix={<SearchOutlined style={{ color: t.textSub }} />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
            <Select
              placeholder="Status"
              allowClear
              style={{ width: 130 }}
              onChange={v => setStatus(v)}
              options={[
                { value: 'unpaid', label: 'Unpaid' },
                { value: 'partial', label: 'Partial' },
                { value: 'paid', label: 'Paid' },
                { value: 'voided', label: 'Voided' }
              ]}
            />
            <DatePicker placeholder="From date" onChange={v => setDateFrom(v ? v.format('YYYY-MM-DD') : undefined)} />
            <DatePicker placeholder="To date" onChange={v => setDateTo(v ? v.format('YYYY-MM-DD') : undefined)} />
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate({ page: 'pharmacy-billing-create' })}
          >
            New Pharmacy Bill
          </Button>
        </div>

        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 20, showTotal: total => `${total} bills` }}
          onRow={r => ({
            onClick: () => navigate({ page: 'invoice-detail', id: r.id }),
            style: { cursor: 'pointer' }
          })}
          locale={{ emptyText: 'No pharmacy bills found' }}
        />
      </Card>
    </div>
  )
}
