import { useEffect, useState } from 'react'
import { Table, Button, Select, DatePicker, Card, Row, Col, Space, Input, Avatar } from 'antd'
import { PlusOutlined, ExportOutlined, RiseOutlined, DollarOutlined, ClockCircleOutlined, FileTextOutlined } from '@ant-design/icons'
import type { Invoice, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import { useT } from '../../hooks/useT'
import dayjs from 'dayjs'

interface Props { navigate: (r: Route) => void }

const STATUS_CONFIG: Record<string, { color: string; bg: string; darkBg: string; label: string }> = {
  paid:    { color: '#16a34a', bg: '#dcfce7', darkBg: 'rgba(22,163,74,0.18)',  label: 'FULLY PAID' },
  partial: { color: '#d97706', bg: '#fef3c7', darkBg: 'rgba(217,119,6,0.18)',  label: 'PARTIALLY PAID' },
  unpaid:  { color: '#dc2626', bg: '#fee2e2', darkBg: 'rgba(220,38,38,0.18)',  label: 'UNPAID' },
  voided:  { color: '#64748b', bg: '#f1f5f9', darkBg: 'rgba(100,116,139,0.18)', label: 'VOIDED' }
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unpaid
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em'
    }}>{cfg.label}</span>
  )
}

// ── Monthly Revenue Bar Chart ─────────────────────────────────────────────────
interface MonthBar { month: string; label: string; revenue: number; collected: number }

function RevenueChart({ invoices }: { invoices: Invoice[] }) {
  // Build last 6 months of data from all invoices in memory
  const months: MonthBar[] = []
  for (let i = 5; i >= 0; i--) {
    const d = dayjs().subtract(i, 'month')
    const key = d.format('YYYY-MM')
    const label = d.format("MMM 'YY")
    const bucket = invoices.filter(inv => inv.created_at.startsWith(key) && inv.status !== 'voided')
    months.push({
      month: key,
      label,
      revenue: bucket.reduce((s, inv) => s + inv.total_amount, 0),
      collected: bucket.reduce((s, inv) => s + inv.amount_paid, 0),
    })
  }

  const maxVal = Math.max(...months.map(m => m.revenue), 1)
  const chartH = 120
  const barW = 32
  const gap = 16
  const totalW = months.length * (barW + gap) - gap + 60

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={totalW} height={chartH + 36} style={{ display: 'block' }}>
        {months.map((m, i) => {
          const x = 30 + i * (barW + gap)
          const revH = Math.max((m.revenue / maxVal) * chartH, 2)
          const colH = Math.max((m.collected / maxVal) * chartH, 2)
          return (
            <g key={m.month}>
              {/* Revenue bar (background) */}
              <rect
                x={x} y={chartH - revH} width={barW} height={revH}
                fill="rgba(37,99,235,0.15)" rx={4}
              />
              {/* Collected bar (foreground) */}
              <rect
                x={x} y={chartH - colH} width={barW} height={colH}
                fill="#2563eb" rx={4} opacity={0.85}
              />
              {/* Month label */}
              <text
                x={x + barW / 2} y={chartH + 14}
                textAnchor="middle" fontSize={10} fill="#94a3b8" fontWeight="600"
              >
                {m.label}
              </text>
              {/* Value label on hover: use title */}
              {m.revenue > 0 && (
                <text
                  x={x + barW / 2} y={chartH - revH - 4}
                  textAnchor="middle" fontSize={9} fill="#2563eb" fontWeight="700"
                >
                  ₹{(m.revenue / 1000).toFixed(0)}k
                </text>
              )}
            </g>
          )
        })}
        {/* Y axis line */}
        <line x1={28} y1={0} x2={28} y2={chartH} stroke="#e2e8f0" strokeWidth={1} />
      </svg>
      <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#2563eb', opacity: 0.85 }} />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Collected</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(37,99,235,0.15)' }} />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Billed</span>
        </div>
      </div>
    </div>
  )
}

export default function InvoiceList({ navigate }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<{ dateFrom?: string; dateTo?: string; status?: string; search?: string }>({})
  const t = useT()

  async function load() {
    setLoading(true)
    const r = await window.api.billing.listInvoices(filters) as IpcResult<Invoice[]>
    if (r.success && r.data) {
      let data = r.data
      if (filters.search) {
        const s = filters.search.toLowerCase()
        data = data.filter(i =>
          i.patient_name?.toLowerCase().includes(s) ||
          i.invoice_number.toLowerCase().includes(s) ||
          i.patient_op_id?.toLowerCase().includes(s)
        )
      }
      setInvoices(data)
    }
    setLoading(false)
  }

  // Load all invoices for chart (no filters)
  async function loadAll() {
    const r = await window.api.billing.listInvoices({}) as IpcResult<Invoice[]>
    if (r.success && r.data) setAllInvoices(r.data)
  }

  useEffect(() => { load() }, [filters])
  useEffect(() => { loadAll() }, [])

  const totalBilled = invoices.reduce((s, i) => s + i.total_amount, 0)
  const totalPaid   = invoices.reduce((s, i) => s + i.amount_paid, 0)
  const outstanding = totalBilled - totalPaid

  const summaryCards = [
    { title: 'Revenue This Period', value: `₹${totalBilled.toLocaleString('en-IN')}`, icon: <DollarOutlined />, iconBg: '#dbeafe', iconColor: '#2563eb', sub: `${invoices.filter(i => i.status === 'paid').length} fully paid` },
    { title: 'Collected', value: `₹${totalPaid.toLocaleString('en-IN')}`, icon: <RiseOutlined />, iconBg: '#dcfce7', iconColor: '#16a34a', sub: null },
    { title: 'Outstanding', value: `₹${outstanding.toLocaleString('en-IN')}`, icon: <ClockCircleOutlined />, iconBg: '#fee2e2', iconColor: '#dc2626', sub: `${invoices.filter(i => i.status !== 'paid' && i.status !== 'voided').length} pending` },
    { title: 'Total Invoices', value: invoices.length, icon: <FileTextOutlined />, iconBg: '#f3e8ff', iconColor: '#7c3aed', sub: null },
  ]

  const columns = [
    {
      title: 'Invoice #', dataIndex: 'invoice_number', width: 160,
      render: (v: string, r: Invoice) => (
        <Button type="link" style={{ padding: 0, fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}
          onClick={() => navigate({ page: 'invoice-detail', id: r.id })}>
          {v}
        </Button>
      )
    },
    {
      title: 'Patient Name', dataIndex: 'patient_name',
      render: (v: string, r: Invoice) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={30} style={{ background: '#dbeafe', color: '#2563eb', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {v?.charAt(0) ?? 'P'}
          </Avatar>
          <div>
            <Button type="link" style={{ padding: 0, fontWeight: 500 }}
              onClick={() => navigate({ page: 'patient-detail', id: r.patient_id })}>
              {v}
            </Button>
            <div style={{ fontSize: 11, color: t.textHint }}>{r.patient_op_id}</div>
          </div>
        </div>
      )
    },
    {
      title: 'Date', dataIndex: 'created_at', width: 120,
      render: (v: string) => <span style={{ color: t.textSub, fontSize: 13 }}>{dayjs(v).format('DD/MM/YYYY')}</span>
    },
    {
      title: 'Total Amount', dataIndex: 'total_amount', width: 140,
      render: (v: number) => <span style={{ fontWeight: 600, color: t.text }}>₹{v.toLocaleString('en-IN')}</span>
    },
    {
      title: 'Paid', dataIndex: 'amount_paid', width: 120,
      render: (v: number) => <span style={{ color: '#16a34a' }}>₹{v.toLocaleString('en-IN')}</span>
    },
    {
      title: 'Balance', width: 120,
      render: (_: unknown, r: Invoice) => {
        const bal = r.total_amount - r.amount_paid
        return <span style={{ fontWeight: 600, color: bal > 0 ? '#dc2626' : '#16a34a' }}>
          ₹{bal.toLocaleString('en-IN')}
        </span>
      }
    },
    {
      title: 'Payment', dataIndex: 'status', width: 150,
      render: (v: string) => <StatusBadge status={v} />
    },
    {
      title: '', width: 100,
      render: (_: unknown, r: Invoice) => (
        <Button
          size="small" type="primary"
          style={{ borderRadius: 6, fontSize: 12 }}
          onClick={() => navigate({ page: 'invoice-detail', id: r.id })}
        >
          View Bill
        </Button>
      )
    }
  ]

  return (
    <div>
      {/* Summary cards */}
      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        {summaryCards.map((c, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card style={{ border: `1px solid ${t.border}`, background: t.bg }} styles={{ body: { padding: '16px 18px' } }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11.5, color: t.textHint, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{c.title}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{c.value}</div>
                  {c.sub && <div style={{ fontSize: 11, color: t.textHint, marginTop: 2 }}>{c.sub}</div>}
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: c.iconColor }}>
                  {c.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Revenue chart */}
      {allInvoices.length > 0 && (
        <Card
          style={{ border: `1px solid ${t.border}`, background: t.bg, marginBottom: 16 }}
          styles={{ body: { padding: '16px 20px' } }}
          title={<span style={{ fontWeight: 700, fontSize: 13.5, color: t.text }}>Monthly Revenue (Last 6 Months)</span>}
        >
          <RevenueChart invoices={allInvoices} />
        </Card>
      )}

      {/* Main table card */}
      <Card style={{ border: `1px solid ${t.border}`, background: t.bg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <Space wrap>
            <Input.Search
              placeholder="Search name or invoice ID..."
              style={{ width: 260, borderRadius: 8 }}
              onSearch={v => setFilters(f => ({ ...f, search: v }))}
              allowClear
            />
            <DatePicker.RangePicker
              format="DD MMM YYYY"
              onChange={dates => setFilters(f => ({
                ...f,
                dateFrom: dates?.[0]?.format('YYYY-MM-DD'),
                dateTo: dates?.[1]?.format('YYYY-MM-DD')
              }))}
            />
            <Select
              placeholder="All Status"
              style={{ width: 150 }}
              allowClear
              onChange={v => setFilters(f => ({ ...f, status: v }))}
              options={[
                { value: 'paid', label: 'Fully Paid' },
                { value: 'partial', label: 'Partially Paid' },
                { value: 'unpaid', label: 'Unpaid' },
                { value: 'voided', label: 'Voided' }
              ]}
            />
          </Space>
          <Space>
            <Button icon={<ExportOutlined />}>Export</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate({ page: 'invoice-create' })}>
              New Invoice
            </Button>
          </Space>
        </div>
        <Table
          dataSource={invoices}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 15, showTotal: total => `${total} invoices`, size: 'small' }}
          rowClassName={() => 'invoice-row'}
        />
      </Card>
    </div>
  )
}
