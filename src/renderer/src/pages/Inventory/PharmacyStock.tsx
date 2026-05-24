import { useEffect, useState } from 'react'
import {
  Card, Table, Tag, Button, Input, Modal, Form,
  InputNumber, message, Statistic, Row, Col, Space
} from 'antd'
import { PlusOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons'
import type { InventoryItem, InventoryTransaction, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import { useAuthStore } from '../../store/authStore'
import { useT } from '../../hooks/useT'
import dayjs from 'dayjs'

interface Props { navigate: (r: Route) => void }

export default function PharmacyStock({ navigate }: Props) {
  const t = useT()
  const { user } = useAuthStore()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all')
  const [showStockIn, setShowStockIn] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [history, setHistory] = useState<InventoryTransaction[]>([])
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const r = await window.api.inventory.listItems({ category: 'medicine' }) as IpcResult<InventoryItem[]>
    if (r.success && r.data) setItems(r.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = items.filter(i => {
    const matchSearch = !search ||
      i.item_name.toLowerCase().includes(search.toLowerCase()) ||
      i.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.storage_location?.toLowerCase().includes(search.toLowerCase())

    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'out' && i.current_stock <= 0) ||
      (statusFilter === 'low' && i.current_stock > 0 && i.current_stock <= i.minimum_stock_level)

    return matchSearch && matchStatus
  })

  const stats = {
    total: items.length,
    low: items.filter(i => i.current_stock > 0 && i.current_stock <= i.minimum_stock_level).length,
    out: items.filter(i => i.current_stock <= 0).length,
    value: items.reduce((s, i) => s + i.current_stock * i.unit_cost, 0)
  }

  function openStockIn(item: InventoryItem) {
    setSelectedItem(item)
    form.resetFields()
    setShowStockIn(true)
  }

  async function openHistory(item: InventoryItem) {
    setSelectedItem(item)
    const r = await window.api.inventory.getTransactionHistory(item.id) as IpcResult<InventoryTransaction[]>
    if (r.success && r.data) setHistory(r.data.slice(0, 30))
    setShowHistory(true)
  }

  async function handleStockIn(values: {
    quantity: number
    batch_number?: string
    expiry_date?: string
    notes?: string
  }) {
    if (!selectedItem || !user) return
    setSaving(true)
    try {
      const r = await window.api.inventory.recordTransaction({
        item_id: selectedItem.id,
        branch_id: 1,
        transaction_type: 'stock_in_purchase',
        quantity: values.quantity,
        batch_number: values.batch_number,
        expiry_date: values.expiry_date,
        reason_notes: values.notes || 'Pharmacy stock replenishment',
        recorded_by: user.id
      }) as IpcResult
      if (r.success) {
        message.success(`${selectedItem.item_name} stock updated (+${values.quantity})`)
        setShowStockIn(false)
        load()
      } else {
        message.error(r.error)
      }
    } finally {
      setSaving(false)
    }
  }

  const TX_TYPE_LABEL: Record<string, { label: string; color: string }> = {
    stock_in_purchase: { label: 'Stock In', color: 'green' },
    stock_in_return: { label: 'Return', color: 'cyan' },
    stock_out_procedure: { label: 'Dispensed', color: 'red' },
    stock_out_wastage: { label: 'Wastage', color: 'orange' },
    stock_out_transfer: { label: 'Transfer', color: 'purple' },
    adjustment: { label: 'Adjustment', color: 'blue' }
  }

  const columns = [
    {
      title: 'Medicine',
      dataIndex: 'item_name',
      render: (v: string, r: InventoryItem) => (
        <div>
          <div style={{ fontWeight: 600, color: t.text }}>{v}</div>
          {r.supplier_name && <div style={{ fontSize: 12, color: t.textSub }}>{r.supplier_name}</div>}
          {r.storage_location && <div style={{ fontSize: 11, color: t.textSub }}>📍 {r.storage_location}</div>}
        </div>
      )
    },
    {
      title: 'Stock',
      dataIndex: 'current_stock',
      width: 130,
      render: (v: number, r: InventoryItem) => {
        const outOfStock = v <= 0
        const isLow = v > 0 && v <= r.minimum_stock_level
        return (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{
              fontWeight: 700, fontSize: 20,
              color: outOfStock ? t.error : isLow ? '#f59e0b' : t.success
            }}>{v}</span>
            <span style={{ color: t.textSub, fontSize: 12 }}>{r.unit_of_measure}</span>
          </div>
        )
      },
      sorter: (a: InventoryItem, b: InventoryItem) => a.current_stock - b.current_stock
    },
    {
      title: 'Min Level',
      dataIndex: 'minimum_stock_level',
      width: 100,
      render: (v: number, r: InventoryItem) => (
        <span style={{ color: t.textSub }}>{v} {r.unit_of_measure}</span>
      )
    },
    {
      title: 'Unit Cost',
      dataIndex: 'unit_cost',
      width: 100,
      render: (v: number) => <span style={{ color: t.text }}>₹{v.toFixed(2)}</span>
    },
    {
      title: 'Stock Value',
      width: 120,
      render: (_: unknown, r: InventoryItem) => (
        <span style={{ color: t.primary, fontWeight: 600 }}>
          ₹{(r.current_stock * r.unit_cost).toLocaleString('en-IN')}
        </span>
      ),
      sorter: (a: InventoryItem, b: InventoryItem) =>
        a.current_stock * a.unit_cost - b.current_stock * b.unit_cost
    },
    {
      title: 'Status',
      width: 110,
      render: (_: unknown, r: InventoryItem) => {
        if (r.current_stock <= 0) return <Tag color="red">Out of Stock</Tag>
        if (r.current_stock <= r.minimum_stock_level) return <Tag color="orange">Low Stock</Tag>
        return <Tag color="green">In Stock</Tag>
      }
    },
    {
      title: 'Actions',
      width: 160,
      render: (_: unknown, r: InventoryItem) => (
        <Space>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<PlusOutlined />}
            onClick={() => openStockIn(r)}
          >
            Stock In
          </Button>
          <Button size="small" onClick={() => openHistory(r)}>History</Button>
        </Space>
      )
    }
  ]

  const historyColumns = [
    {
      title: 'Date',
      dataIndex: 'transaction_date',
      width: 130,
      render: (v: string) => dayjs(v).format('DD MMM YY HH:mm')
    },
    {
      title: 'Type',
      dataIndex: 'transaction_type',
      width: 110,
      render: (v: string) => {
        const info = TX_TYPE_LABEL[v] || { label: v, color: 'default' }
        return <Tag color={info.color}>{info.label}</Tag>
      }
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      width: 70,
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: v > 0 ? t.success : t.error }}>
          {v > 0 ? `+${v}` : v}
        </span>
      )
    },
    {
      title: 'Batch',
      dataIndex: 'batch_number',
      width: 100,
      render: (v: string) => v || '—'
    },
    {
      title: 'Expiry',
      dataIndex: 'expiry_date',
      width: 100,
      render: (v: string) => v ? dayjs(v).format('MMM YYYY') : '—'
    },
    {
      title: 'Notes',
      dataIndex: 'reason_notes',
      render: (v: string) => <span style={{ color: t.textSub }}>{v || '—'}</span>
    }
  ]

  return (
    <div>
      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ background: t.bg, border: `1px solid ${t.border}` }}>
            <Statistic
              title={<span style={{ color: t.textSub }}>Total Medicines</span>}
              value={stats.total}
              valueStyle={{ color: t.text, fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: t.bg, border: `1px solid ${t.border}` }}>
            <Statistic
              title={<span style={{ color: t.textSub }}>Low Stock</span>}
              value={stats.low}
              valueStyle={{ color: '#f59e0b', fontSize: 22 }}
              prefix={stats.low > 0 ? <WarningOutlined /> : undefined}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: t.bg, border: `1px solid ${t.border}` }}>
            <Statistic
              title={<span style={{ color: t.textSub }}>Out of Stock</span>}
              value={stats.out}
              valueStyle={{ color: t.error, fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: t.bg, border: `1px solid ${t.border}` }}>
            <Statistic
              title={<span style={{ color: t.textSub }}>Total Value</span>}
              value={`₹${stats.value.toLocaleString('en-IN')}`}
              valueStyle={{ color: t.primary, fontSize: 18 }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ background: t.bg, border: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <Space wrap>
            <Input
              placeholder="Search medicine, supplier..."
              prefix={<SearchOutlined style={{ color: t.textSub }} />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 240 }}
              allowClear
            />
            <Button
              type={statusFilter === 'all' ? 'primary' : 'default'}
              onClick={() => setStatusFilter('all')}
            >
              All
            </Button>
            <Button
              type={statusFilter === 'low' ? 'primary' : 'default'}
              danger={statusFilter === 'low'}
              onClick={() => setStatusFilter('low')}
            >
              Low Stock ({stats.low})
            </Button>
            <Button
              type={statusFilter === 'out' ? 'primary' : 'default'}
              danger={statusFilter === 'out'}
              onClick={() => setStatusFilter('out')}
            >
              Out of Stock ({stats.out})
            </Button>
          </Space>
          <Button onClick={() => navigate({ page: 'inventory-items' })}>
            Manage All Inventory
          </Button>
        </div>

        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 20 }}
          rowClassName={(r: InventoryItem) =>
            r.current_stock <= 0 ? 'low-stock-row' :
            r.current_stock <= r.minimum_stock_level ? 'low-stock-row' : ''
          }
          locale={{ emptyText: 'No medicines found' }}
        />
      </Card>

      {/* Stock In Modal */}
      <Modal
        open={showStockIn}
        title={
          <span>Stock In — <strong>{selectedItem?.item_name}</strong></span>
        }
        footer={null}
        onCancel={() => setShowStockIn(false)}
        destroyOnClose
        width={460}
      >
        {selectedItem && (
          <div style={{
            padding: '8px 12px', marginBottom: 16,
            background: t.bgFill, borderRadius: 6,
            border: `1px solid ${t.border}`, fontSize: 13
          }}>
            Current stock: <strong>{selectedItem.current_stock} {selectedItem.unit_of_measure}</strong>
            {' · '}
            Min level: {selectedItem.minimum_stock_level} {selectedItem.unit_of_measure}
          </div>
        )}
        <Form form={form} layout="vertical" onFinish={handleStockIn}>
          <Form.Item name="quantity" label="Quantity Received" rules={[{ required: true, message: 'Enter quantity' }]}>
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              placeholder={`Number of ${selectedItem?.unit_of_measure || 'units'}`}
              addonAfter={selectedItem?.unit_of_measure}
            />
          </Form.Item>
          <Form.Item name="batch_number" label="Batch / Lot Number">
            <Input placeholder="e.g. BT2024001" />
          </Form.Item>
          <Form.Item name="expiry_date" label="Expiry Date">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="notes" label="Notes / Remarks">
            <Input.TextArea rows={2} placeholder="Purchase order, supplier, invoice ref, etc." />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setShowStockIn(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              Update Stock
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Transaction History Modal */}
      <Modal
        open={showHistory}
        title={`Transaction History — ${selectedItem?.item_name}`}
        footer={<Button onClick={() => setShowHistory(false)}>Close</Button>}
        onCancel={() => setShowHistory(false)}
        width={680}
      >
        <Table
          dataSource={history}
          columns={historyColumns}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: 'No transactions recorded' }}
          scroll={{ y: 360 }}
        />
      </Modal>
    </div>
  )
}
