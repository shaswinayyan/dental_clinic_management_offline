import { useEffect, useState } from 'react'
import { Card, Table, Tag, Button, Alert, List, Statistic, Row, Col, Spin, Typography } from 'antd'
import { WarningOutlined, ExclamationCircleOutlined, PlusOutlined } from '@ant-design/icons'
import type { InventoryItem, InventoryTransaction, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import { useT } from '../../hooks/useT'
import dayjs from 'dayjs'

interface Props { navigate: (r: Route) => void }

interface DashboardData {
  lowStock: InventoryItem[]
  expiringSoon: InventoryTransaction[]
  recentActivity: InventoryTransaction[]
  totalItems: number
}

export default function InventoryDashboard({ navigate }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const t = useT()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const r = await window.api.inventory.getDashboard() as IpcResult<DashboardData>
      if (r.success && r.data) setData(r.data)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Spin />

  const TX_LABELS: Record<string, string> = {
    stock_in_purchase: 'Purchase', stock_in_return: 'Return',
    stock_out_procedure: 'Procedure Use', stock_out_wastage: 'Wastage',
    stock_out_transfer: 'Transfer', adjustment: 'Adjustment'
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0, color: t.text }}>Inventory</Typography.Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={() => navigate({ page: 'inventory-items' })}>Stock List</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate({ page: 'inventory-items' })}>Add Item</Button>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: '4px solid #c9a84c', border: `1px solid ${t.border}`, background: t.bg }}>
            <Statistic title="Active Items" value={data?.totalItems ?? 0} valueStyle={{ color: '#c9a84c', fontSize: 28 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: `4px solid ${(data?.lowStock.length ?? 0) > 0 ? '#dc2626' : '#16a34a'}`, border: `1px solid ${t.border}`, background: t.bg, cursor: 'pointer' }}>
            <Statistic title="Low / Out of Stock" value={data?.lowStock.length ?? 0}
              valueStyle={{ color: (data?.lowStock.length ?? 0) > 0 ? '#dc2626' : '#16a34a', fontSize: 28 }}
              prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: `4px solid ${(data?.expiringSoon.length ?? 0) > 0 ? '#d97706' : '#16a34a'}`, border: `1px solid ${t.border}`, background: t.bg }}>
            <Statistic title="Expiring Soon" value={data?.expiringSoon.length ?? 0}
              valueStyle={{ color: (data?.expiringSoon.length ?? 0) > 0 ? '#d97706' : '#16a34a', fontSize: 28 }}
              prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: '4px solid #a78bfa', border: `1px solid ${t.border}`, background: t.bg }}>
            <Statistic title="Recent Transactions" value={data?.recentActivity.length ?? 0}
              valueStyle={{ color: '#7c3aed', fontSize: 28 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card
            title={<span style={{ color: '#dc2626' }}><WarningOutlined /> Low / Out of Stock</span>}
            extra={<Button size="small" onClick={() => navigate({ page: 'inventory-items' })}>View All</Button>}
          >
            {(data?.lowStock.length ?? 0) === 0 ? (
              <Alert type="success" message="All items are well-stocked!" showIcon />
            ) : (
              <Table
                dataSource={data?.lowStock}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: 'Item', dataIndex: 'item_name', render: (v: string, r: InventoryItem) => (
                    <Button type="link" style={{ padding: 0 }} onClick={() => navigate({ page: 'inventory-item-detail', id: r.id })}>{v}</Button>
                  )},
                  { title: 'Stock', width: 80, render: (_: unknown, r: InventoryItem) => (
                    <span style={{ color: r.current_stock <= 0 ? '#dc2626' : '#d97706', fontWeight: 600 }}>{r.current_stock} {r.unit_of_measure}</span>
                  )},
                  { title: 'Min Level', dataIndex: 'minimum_stock_level', width: 80 },
                  { title: '', width: 80, render: (_: unknown, r: InventoryItem) => (
                    <Tag color={r.current_stock <= 0 ? 'red' : 'orange'}>{r.current_stock <= 0 ? 'OUT' : 'LOW'}</Tag>
                  )}
                ]}
              />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title={<span style={{ color: '#d97706' }}><ExclamationCircleOutlined /> Expiring Soon</span>}>
            {(data?.expiringSoon.length ?? 0) === 0 ? (
              <Alert type="success" message="No items expiring soon!" showIcon />
            ) : (
              <List
                size="small"
                dataSource={data?.expiringSoon}
                renderItem={(item) => (
                  <List.Item>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{(item as InventoryTransaction & { item_name?: string }).item_name}</div>
                      <div style={{ fontSize: 12, color: t.textSub }}>
                        Expires: <strong style={{ color: '#d97706' }}>{item.expiry_date ? dayjs(item.expiry_date).format('DD MMM YYYY') : '—'}</strong>
                        {item.batch_number && ` • Batch: ${item.batch_number}`}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Recent Activity" style={{ marginTop: 16 }}>
        <Table
          dataSource={data?.recentActivity}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: 'Date', dataIndex: 'transaction_date', width: 130, render: (v: string) => dayjs(v).format('DD MMM YYYY') },
            { title: 'Item', key: 'item', render: (_: unknown, r: InventoryTransaction) => (r as InventoryTransaction & { item_name?: string }).item_name },
            { title: 'Type', dataIndex: 'transaction_type', render: (v: string) => (
              <Tag color={v.startsWith('stock_in') ? 'green' : v === 'adjustment' ? 'blue' : 'red'}>{TX_LABELS[v] || v}</Tag>
            )},
            { title: 'Qty', dataIndex: 'quantity', width: 80, render: (v: number) => (
              <span style={{ color: v > 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{v > 0 ? '+' : ''}{v}</span>
            )},
            { title: 'Recorded By', key: 'by', render: (_: unknown, r: InventoryTransaction) => (r as InventoryTransaction & { recorded_by_name?: string }).recorded_by_name }
          ]}
        />
      </Card>
    </div>
  )
}
