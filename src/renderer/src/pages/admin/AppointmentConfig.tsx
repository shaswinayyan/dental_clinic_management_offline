/**
 * Appointment Configuration page.
 *
 * Per-branch configuration for:
 *  1. Booking mode (slot / open / token)
 *  2. Custom appointment statuses (labels + colors)
 *  3. Custom appointment fields (text, number, date, boolean, select)
 *
 * Access: clinic_owner, branch_manager
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Tabs, Select, Card, Form, InputNumber, Switch, Button,
  Table, Modal, Input, ColorPicker, Space, Tag, Popconfirm,
  Typography, message, Divider, Badge,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  OrderedListOutlined, FormOutlined,
} from '@ant-design/icons'
import type { Color } from 'antd/es/color-picker'
import { useT } from '../../hooks/useT'
import { useApi } from '../../context/ApiContext'
import { useAuthStore } from '../../store/authStore'
import type {
  Branch, ApptConfig, ApptCustomStatus, CustomField, CustomFieldType,
} from '../../../../shared/types'

const { Title, Text } = Typography
const { TabPane }     = Tabs

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text:        'Text',
  number:      'Number',
  date:        'Date',
  boolean:     'Yes / No',
  select:      'Dropdown (single)',
  multiselect: 'Dropdown (multi)',
}

export default function AppointmentConfig(): React.ReactElement {
  const t          = useT()
  const api        = useApi()
  const role       = useAuthStore((s) => s.role)
  const myBranchId = useAuthStore((s) => s.branchId)
  const [messageApi, contextHolder] = message.useMessage()

  const [branches,      setBranches]      = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [apptConfig,    setApptConfig]    = useState<ApptConfig | null>(null)
  const [statuses,      setStatuses]      = useState<ApptCustomStatus[]>([])
  const [fields,        setFields]        = useState<CustomField[]>([])
  const [saving,        setSaving]        = useState(false)

  // Modals
  const [statusModal, setStatusModal] = useState(false)
  const [fieldModal,  setFieldModal]  = useState(false)
  const [editStatus,  setEditStatus]  = useState<ApptCustomStatus | null>(null)
  const [editField,   setEditField]   = useState<CustomField | null>(null)

  const [configForm] = Form.useForm()
  const [statusForm] = Form.useForm()
  const [fieldForm]  = Form.useForm()

  const isOwner = role === 'clinic_owner'

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadBranches = useCallback(async () => {
    if (!isOwner) {
      setSelectedBranch(myBranchId)
      return
    }
    const data = await api.getBranches()
    setBranches(data)
    if (data.length > 0 && !selectedBranch) setSelectedBranch(data[0].id)
  }, [api, isOwner, myBranchId, selectedBranch])

  const loadBranchConfig = useCallback(async (branchId: string) => {
    const [config, statusList, fieldList] = await Promise.all([
      api.getApptConfig(branchId),
      api.getCustomStatuses(branchId),
      api.getCustomFields('appointment'),
    ])
    setApptConfig(config)
    setStatuses(statusList)
    setFields(fieldList)
    configForm.setFieldsValue(config)
  }, [api, configForm])

  useEffect(() => { void loadBranches() }, [loadBranches])

  useEffect(() => {
    if (selectedBranch) void loadBranchConfig(selectedBranch)
  }, [selectedBranch, loadBranchConfig])

  // ── Config save ────────────────────────────────────────────────────────────

  const handleSaveConfig = async (): Promise<void> => {
    if (!selectedBranch) return
    setSaving(true)
    try {
      const vals = await configForm.validateFields()
      await api.updateApptConfig(selectedBranch, vals as Partial<ApptConfig>)
      void messageApi.success('Configuration saved')
      void loadBranchConfig(selectedBranch)
    } catch (err) {
      void messageApi.error(err instanceof Error ? err.message : 'Save failed')
    } finally { setSaving(false) }
  }

  // ── Status CRUD ────────────────────────────────────────────────────────────

  const openStatusModal = (status?: ApptCustomStatus): void => {
    setEditStatus(status ?? null)
    statusForm.setFieldsValue(status ?? { is_default: false, sort_order: statuses.length })
    setStatusModal(true)
  }

  const handleSaveStatus = async (): Promise<void> => {
    if (!selectedBranch) return
    setSaving(true)
    try {
      const vals = statusForm.getFieldsValue() as {
        label: string; color: string | Color; sort_order: number; is_default: boolean
      }
      const color = typeof vals.color === 'string'
        ? vals.color
        : (vals.color as Color).toHexString()

      const payload = { ...vals, color }
      if (editStatus) {
        await api.upsertCustomStatus(selectedBranch, { ...payload, id: editStatus.id } as Omit<ApptCustomStatus, 'clinic_id'>)
      } else {
        await api.upsertCustomStatus(selectedBranch, payload as Omit<ApptCustomStatus, 'id' | 'clinic_id'>)
      }
      void messageApi.success('Status saved')
      setStatusModal(false)
      void loadBranchConfig(selectedBranch)
    } finally { setSaving(false) }
  }

  const handleDeleteStatus = async (id: string): Promise<void> => {
    await api.deleteCustomStatus(id)
    void messageApi.success('Status deleted')
    if (selectedBranch) void loadBranchConfig(selectedBranch)
  }

  // ── Custom field CRUD ──────────────────────────────────────────────────────

  const openFieldModal = (field?: CustomField): void => {
    setEditField(field ?? null)
    fieldForm.setFieldsValue(field ?? { entity_type: 'appointment', is_required: false, sort_order: fields.length })
    setFieldModal(true)
  }

  const handleSaveField = async (): Promise<void> => {
    setSaving(true)
    try {
      const vals = await fieldForm.validateFields()
      await api.upsertCustomField(vals as Omit<CustomField, 'id' | 'clinic_id'>)
      void messageApi.success('Field saved')
      setFieldModal(false)
      if (selectedBranch) void loadBranchConfig(selectedBranch)
    } finally { setSaving(false) }
  }

  const handleDeleteField = async (id: string): Promise<void> => {
    await api.deleteCustomField(id)
    void messageApi.success('Field deleted')
    if (selectedBranch) void loadBranchConfig(selectedBranch)
  }

  // ── Status table columns ───────────────────────────────────────────────────

  const statusColumns = [
    {
      title: 'Label',
      dataIndex: 'label',
      render: (label: string, row: ApptCustomStatus) => (
        <Space>
          <Badge color={row.color} />
          <Text style={{ color: t.text }}>{label}</Text>
          {row.is_default && <Tag color="gold" style={{ fontSize: 11 }}>Default</Tag>}
        </Space>
      ),
    },
    { title: 'Color', dataIndex: 'color', render: (c: string) => (
      <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: 4, background: c, border: `1px solid ${t.border}` }} />
    )},
    { title: 'Order', dataIndex: 'sort_order' },
    {
      title: 'Actions',
      render: (_: unknown, row: ApptCustomStatus) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openStatusModal(row)} />
          <Popconfirm title="Delete this status?" onConfirm={() => void handleDeleteStatus(row.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ── Field table columns ────────────────────────────────────────────────────

  const fieldColumns = [
    { title: 'Label', dataIndex: 'label', render: (v: string) => <Text style={{ color: t.text }}>{v}</Text> },
    { title: 'Type',  dataIndex: 'field_type', render: (v: CustomFieldType) => FIELD_TYPE_LABELS[v] ?? v },
    { title: 'Required', dataIndex: 'is_required', render: (v: boolean) => (
      <Tag color={v ? 'error' : 'default'}>{v ? 'Required' : 'Optional'}</Tag>
    )},
    {
      title: 'Actions',
      render: (_: unknown, row: CustomField) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openFieldModal(row)} />
          <Popconfirm title="Delete this field?" onConfirm={() => void handleDeleteField(row.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: t.text }}>Appointment Configuration</Title>
        {isOwner && (
          <Select
            value={selectedBranch}
            onChange={(v) => setSelectedBranch(v as string)}
            style={{ width: 200 }}
            placeholder="Select branch"
          >
            {branches.map((b) => (
              <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
            ))}
          </Select>
        )}
      </div>

      {selectedBranch && (
        <Tabs defaultActiveKey="mode">
          {/* Booking mode */}
          <TabPane tab="Booking Mode" key="mode">
            <Card style={{ background: t.bg, border: `1px solid ${t.border}`, maxWidth: 500 }}>
              <Form form={configForm} layout="vertical" requiredMark={false}>
                <Form.Item label={<span style={{ color: t.text }}>Booking mode</span>} name="booking_mode">
                  <Select>
                    <Select.Option value="slot">Slot — fixed time slots</Select.Option>
                    <Select.Option value="open">Open — date + doctor, no fixed time</Select.Option>
                    <Select.Option value="token">Token — numbered queue</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item noStyle shouldUpdate={(p, c) => p.booking_mode !== c.booking_mode}>
                  {({ getFieldValue }) =>
                    getFieldValue('booking_mode') === 'slot' ? (
                      <Form.Item label={<span style={{ color: t.text }}>Slot duration</span>} name="slot_duration_mins">
                        <Select>
                          {[10, 15, 20, 30, 45, 60].map((m) => (
                            <Select.Option key={m} value={m}>{m} min</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    ) : null
                  }
                </Form.Item>
                <Form.Item label={<span style={{ color: t.text }}>Advance booking (days)</span>} name="advance_booking_days">
                  <InputNumber min={1} max={365} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label={<span style={{ color: t.text }}>Allow walk-in</span>} name="allow_walk_in" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Button type="primary" loading={saving} onClick={() => void handleSaveConfig()}
                  style={{ background: '#c9a84c', borderColor: '#c9a84c' }}>
                  Save
                </Button>
              </Form>
            </Card>
          </TabPane>

          {/* Custom statuses */}
          <TabPane tab={<><OrderedListOutlined /> Custom Statuses</>} key="statuses">
            <div style={{ marginBottom: 12 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openStatusModal()}
                style={{ background: '#c9a84c', borderColor: '#c9a84c' }}>
                Add Status
              </Button>
            </div>
            <Table
              dataSource={statuses}
              columns={statusColumns}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </TabPane>

          {/* Custom fields */}
          <TabPane tab={<><FormOutlined /> Custom Fields</>} key="fields">
            <div style={{ marginBottom: 12 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openFieldModal()}
                style={{ background: '#c9a84c', borderColor: '#c9a84c' }}>
                Add Field
              </Button>
            </div>
            <Table
              dataSource={fields}
              columns={fieldColumns}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </TabPane>
        </Tabs>
      )}

      {/* Status modal */}
      <Modal
        title={<span style={{ color: t.text }}>{editStatus ? 'Edit Status' : 'New Status'}</span>}
        open={statusModal}
        onOk={() => void handleSaveStatus()}
        onCancel={() => setStatusModal(false)}
        confirmLoading={saving}
        okButtonProps={{ style: { background: '#c9a84c', borderColor: '#c9a84c' } }}
      >
        <Form form={statusForm} layout="vertical">
          <Form.Item label={<span style={{ color: t.text }}>Label</span>} name="label"
            rules={[{ required: true, min: 1, message: 'Label is required' }]}>
            <Input placeholder="e.g. Waiting for Lab" />
          </Form.Item>
          <Form.Item label={<span style={{ color: t.text }}>Color</span>} name="color">
            <ColorPicker format="hex" />
          </Form.Item>
          <Form.Item label={<span style={{ color: t.text }}>Sort order</span>} name="sort_order">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item label={<span style={{ color: t.text }}>Default status</span>} name="is_default" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Custom field modal */}
      <Modal
        title={<span style={{ color: t.text }}>{editField ? 'Edit Field' : 'New Custom Field'}</span>}
        open={fieldModal}
        onOk={() => void handleSaveField()}
        onCancel={() => setFieldModal(false)}
        confirmLoading={saving}
        okButtonProps={{ style: { background: '#c9a84c', borderColor: '#c9a84c' } }}
        width={500}
      >
        <Form form={fieldForm} layout="vertical" requiredMark={false}>
          <Form.Item label={<span style={{ color: t.text }}>Field label</span>} name="label"
            rules={[{ required: true, message: 'Label is required' }]}>
            <Input placeholder="e.g. Insurance number" />
          </Form.Item>
          <Form.Item label={<span style={{ color: t.text }}>Field type</span>} name="field_type"
            rules={[{ required: true }]}>
            <Select placeholder="Select type">
              {(Object.entries(FIELD_TYPE_LABELS) as Array<[CustomFieldType, string]>).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.field_type !== c.field_type}>
            {({ getFieldValue }) =>
              ['select', 'multiselect'].includes(getFieldValue('field_type') as string) ? (
                <Form.Item
                  label={<span style={{ color: t.text }}>Options (one per line)</span>}
                  name="options_text"
                >
                  <Input.TextArea rows={4} placeholder={'Option A\nOption B\nOption C'} />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item label={<span style={{ color: t.text }}>Required</span>} name="is_required" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label={<span style={{ color: t.text }}>Sort order</span>} name="sort_order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
