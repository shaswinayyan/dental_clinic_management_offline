import { useEffect, useState } from 'react'
import { Card, Descriptions, Tag, Table, Button, Modal, Form, InputNumber, Select, Input, message, Space, Spin, Row, Col, Statistic } from 'antd'
import { ArrowLeftOutlined, PlusOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { Invoice, InvoiceItem, Payment, IpcResult, AppSettings } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import { useAuthStore } from '../../store/authStore'
import { useT } from '../../hooks/useT'
import dayjs from 'dayjs'

interface Props { id: number; navigate: (r: Route) => void }

const STATUS_COLOR: Record<string, string> = { paid: 'green', partial: 'orange', unpaid: 'red', voided: 'default' }

export default function InvoiceDetail({ id, navigate }: Props) {
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showPayForm, setShowPayForm] = useState(false)
  const [showVoidForm, setShowVoidForm] = useState(false)
  const [payForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [clinicSettings, setClinicSettings] = useState<Partial<AppSettings>>({})
  const { user } = useAuthStore()
  const t = useT()

  async function load() {
    setLoading(true)
    const [inv, itms, pays, cfg] = await Promise.all([
      window.api.billing.getInvoice(id) as Promise<IpcResult<Invoice>>,
      window.api.billing.getInvoiceItems(id) as Promise<IpcResult<InvoiceItem[]>>,
      window.api.billing.getPayments(id) as Promise<IpcResult<Payment[]>>,
      window.api.settings.get() as Promise<IpcResult<AppSettings>>
    ])
    if (inv.success && inv.data) setInvoice(inv.data)
    if (itms.success && itms.data) setItems(itms.data)
    if (pays.success && pays.data) setPayments(pays.data)
    if (cfg.success && cfg.data) setClinicSettings(cfg.data)
    setLoading(false)
  }

  async function handlePrint() {
    if (!invoice) return
    setPrinting(true)
    try {
      const bal = invoice.total_amount - invoice.amount_paid
      const clinic = clinicSettings
      const statusClass: Record<string, string> = { paid: 'tag-green', partial: 'tag-orange', unpaid: 'tag-red', voided: 'tag-grey' }

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice ${invoice.invoice_number}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1e293b; padding: 32px 36px; background: #fff; }
  .header { text-align: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 14px; margin-bottom: 20px; }
  .clinic-name { font-size: 24px; font-weight: 800; color: #0a1628; letter-spacing: 0.06em; text-transform: uppercase; }
  .clinic-gold { color: #c9a84c; }
  .clinic-sub { font-size: 12px; color: #64748b; margin-top: 3px; }
  .doctor-line { font-size: 12px; color: #c9a84c; font-weight: 600; margin-top: 4px; }
  .inv-meta { display: flex; justify-content: space-between; margin-bottom: 20px; gap: 20px; }
  .inv-meta-block { flex: 1; }
  .label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 2px; }
  .value { font-weight: 600; font-size: 13px; color: #1e293b; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 2px solid #e2e8f0; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  tr:last-child td { border-bottom: none; }
  .total-row td { font-weight: 700; border-top: 2px solid #1e3a8a; background: #f8fafc; font-size: 14px; }
  .right { text-align: right; }
  .center { text-align: center; }
  .summary-wrap { display: flex; justify-content: flex-end; margin-bottom: 24px; }
  .summary-box { border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 14px 20px; min-width: 240px; }
  .srow { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 13px; }
  .srow.divider { border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 4px; font-size: 15px; font-weight: 700; }
  .green { color: #16a34a; }
  .red { color: #dc2626; }
  .blue { color: #1e3a8a; }
  .tag { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .tag-green { background: #dcfce7; color: #166534; }
  .tag-orange { background: #ffedd5; color: #c2410c; }
  .tag-red { background: #fee2e2; color: #b91c1c; }
  .tag-grey { background: #f1f5f9; color: #64748b; }
  .payments-title { font-weight: 700; font-size: 13px; margin-bottom: 8px; }
  .footer { margin-top: 36px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  .discount-note { font-size: 11px; color: #64748b; margin-top: 2px; }
</style>
</head>
<body>
  <!-- Clinic Header -->
  <div class="header">
    <div style="height:4px;background:linear-gradient(90deg,#c9a84c,#e8d080,#c9a84c);border-radius:2px;margin-bottom:14px;"></div>
    <div class="clinic-name">${clinic.clinic_name || 'Vorsa Dental Clinic'}</div>
    ${clinic.clinic_address ? `<div class="clinic-sub">${clinic.clinic_address}</div>` : ''}
    ${clinic.clinic_phone ? `<div class="clinic-sub">Tel: ${clinic.clinic_phone}</div>` : ''}
    ${user?.full_name ? `<div class="doctor-line">Dr. ${user.full_name}${user.qualification ? ' &mdash; ' + user.qualification : ''}${user.designation ? ' &middot; ' + user.designation : ''}${user.license_no ? ' &middot; Reg: ' + user.license_no : ''}</div>` : ''}
    <div style="height:1px;background:rgba(201,168,76,0.3);margin-top:14px;"></div>
  </div>

  <!-- Invoice Meta -->
  <div class="inv-meta">
    <div class="inv-meta-block">
      <div class="label">Invoice Number</div>
      <div class="value">${invoice.invoice_number}</div>
      <div class="label" style="margin-top:8px">Invoice Type</div>
      <div class="value">${invoice.billing_type === 'pharmacy' ? 'Pharmacy / Medicine' : 'Treatment / Procedure'}</div>
    </div>
    <div class="inv-meta-block" style="text-align:center">
      <div class="label">Date</div>
      <div class="value">${dayjs(invoice.created_at).format('DD MMM YYYY')}</div>
      <div style="margin-top:8px">
        <span class="tag ${statusClass[invoice.status] || 'tag-grey'}">${invoice.status.toUpperCase()}</span>
      </div>
    </div>
    <div class="inv-meta-block" style="text-align:right">
      <div class="label">Patient Name</div>
      <div class="value">${invoice.patient_name || ''}</div>
      <div class="label" style="margin-top:8px">OP ID</div>
      <div class="value">${invoice.patient_op_id || ''}</div>
    </div>
  </div>

  <!-- Line Items -->
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="center">Qty</th>
        <th class="right">Unit Price</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(it => `
        <tr>
          <td>${it.description}</td>
          <td class="center">${it.quantity}</td>
          <td class="right">&#x20b9;${it.unit_price.toLocaleString('en-IN')}</td>
          <td class="right">&#x20b9;${it.total_price.toLocaleString('en-IN')}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="3">Grand Total</td>
        <td class="right">&#x20b9;${invoice.total_amount.toLocaleString('en-IN')}</td>
      </tr>
    </tbody>
  </table>

  <!-- Summary -->
  <div class="summary-wrap">
    <div class="summary-box">
      <div class="srow"><span>Subtotal</span><span>&#x20b9;${invoice.subtotal.toLocaleString('en-IN')}</span></div>
      ${invoice.discount_amount > 0 ? `<div class="srow"><span>Discount</span><span class="red">&#8722;&#x20b9;${invoice.discount_amount.toLocaleString('en-IN')}</span></div>${invoice.discount_reason ? `<div class="discount-note">(${invoice.discount_reason})</div>` : ''}` : ''}
      ${invoice.tax_amount > 0 ? `<div class="srow"><span>Tax</span><span>&#x20b9;${invoice.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>` : ''}
      <div class="srow divider"><span class="blue">Total</span><span class="blue">&#x20b9;${invoice.total_amount.toLocaleString('en-IN')}</span></div>
      <div class="srow" style="margin-top:6px"><span>Amount Paid</span><span class="green">&#x20b9;${invoice.amount_paid.toLocaleString('en-IN')}</span></div>
      <div class="srow" style="font-weight:700"><span>Balance Due</span><span class="${bal > 0 ? 'red' : 'green'}">&#x20b9;${bal.toLocaleString('en-IN')}</span></div>
    </div>
  </div>

  <!-- Payment History -->
  ${payments.length > 0 ? `
  <div class="payments-title">Payment History</div>
  <table>
    <thead>
      <tr>
        <th>Date &amp; Time</th>
        <th>Method</th>
        <th>Reference No.</th>
        <th>Recorded By</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${payments.map(p => `
        <tr>
          <td>${dayjs(p.paid_at).format('DD MMM YYYY, HH:mm')}</td>
          <td>${p.method.toUpperCase()}</td>
          <td>${p.reference_number || '&#8212;'}</td>
          <td>${p.recorded_by_name || '&#8212;'}</td>
          <td class="right">&#x20b9;${p.amount.toLocaleString('en-IN')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <!-- Footer -->
  <div class="footer">
    Thank you for choosing ${clinic.clinic_name || 'our clinic'}. &nbsp;|&nbsp; This is a system-generated invoice.
    <br>Generated on ${dayjs().format('DD MMM YYYY, HH:mm')}
  </div>
</body>
</html>`

      const r = await window.api.billing.printInvoice(html, invoice.invoice_number) as IpcResult<string>
      if (!r.success) message.error(r.error || 'Failed to generate PDF')
      else message.success('PDF opened — use your PDF viewer to print')
    } finally {
      setPrinting(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function handleAddPayment(values: { amount: number; method: string; reference_number?: string; notes?: string }) {
    if (!user || !invoice) return
    setSaving(true)
    try {
      const remaining = invoice.total_amount - invoice.amount_paid
      if (values.amount > remaining) { message.error(`Amount exceeds balance. Max: ₹${remaining.toLocaleString('en-IN')}`); setSaving(false); return }
      const r = await window.api.billing.addPayment({ invoice_id: id, recorded_by: user.id, ...values }) as IpcResult
      if (r.success) { message.success('Payment recorded'); setShowPayForm(false); payForm.resetFields(); load() }
      else message.error(r.error)
    } finally { setSaving(false) }
  }

  async function handleVoid(values: { reason: string }) {
    if (!user) return
    const r = await window.api.billing.voidInvoice(id, values.reason) as IpcResult
    if (r.success) { message.success('Invoice voided'); setShowVoidForm(false); load() }
    else message.error(r.error)
  }

  async function handleVerifyPayment(paymentId: number) {
    if (!user) return
    const r = await window.api.billing.verifyPayment(paymentId, user.id) as IpcResult
    if (r.success) load()
    else message.error(r.error)
  }

  if (loading) return <Spin />
  if (!invoice) return <div>Invoice not found</div>

  const balance = invoice.total_amount - invoice.amount_paid

  const itemColumns = [
    { title: 'Description', dataIndex: 'description' },
    { title: 'Qty', dataIndex: 'quantity', width: 60 },
    { title: 'Unit Price', dataIndex: 'unit_price', width: 120, render: (v: number) => `₹${v.toLocaleString('en-IN')}` },
    { title: 'Total', dataIndex: 'total_price', width: 120, render: (v: number) => `₹${v.toLocaleString('en-IN')}` }
  ]

  const paymentColumns = [
    { title: 'Date', dataIndex: 'paid_at', width: 130, render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm') },
    { title: 'Amount', dataIndex: 'amount', width: 120, render: (v: number) => `₹${v.toLocaleString('en-IN')}` },
    { title: 'Method', dataIndex: 'method', width: 80, render: (v: string) => <Tag>{v.toUpperCase()}</Tag> },
    { title: 'Reference', dataIndex: 'reference_number', render: (v: string) => v || '—' },
    { title: 'Recorded By', dataIndex: 'recorded_by_name' },
    { title: 'Verified', dataIndex: 'is_verified', width: 100, render: (v: number, r: Payment) => v ? (
      <Tag color="green">✓ Verified</Tag>
    ) : (
      <Button size="small" onClick={() => handleVerifyPayment(r.id)}>Verify</Button>
    )}
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate({ page: 'invoices' })}>Back</Button>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, color: t.text }}>
                {invoice.invoice_number}
                {invoice.billing_type === 'pharmacy' && (
                  <Tag color="purple" style={{ marginLeft: 8, fontSize: 11 }}>Pharmacy</Tag>
                )}
              </div>
              <div style={{ color: t.textSub, fontSize: 13 }}>{dayjs(invoice.created_at).format('DD MMM YYYY, HH:mm')}</div>
            </div>
          </Space>
          <Space>
            <Tag color={STATUS_COLOR[invoice.status]} style={{ fontSize: 14, padding: '4px 10px' }}>{invoice.status.toUpperCase()}</Tag>
            <Button icon={<FilePdfOutlined />} loading={printing} onClick={handlePrint}>Export PDF</Button>
            {invoice.status !== 'voided' && invoice.status !== 'paid' && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowPayForm(true)}>Record Payment</Button>
            )}
            {invoice.status !== 'voided' && user?.role === 'doctor' && (
              <Button danger onClick={() => setShowVoidForm(true)}>Void Invoice</Button>
            )}
          </Space>
        </div>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="Subtotal" value={`₹${invoice.subtotal.toLocaleString('en-IN')}`} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Discount" value={`₹${invoice.discount_amount.toLocaleString('en-IN')}`} valueStyle={{ color: '#dc2626' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Total" value={`₹${invoice.total_amount.toLocaleString('en-IN')}`} valueStyle={{ color: '#c9a84c', fontWeight: 700 }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Balance Due" value={`₹${balance.toLocaleString('en-IN')}`} valueStyle={{ color: balance > 0 ? '#dc2626' : '#16a34a' }} /></Card></Col>
      </Row>

      <Card title="Patient & Details" style={{ marginBottom: 16 }}>
        <Descriptions size="small" column={3}>
          <Descriptions.Item label="Patient">{invoice.patient_name}</Descriptions.Item>
          <Descriptions.Item label="OP ID"><code>{invoice.patient_op_id}</code></Descriptions.Item>
          <Descriptions.Item label="Amount Paid">₹{invoice.amount_paid.toLocaleString('en-IN')}</Descriptions.Item>
          {invoice.discount_reason && <Descriptions.Item label="Discount Reason" span={3}>{invoice.discount_reason}</Descriptions.Item>}
          {invoice.void_reason && <Descriptions.Item label="Void Reason" span={3}><span style={{ color: '#dc2626' }}>{invoice.void_reason}</span></Descriptions.Item>}
        </Descriptions>
      </Card>

      <Card title="Line Items" style={{ marginBottom: 16 }}>
        <Table dataSource={items} columns={itemColumns} rowKey="id" size="small" pagination={false}
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}><strong>Total</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={1}><strong>₹{invoice.total_amount.toLocaleString('en-IN')}</strong></Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )} />
      </Card>

      <Card title="Payment History">
        <Table dataSource={payments} columns={paymentColumns} rowKey="id" size="small" pagination={false}
          locale={{ emptyText: 'No payments recorded' }} />
      </Card>

      {/* Payment modal */}
      <Modal open={showPayForm} title="Record Payment" footer={null} onCancel={() => setShowPayForm(false)} destroyOnClose>
        <Form form={payForm} layout="vertical" onFinish={handleAddPayment}>
          <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}>
            <InputNumber min={0.01} max={invoice.total_amount - invoice.amount_paid} style={{ width: '100%' }}
              formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              defaultValue={invoice.total_amount - invoice.amount_paid} />
          </Form.Item>
          <Form.Item name="method" label="Payment Method" rules={[{ required: true }]} initialValue="cash">
            <Select options={[{ value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }, { value: 'card', label: 'Card' }]} />
          </Form.Item>
          <Form.Item name="reference_number" label="UPI Ref / Card Last 4">
            <Input placeholder="Reference number" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setShowPayForm(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Record Payment</Button>
          </div>
        </Form>
      </Modal>

      {/* Void modal */}
      <Modal open={showVoidForm} title="Void Invoice" footer={null} onCancel={() => setShowVoidForm(false)} destroyOnClose>
        <Form layout="vertical" onFinish={handleVoid}>
          <Form.Item name="reason" label="Reason for voiding" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="Explain why this invoice is being voided..." />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setShowVoidForm(false)}>Cancel</Button>
            <Button type="primary" danger htmlType="submit">Void Invoice</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

