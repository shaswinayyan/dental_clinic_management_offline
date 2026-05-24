import { useEffect, useState } from 'react'
import { Table, Tag, Button, DatePicker, Select, Card, Statistic, Row, Col, message, Popconfirm } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import type { Payment, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import { useAuthStore } from '../../store/authStore'
import { useT } from '../../hooks/useT'
import dayjs from 'dayjs'

interface Props { navigate: (r: Route) => void }

export default function Ledger({ navigate }: Props) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<{ dateFrom?: string; dateTo?: string; method?: string; verified?: boolean }>({
    dateFrom: dayjs().format('YYYY-MM-DD'), dateTo: dayjs().format('YYYY-MM-DD')
  })
  const { user } = useAuthStore()
  const t = useT()

  async function load() {
    setLoading(true)
    const r = await window.api.billing.listLedger(filters) as IpcResult<Payment[]>
    if (r.success && r.data) setPayments(r.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [filters])

  async function markAllVerified() {
    if (!user) return
    const r = await window.api.billing.markAllVerifiedToday(user.id) as IpcResult
    if (r.success) { message.success('All today\'s payments marked as verified'); load() }
    else message.error(r.error)
  }

  async function verifyPayment(paymentId: number) {
    if (!user) return
    const r = await window.api.billing.verifyPayment(paymentId, user.id) as IpcResult
    if (r.success) load()
    else message.error(r.error)
  }

  const cashTotal = payments.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0)
  const upiTotal = payments.filter(p => p.method === 'upi').reduce((s, p) => s + p.amount, 0)
  const cardTotal = payments.filter(p => p.method === 'card').reduce((s, p) => s + p.amount, 0)
  const grandTotal = payments.reduce((s, p) => s + p.amount, 0)

  const summaryCards = [
    { title: 'Cash', value: `₹${cashTotal.toLocaleString('en-IN')}`, color: t.success,  bg: '#dcfce7', iconBg: '#16a34a' },
    { title: 'UPI',  value: `₹${upiTotal.toLocaleString('en-IN')}`,  color: t.primary, bg: '#dbeafe', iconBg: '#2563eb' },
    { title: 'Card', value: `₹${cardTotal.toLocaleString('en-IN')}`, color: t.warning,  bg: '#fef3c7', iconBg: '#d97706' },
    { title: 'Total',value: `₹${grandTotal.toLocaleString('en-IN')}`,color: t.text,     bg: '#f3e8ff', iconBg: '#7c3aed' },
  ]

  const columns = [
    { title: 'Date', dataIndex: 'paid_at', width: 150, render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm') },
    { title: 'Patient', key: 'patient', render: (_: unknown, r: Payment & { patient_name?: string; invoice_number?: string }) => r.patient_name || '—' },
    { title: 'Invoice #', key: 'inv', render: (_: unknown, r: Payment & { invoice_number?: string }) => (
      <Button type="link" style={{ padding: 0, fontFamily: 'monospace' }} onClick={() => navigate({ page: 'invoice-detail', id: r.invoice_id })}>{r.invoice_number}</Button>
    )},
    { title: 'Amount', dataIndex: 'amount', width: 120, render: (v: number) => <strong>₹{v.toLocaleString('en-IN')}</strong> },
    { title: 'Method', dataIndex: 'method', width: 80, render: (v: string) => <Tag color={v === 'cash' ? 'green' : v === 'upi' ? 'blue' : 'orange'}>{v.toUpperCase()}</Tag> },
    { title: 'Reference', dataIndex: 'reference_number', render: (v: string) => v || '—' },
    { title: 'Recorded By', dataIndex: 'recorded_by_name' },
    { title: 'Verified', dataIndex: 'is_verified', width: 120, render: (v: number, r: Payment) => v ? (
      <Tag color="green"><CheckCircleOutlined /> Verified</Tag>
    ) : (
      <Button size="small" onClick={() => verifyPayment(r.id)}>Verify</Button>
    )}
  ]

  return (
    <div>
      {/* Summary cards */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {summaryCards.map((s, i) => (
          <Col span={6} key={i}>
            <Card size="small" style={{ border: `1px solid ${t.border}`, background: t.bg }}>
              <Statistic
                title={<span style={{ color: t.textSub, fontSize: 12, fontWeight: 600 }}>{s.title}</span>}
                value={s.value}
                valueStyle={{ color: s.color, fontSize: 20, fontWeight: 700 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title={<span style={{ color: t.text, fontWeight: 700 }}>Payment Ledger</span>}
        style={{ border: `1px solid ${t.border}`, background: t.bg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <DatePicker placeholder="From date" format="DD/MM/YYYY" value={dayjs(filters.dateFrom)}
              onChange={d => setFilters(f => ({ ...f, dateFrom: d?.format('YYYY-MM-DD') }))} />
            <DatePicker placeholder="To date" format="DD/MM/YYYY" value={dayjs(filters.dateTo)}
              onChange={d => setFilters(f => ({ ...f, dateTo: d?.format('YYYY-MM-DD') }))} />
            <Select placeholder="Method" style={{ width: 110 }} allowClear onChange={v => setFilters(f => ({ ...f, method: v }))}
              options={[{ value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }, { value: 'card', label: 'Card' }]} />
            <Select placeholder="Verified" style={{ width: 130 }} allowClear onChange={v => setFilters(f => ({ ...f, verified: v }))}
              options={[{ value: true, label: 'Verified' }, { value: false, label: 'Unverified' }]} />
          </div>
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={markAllVerified}>Mark All Verified Today</Button>
        </div>
        <Table
          dataSource={payments}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          rowClassName={(r) => !(r as Payment).is_verified ? 'ant-table-row-level-0' : ''}
          pagination={{ pageSize: 20 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}><strong>Daily Totals</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={1}><strong>₹{grandTotal.toLocaleString('en-IN')}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={2} colSpan={4}>
                  Cash: ₹{cashTotal.toLocaleString('en-IN')} | UPI: ₹{upiTotal.toLocaleString('en-IN')} | Card: ₹{cardTotal.toLocaleString('en-IN')}
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </div>
  )
}
