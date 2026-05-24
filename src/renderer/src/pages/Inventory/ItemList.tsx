import { useEffect, useState } from 'react'
import { Table, Tag, Button, Select, Input, Card, Modal, Form, InputNumber, message } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { InventoryItem, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import { useAuthStore } from '../../store/authStore'

interface Props { navigate: (r: Route) => void }

const CATEGORIES = ['consumable', 'material', 'instrument', 'medicine', 'ppe', 'equipment']
const UNITS = ['Piece', 'Box', 'Bottle', 'Pack', 'ml', 'g', 'Strip', 'Tube', 'Roll', 'Pair']

export default function ItemList({ navigate }: Props) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<{ category?: string; status?: string; search?: string }>({})
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [form] = Form.useForm()
  const { user } = useAuthStore()

  async function load() {
    setLoading(true)
    const r = await window.api.inventory.listItems(filters) as IpcResult<InventoryItem[]>
    if (r.success && r.data) setItems(r.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [filters])

  function openCreate() { setEditItem(null); form.resetFields(); setShowForm(true) }
  function openEdit(item: InventoryItem) { setEditItem(item); form.setFieldsValue(item); setShowForm(true) }

  async function handleSubmit(values: Omit<InventoryItem, 'id' | 'current_stock'>) {
    setSaving(true)
    try {
      let r: IpcResult
      if (editItem) {
        r = await window.api.inventory.updateItem(editItem.id, values) as IpcResult
      } else {
        r = await window.api.inventory.createItem({ ...values, branch_id: 1, is_active: 1, current_stock: 0 }) as IpcResult
      }
      if (r.success) { message.success(editItem ? 'Item updated' : 'Item created'); setShowForm(false); load() }
      else message.error(r.error)
    } finally { setSaving(false) }
  }

  const STATUS_COLOR: Record<string, string> = { 'In Stock': 'green', 'Low Stock': 'orange', 'Out of Stock': 'red' }
  function getStatus(item: InventoryItem): string {
    if (item.current_stock <= 0) return 'Out of Stock'
    if (item.current_stock <= item.minimum_stock_level) return 'Low Stock'
    return 'In Stock'
  }

  const columns = [
    { title: 'Item Name', dataIndex: 'item_name', render: (v: string, r: InventoryItem) => (
      <Button type="link" style={{ padding: 0, fontWeight: 500 }} onClick={() => navigate({ page: 'inventory-item-detail', id: r.id })}>{v}</Button>
    )},
    { title: 'Category', dataIndex: 'category', width: 120, render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Stock', width: 110, render: (_: unknown, r: InventoryItem) => `${r.current_stock} ${r.unit_of_measure}` },
    { title: 'Min Level', dataIndex: 'minimum_stock_level', width: 90 },
    { title: 'Status', width: 110, render: (_: unknown, r: InventoryItem) => {
      const s = getStatus(r)
      return <Tag color={STATUS_COLOR[s]}>{s}</Tag>
    }},
    { title: 'Unit Cost', dataIndex: 'unit_cost', width: 100, render: (v: number) => `₹${v.toLocaleString('en-IN')}` },
    { title: 'Supplier', dataIndex: 'supplier_name', ellipsis: true, render: (v: string) => v || '—' },
    { title: 'Actions', width: 180, render: (_: unknown, r: InventoryItem) => (
      <div style={{ display: 'flex', gap: 4 }}>
        <Button size="small" onClick={() => navigate({ page: 'inventory-item-detail', id: r.id })}>Details</Button>
        {user?.role === 'doctor' && <Button size="small" onClick={() => openEdit(r)}>Edit</Button>}
      </div>
    )}
  ]

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Select placeholder="Category" style={{ width: 150 }} allowClear onChange={v => setFilters(f => ({ ...f, category: v }))}
            options={CATEGORIES.map(c => ({ value: c, label: c }))} />
          <Select placeholder="Status" style={{ width: 140 }} allowClear onChange={v => setFilters(f => ({ ...f, status: v }))}
            options={[{ value: 'in', label: 'In Stock' }, { value: 'low', label: 'Low Stock' }, { value: 'out', label: 'Out of Stock' }]} />
          <Input.Search placeholder="Search items..." prefix={<SearchOutlined />} style={{ width: 220 }}
            onSearch={v => setFilters(f => ({ ...f, search: v }))} allowClear />
        </div>
        {user?.role === 'doctor' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Item</Button>
        )}
      </div>
      <Table dataSource={items} columns={columns} rowKey="id" loading={loading} size="small"
        pagination={{ pageSize: 20, showTotal: t => `${t} items` }}
        rowClassName={r => getStatus(r as InventoryItem) === 'Out of Stock' ? 'ant-table-row-danger' : getStatus(r as InventoryItem) === 'Low Stock' ? 'ant-table-row-warning' : ''}
      />

      <Modal open={showForm} title={editItem ? 'Edit Item' : 'Add Inventory Item'} footer={null} onCancel={() => setShowForm(false)} width={600} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="item_name" label="Item Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Composite Resin A2 Shade" />
          </Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true }]}>
            <Select options={CATEGORIES.map(c => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="unit_of_measure" label="Unit of Measure" rules={[{ required: true }]}>
            <Select options={UNITS.map(u => ({ value: u, label: u }))} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="minimum_stock_level" label="Min Stock Level" style={{ flex: 1 }} initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="reorder_quantity" label="Reorder Qty" style={{ flex: 1 }} initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="unit_cost" label="Unit Cost (₹)" style={{ flex: 1 }} initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="supplier_name" label="Supplier"><Input /></Form.Item>
          <Form.Item name="storage_location" label="Storage Location"><Input placeholder="Shelf/cabinet reference" /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>{editItem ? 'Update' : 'Add Item'}</Button>
          </div>
        </Form>
      </Modal>
    </Card>
  )
}
