import { useEffect, useState } from 'react'
import { Card, Button, Table, Tag, Modal, Form, InputNumber, Select, Input, DatePicker, message, Descriptions, Statistic, Row, Col, Spin, Space } from 'antd'
import { ArrowLeftOutlined, PlusOutlined, MinusOutlined } from '@ant-design/icons'
import type { InventoryItem, InventoryTransaction, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import { useAuthStore } from '../../store/authStore'
import { useT } from '../../hooks/useT'
import dayjs from 'dayjs'

interface Props { id: number; navigate: (r: Route) => void }

const TX_LABELS: Record<string, string> = {
  stock_in_purchase: 'Purchase', stock_in_return: 'Return In',
  stock_out_procedure: 'Procedure', stock_out_wastage: 'Wastage',
  stock_out_transfer: 'Transfer', adjustment: 'Adjustment'
}

export default function ItemDetail({ id, navigate }: Props) {
  const [item, setItem] = useState<InventoryItem | null>(null)
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showStockIn, setShowStockIn] = useState(false)
  const [showStockOut, setShowStockOut] = useState(false)
  const [saving, setSaving] = useState(false)
  const [stockInForm] = Form.useForm()
  const [stockOutForm] = Form.useForm()
  const { user } = useAuthStore()
  const t = useT()

  async function load() {
    setLoading(true)
    const [itemRes, txRes] = await Promise.all([
      window.api.inventory.getItem(id) as Promise<IpcResult<InventoryItem>>,
      window.api.inventory.getTransactionHistory(id) as Promise<IpcResult<InventoryTransaction[]>>
    ])
    if (itemRes.success && itemRes.data) setItem(itemRes.data)
    if (txRes.success && txRes.data) setTransactions(txRes.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleStockIn(values: { quantity: number; unit_cost?: number; batch_number?: string; expiry_date?: dayjs.Dayjs; supplier_ref?: string; notes?: string }) {
    if (!user) return
    setSaving(true)
    try {
      const r = await window.api.inventory.recordTransaction({
        item_id: id,
        branch_id: 1,
        transaction_type: 'stock_in_purchase',
        quantity: values.quantity,
        unit_cost: values.unit_cost,
        batch_number: values.batch_number,
        expiry_date: values.expiry_date?.format('YYYY-MM-DD'),
        supplier_ref: values.supplier_ref,
        reason_notes: values.notes,
        recorded_by: user.id,
        transaction_date: new Date().toISOString()
      }) as IpcResult
      if (r.success) { message.success('Stock added'); setShowStockIn(false); stockInForm.resetFields(); load() }
      else message.error(r.error)
    } finally { setSaving(false) }
  }

  async function handleStockOut(values: { quantity: number; transaction_type: string; reason_notes?: string }) {
    if (!user) return
    setSaving(true)
    try {
      const r = await window.api.inventory.recordTransaction({
        item_id: id,
        branch_id: 1,
        transaction_type: values.transaction_type as InventoryTransaction['transaction_type'],
        quantity: values.quantity,
        reason_notes: values.reason_notes,
        recorded_by: user.id,
        transaction_date: new Date().toISOString()
      }) as IpcResult
      if (r.success) { message.success('Stock updated'); setShowStockOut(false); stockOutForm.resetFields(); load() }
      else message.error(r.error)
    } finally { setSaving(false) }
  }

  if (loading) return <Spin />
  if (!item) return <div>Item not found</div>

  const stockStatus = item.current_stock <= 0 ? 'Out of Stock' : item.current_stock <= item.minimum_stock_level ? 'Low Stock' : 'In Stock'
  const stockColor = item.current_stock <= 0 ? '#dc2626' : item.current_stock <= item.minimum_stock_level ? '#d97706' : '#16a34a'

  const txColumns = [
    { title: 'Date', dataIndex: 'transaction_date', width: 130, render: (v: string) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Type', dataIndex: 'transaction_type', width: 130, render: (v: string) => (
      <Tag color={v.startsWith('stock_in') ? 'green' : v === 'adjustment' ? 'blue' : 'red'}>{TX_LABELS[v] || v}</Tag>
    )},
    { title: 'Qty', dataIndex: 'quantity', width: 80, render: (v: number) => (
      <span style={{ color: v > 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{v > 0 ? '+' : ''}{v}</span>
    )},
    { title: 'Batch', dataIndex: 'batch_number', render: (v: string) => v || '—' },
    { title: 'Expiry', dataIndex: 'expiry_date', render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Notes', dataIndex: 'reason_notes', ellipsis: true, render: (v: string) => v || '—' },
    { title: 'By', key: 'by', render: (_: unknown, r: InventoryTransaction) => (r as InventoryTransaction & { recorded_by_name?: string }).recorded_by_name }
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate({ page: 'inventory-items' })}>Back</Button>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, color: t.text }}>{item.item_name}</div>
              <Tag>{item.category}</Tag>
              <Tag color={stockStatus === 'In Stock' ? 'green' : stockStatus === 'Low Stock' ? 'orange' : 'red'}>{stockStatus}</Tag>
            </div>
          </Space>
          <Space>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => setShowStockIn(true)}>Add Stock</Button>
            <Button icon={<MinusOutlined />} onClick={() => setShowStockOut(true)}>Record Usage</Button>
          </Space>
        </div>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="Current Stock" value={`${item.current_stock} ${item.unit_of_measure}`} valueStyle={{ color: stockColor, fontSize: 24 }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Min Level" value={`${item.minimum_stock_level} ${item.unit_of_measure}`} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Reorder Qty" value={`${item.reorder_quantity} ${item.unit_of_measure}`} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Unit Cost" value={`₹${item.unit_cost.toLocaleString('en-IN')}`} /></Card></Col>
      </Row>

      <Card title="Item Details" style={{ marginBottom: 16 }}>
        <Descriptions size="small" column={2}>
          <Descriptions.Item label="Supplier">{item.supplier_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Storage Location">{item.storage_location || '—'}</Descriptions.Item>
          <Descriptions.Item label="Notes" span={2}>{item.notes || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Transaction History">
        <Table dataSource={transactions} columns={txColumns} rowKey="id" size="small" pagination={{ pageSize: 20 }} />
      </Card>

      {/* Stock In */}
      <Modal open={showStockIn} title="Add Stock (Purchase)" footer={null} onCancel={() => setShowStockIn(false)} destroyOnClose>
        <Form form={stockInForm} layout="vertical" onFinish={handleStockIn}>
          <Form.Item name="quantity" label="Quantity Received" rules={[{ required: true }]}>
            <InputNumber min={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unit_cost" label="Unit Cost (₹)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="batch_number" label="Batch / Lot Number">
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item name="expiry_date" label="Expiry Date">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="supplier_ref" label="Supplier Invoice / Reference">
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setShowStockIn(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Add Stock</Button>
          </div>
        </Form>
      </Modal>

      {/* Stock Out */}
      <Modal open={showStockOut} title="Record Usage / Wastage" footer={null} onCancel={() => setShowStockOut(false)} destroyOnClose>
        <Form form={stockOutForm} layout="vertical" onFinish={handleStockOut}>
          <Form.Item name="transaction_type" label="Reason" rules={[{ required: true }]} initialValue="stock_out_procedure">
            <Select options={[
              { value: 'stock_out_procedure', label: 'Procedure Use' },
              { value: 'stock_out_wastage', label: 'Wastage / Expired' },
              { value: 'adjustment', label: 'Stock Adjustment' }
            ]} />
          </Form.Item>
          <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
            <InputNumber min={0.01} max={item.current_stock} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason_notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Describe the usage or reason..." />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setShowStockOut(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Record</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
