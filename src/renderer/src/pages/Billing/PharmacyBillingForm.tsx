import { useEffect, useState } from 'react'
import {
  Card, Button, Select, Input, InputNumber, Table, Space, message,
  Row, Col, Divider, Tag, Descriptions, Form, Modal
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, ArrowLeftOutlined, MedicineBoxOutlined
} from '@ant-design/icons'
import type { Patient, InventoryItem, Prescription, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import { useAuthStore } from '../../store/authStore'
import { useT } from '../../hooks/useT'
import dayjs from 'dayjs'

interface Props { navigate: (r: Route) => void }

interface BillItem {
  key: string
  item_id?: number
  description: string
  quantity: number
  unit_price: number
}

export default function PharmacyBillingForm({ navigate }: Props) {
  const t = useT()
  const { user } = useAuthStore()
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [medicines, setMedicines] = useState<InventoryItem[]>([])
  const [medicineSearch, setMedicineSearch] = useState('')
  const [items, setItems] = useState<BillItem[]>([])
  const [discount, setDiscount] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [taxRate, setTaxRate] = useState(0)
  const [saving, setSaving] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [rxModalOpen, setRxModalOpen] = useState<Prescription | null>(null)

  useEffect(() => {
    window.api.billing.getSettings().then(r => {
      const res = r as IpcResult<{ tax_rate: number; discount_threshold: number }>
      if (res.success && res.data) setTaxRate(res.data.tax_rate)
    })
    window.api.inventory.listItems({ category: 'medicine' }).then(r => {
      const res = r as IpcResult<InventoryItem[]>
      if (res.success && res.data) setMedicines(res.data.filter(m => m.is_active))
    })
  }, [])

  useEffect(() => {
    if (!patientSearch || patientSearch.length < 2) { setPatients([]); return }
    const timer = setTimeout(async () => {
      const r = await window.api.patients.list(patientSearch) as IpcResult<Patient[]>
      if (r.success && r.data) setPatients(r.data)
    }, 300)
    return () => clearTimeout(timer)
  }, [patientSearch])

  async function selectPatient(patientId: number) {
    const p = patients.find(px => px.id === patientId) || null
    setSelectedPatient(p)
    if (p) {
      const r = await window.api.patients.listPrescriptions(p.id) as IpcResult<Prescription[]>
      if (r.success && r.data) setPrescriptions(r.data.filter(rx => rx.status === 'active'))
    }
  }

  function addItemFromMedicine(med: InventoryItem) {
    const existing = items.find(i => i.item_id === med.id)
    if (existing) {
      setItems(prev => prev.map(i =>
        i.item_id === med.id ? { ...i, quantity: i.quantity + 1 } : i
      ))
      message.success(`${med.item_name} qty increased`)
      return
    }
    setItems(prev => [...prev, {
      key: `med-${med.id}-${Date.now()}`,
      item_id: med.id,
      description: med.item_name,
      quantity: 1,
      unit_price: med.unit_cost || 0
    }])
  }

  function addFromPrescription(rx: Prescription) {
    if (!rx.items || rx.items.length === 0) return
    let added = 0
    rx.items.forEach(rxItem => {
      const invMatch = medicines.find(m =>
        m.item_name.toLowerCase().includes(rxItem.medicine_name.toLowerCase()) ||
        rxItem.medicine_name.toLowerCase().includes(m.item_name.toLowerCase())
      )
      const key = `rx-${rxItem.id}-${Date.now()}-${Math.random()}`
      setItems(prev => [...prev, {
        key,
        item_id: invMatch?.id,
        description: `${rxItem.medicine_name}${rxItem.dosage ? ` (${rxItem.dosage})` : ''}`,
        quantity: rxItem.quantity || 1,
        unit_price: invMatch?.unit_cost || rxItem.unit_price || 0
      }])
      added++
    })
    message.success(`Added ${added} item(s) from prescription`)
    setRxModalOpen(null)
  }

  function addBlankItem() {
    setItems(prev => [...prev, {
      key: `blank-${Date.now()}`,
      description: '',
      quantity: 1,
      unit_price: 0
    }])
  }

  function updateItem(key: string, field: keyof BillItem, value: unknown) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i))
  }

  function removeItem(key: string) {
    setItems(prev => prev.filter(i => i.key !== key))
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const taxAmount = (subtotal - discount) * (taxRate / 100)
  const total = subtotal - discount + taxAmount

  async function handleSubmit() {
    if (!selectedPatient) { message.error('Please select a patient'); return }
    if (items.length === 0) { message.error('Please add at least one item'); return }
    if (items.some(i => !i.description.trim())) { message.error('All items must have a description'); return }
    if (!user) return

    setSaving(true)
    try {
      const r = await window.api.billing.createInvoice({
        patient_id: selectedPatient.id,
        billing_type: 'pharmacy',
        items: items.map(i => ({
          item_id: i.item_id,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price
        })),
        discount_amount: discount,
        discount_reason: discountReason || undefined,
        tax_rate: taxRate,
        created_by: user.id
      }) as IpcResult<number>

      if (r.success && r.data) {
        message.success('Pharmacy bill created successfully!')
        navigate({ page: 'invoice-detail', id: r.data })
      } else {
        message.error(r.error || 'Failed to create bill')
      }
    } finally {
      setSaving(false)
    }
  }

  const filteredMedicines = medicineSearch
    ? medicines.filter(m =>
        m.item_name.toLowerCase().includes(medicineSearch.toLowerCase()) ||
        m.supplier_name?.toLowerCase().includes(medicineSearch.toLowerCase())
      )
    : medicines

  const itemColumns = [
    {
      title: 'Medicine / Item',
      dataIndex: 'description',
      render: (v: string, record: BillItem) => (
        <Input
          value={v}
          onChange={e => updateItem(record.key, 'description', e.target.value)}
          placeholder="Medicine name or description"
          style={{ background: t.bgFill, color: t.text, borderColor: t.border }}
        />
      )
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      width: 90,
      render: (v: number, record: BillItem) => (
        <InputNumber
          min={1}
          value={v}
          onChange={val => updateItem(record.key, 'quantity', val || 1)}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: 'Unit Price (₹)',
      dataIndex: 'unit_price',
      width: 150,
      render: (v: number, record: BillItem) => (
        <InputNumber
          min={0}
          value={v}
          onChange={val => updateItem(record.key, 'unit_price', val || 0)}
          style={{ width: '100%' }}
          prefix="₹"
        />
      )
    },
    {
      title: 'Total',
      width: 110,
      render: (_: unknown, record: BillItem) => (
        <strong style={{ color: t.text }}>
          ₹{(record.quantity * record.unit_price).toLocaleString('en-IN')}
        </strong>
      )
    },
    {
      title: '',
      width: 50,
      render: (_: unknown, record: BillItem) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeItem(record.key)}
        />
      )
    }
  ]

  return (
    <div>
      {/* Header */}
      <Card style={{ marginBottom: 16, background: t.bg, border: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate({ page: 'pharmacy-billing' })}>
            Back
          </Button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: t.primary }}>New Pharmacy Bill</div>
            <div style={{ fontSize: 13, color: t.textSub }}>
              Dispense medicines and generate pharmacy invoice — stock is auto-deducted
            </div>
          </div>
        </div>
      </Card>

      <Row gutter={16}>
        {/* Left column: Patient + Prescriptions + Bill Items */}
        <Col span={16}>
          {/* Patient Selection */}
          <Card
            title={<span style={{ color: t.text }}>Patient</span>}
            style={{ marginBottom: 16, background: t.bg, border: `1px solid ${t.border}` }}
          >
            <Select
              showSearch
              placeholder="Search patient by name, OP ID or phone..."
              style={{ width: '100%' }}
              filterOption={false}
              onSearch={setPatientSearch}
              onChange={selectPatient}
              options={patients.map(p => ({
                value: p.id,
                label: `${p.name} (${p.op_id}) — ${p.contact_number}`
              }))}
              notFoundContent={
                patientSearch.length < 2
                  ? <span style={{ color: t.textSub }}>Type at least 2 characters to search</span>
                  : <span style={{ color: t.textSub }}>No patients found</span>
              }
            />
            {selectedPatient && (
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: t.bgFill, borderRadius: 8,
                border: `1px solid ${t.border}`
              }}>
                <Descriptions size="small" column={3}>
                  <Descriptions.Item label={<span style={{ color: t.textSub }}>Name</span>}>
                    <strong style={{ color: t.text }}>{selectedPatient.name}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label={<span style={{ color: t.textSub }}>OP ID</span>}>
                    <code style={{ color: t.primary }}>{selectedPatient.op_id}</code>
                  </Descriptions.Item>
                  <Descriptions.Item label={<span style={{ color: t.textSub }}>Phone</span>}>
                    <span style={{ color: t.text }}>{selectedPatient.contact_number}</span>
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}
          </Card>

          {/* Active Prescriptions */}
          {prescriptions.length > 0 && (
            <Card
              title={
                <span style={{ color: t.text }}>
                  <MedicineBoxOutlined style={{ marginRight: 6 }} />
                  Active Prescriptions
                  <Tag color="blue" style={{ marginLeft: 8 }}>{prescriptions.length}</Tag>
                </span>
              }
              style={{ marginBottom: 16, background: t.bg, border: `1px solid ${t.border}` }}
              size="small"
            >
              {prescriptions.map(rx => (
                <div key={rx.id} style={{
                  padding: '10px 14px', marginBottom: 8,
                  background: t.bgFill, borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: t.text }}>
                      Rx #{rx.id} — {dayjs(rx.prescribed_at).format('DD MMM YYYY')}
                      {rx.prescribed_by_name && (
                        <span style={{ color: t.textSub, fontWeight: 400, marginLeft: 8 }}>
                          Dr. {rx.prescribed_by_name}
                        </span>
                      )}
                    </div>
                    {rx.diagnosis && (
                      <div style={{ fontSize: 12, color: t.textSub }}>Dx: {rx.diagnosis}</div>
                    )}
                    {rx.items && rx.items.slice(0, 3).map(rxItem => (
                      <div key={rxItem.id} style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
                        • {rxItem.medicine_name}
                        {rxItem.dosage ? ` (${rxItem.dosage})` : ''}
                        — Qty: {rxItem.quantity}
                      </div>
                    ))}
                    {rx.items && rx.items.length > 3 && (
                      <div style={{ fontSize: 12, color: t.textSub }}>
                        +{rx.items.length - 3} more items
                      </div>
                    )}
                  </div>
                  <Space>
                    <Button size="small" onClick={() => setRxModalOpen(rx)}>View</Button>
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      onClick={() => addFromPrescription(rx)}
                    >
                      Add to Bill
                    </Button>
                  </Space>
                </div>
              ))}
            </Card>
          )}

          {/* Bill Items */}
          <Card
            title={<span style={{ color: t.text }}>Bill Items</span>}
            style={{ background: t.bg, border: `1px solid ${t.border}` }}
            extra={
              <Button icon={<PlusOutlined />} onClick={addBlankItem} size="small">
                Add Row
              </Button>
            }
          >
            <Table
              dataSource={items}
              columns={itemColumns}
              rowKey="key"
              size="small"
              pagination={false}
              locale={{
                emptyText: (
                  <div style={{ color: t.textSub, padding: '20px 0' }}>
                    Search medicines on the right panel and click to add,
                    import from prescription above, or click "Add Row"
                  </div>
                )
              }}
            />

            <Divider />

            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: t.textSub }}>Discount Amount (₹)</label>
                  <InputNumber
                    min={0}
                    max={subtotal}
                    value={discount}
                    onChange={v => setDiscount(v || 0)}
                    style={{ width: '100%', marginTop: 4 }}
                    placeholder="0"
                  />
                </div>
                {discount > 0 && (
                  <div>
                    <label style={{ fontSize: 12, color: t.textSub }}>Discount Reason</label>
                    <Input
                      value={discountReason}
                      onChange={e => setDiscountReason(e.target.value)}
                      placeholder="Reason for discount"
                      style={{ marginTop: 4 }}
                    />
                  </div>
                )}
              </Col>
              <Col span={12}>
                <div style={{
                  padding: '12px 16px',
                  background: t.bgFill,
                  borderRadius: 8,
                  border: `1px solid ${t.border}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: t.textSub }}>Subtotal</span>
                    <span style={{ color: t.text }}>₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: t.textSub }}>Discount</span>
                      <span style={{ color: t.error }}>−₹{discount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {taxRate > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: t.textSub }}>Tax ({taxRate}%)</span>
                      <span style={{ color: t.text }}>₹{taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <Divider style={{ margin: '8px 0', borderColor: t.border }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ color: t.text, fontSize: 16 }}>Total</strong>
                    <strong style={{ color: t.primary, fontSize: 18 }}>
                      ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              </Col>
            </Row>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 12 }}>
              <Button onClick={() => navigate({ page: 'pharmacy-billing' })}>Cancel</Button>
              <Button
                type="primary"
                loading={saving}
                onClick={handleSubmit}
                disabled={items.length === 0 || !selectedPatient}
              >
                Create Pharmacy Bill
              </Button>
            </div>
          </Card>
        </Col>

        {/* Right: Medicine Picker */}
        <Col span={8}>
          <Card
            title={<span style={{ color: t.text }}>Medicine Stock</span>}
            style={{ background: t.bg, border: `1px solid ${t.border}`, position: 'sticky', top: 0 }}
            bodyStyle={{ padding: '12px' }}
          >
            <Input
              placeholder="Search medicines..."
              allowClear
              style={{ marginBottom: 10 }}
              onChange={e => setMedicineSearch(e.target.value)}
              prefix={<span style={{ color: t.textSub, fontSize: 13 }}>🔍</span>}
            />
            <div style={{ maxHeight: 520, overflowY: 'auto', paddingRight: 2 }}>
              {filteredMedicines.map(m => {
                const isLow = m.current_stock <= m.minimum_stock_level
                const outOfStock = m.current_stock <= 0
                return (
                  <div
                    key={m.id}
                    onClick={() => !outOfStock && addItemFromMedicine(m)}
                    style={{
                      padding: '8px 10px', marginBottom: 6,
                      background: t.bgFill, borderRadius: 6,
                      border: `1px solid ${outOfStock ? t.error : isLow ? '#f59e0b' : t.border}`,
                      cursor: outOfStock ? 'not-allowed' : 'pointer',
                      opacity: outOfStock ? 0.55 : 1,
                      transition: 'border-color 0.15s'
                    }}
                    title={outOfStock ? 'Out of stock' : `Click to add ${m.item_name}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: t.text, flex: 1, marginRight: 6 }}>
                        {m.item_name}
                      </span>
                      <Tag
                        color={outOfStock ? 'red' : isLow ? 'orange' : 'green'}
                        style={{ fontSize: 11, lineHeight: '16px' }}
                      >
                        {m.current_stock} {m.unit_of_measure}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
                      ₹{m.unit_cost.toFixed(2)} / {m.unit_of_measure}
                      {isLow && !outOfStock && (
                        <span style={{ color: '#f59e0b', marginLeft: 8 }}>⚠ Low stock</span>
                      )}
                      {outOfStock && (
                        <span style={{ color: t.error, marginLeft: 8 }}>✕ Out of stock</span>
                      )}
                    </div>
                  </div>
                )
              })}
              {filteredMedicines.length === 0 && (
                <div style={{ textAlign: 'center', color: t.textSub, padding: '24px 0', fontSize: 13 }}>
                  No medicines found
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Prescription Detail Modal */}
      <Modal
        open={!!rxModalOpen}
        title={rxModalOpen ? `Prescription #${rxModalOpen.id}` : ''}
        footer={[
          <Button key="cancel" onClick={() => setRxModalOpen(null)}>Close</Button>,
          <Button key="add" type="primary" onClick={() => rxModalOpen && addFromPrescription(rxModalOpen)}>
            Add All to Bill
          </Button>
        ]}
        onCancel={() => setRxModalOpen(null)}
        destroyOnClose
      >
        {rxModalOpen && (
          <div>
            <Descriptions size="small" column={2} style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Date">{dayjs(rxModalOpen.prescribed_at).format('DD MMM YYYY')}</Descriptions.Item>
              {rxModalOpen.prescribed_by_name && (
                <Descriptions.Item label="Doctor">Dr. {rxModalOpen.prescribed_by_name}</Descriptions.Item>
              )}
              {rxModalOpen.diagnosis && (
                <Descriptions.Item label="Diagnosis" span={2}>{rxModalOpen.diagnosis}</Descriptions.Item>
              )}
              {rxModalOpen.notes && (
                <Descriptions.Item label="Notes" span={2}>{rxModalOpen.notes}</Descriptions.Item>
              )}
            </Descriptions>
            {rxModalOpen.items && rxModalOpen.items.map(item => (
              <div key={item.id} style={{
                padding: '8px 12px', marginBottom: 6,
                background: t.bgFill, borderRadius: 6,
                border: `1px solid ${t.border}`
              }}>
                <div style={{ fontWeight: 600 }}>{item.medicine_name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}
                  {item.quantity > 0 && ` — Qty: ${item.quantity}`}
                </div>
                {item.instructions && (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.instructions}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
