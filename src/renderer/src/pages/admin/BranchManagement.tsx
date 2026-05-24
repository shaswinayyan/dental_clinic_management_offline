/**
 * Branch Management page — clinic_owner only.
 *
 * Lets the clinic owner:
 *  - View all branches
 *  - Create / edit / deactivate branches
 *  - Configure working hours per branch (7-day grid)
 *  - Configure appointment booking mode per branch
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Modal, Form, Input, Switch, TimePicker, Select,
  Typography, Space, Tag, Tabs, InputNumber, Card, Row, Col,
  Tooltip, message, Popconfirm,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  ClockCircleOutlined, CalendarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useT } from '../../hooks/useT'
import { useApi } from '../../context/ApiContext'
import type { Branch, WorkingHours, ApptConfig } from '../../../../shared/types'

const { Title, Text } = Typography
const { TabPane }     = Tabs

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function BranchManagement(): React.ReactElement {
  const t   = useT()
  const api = useApi()
  const [messageApi, contextHolder] = message.useMessage()

  const [branches,     setBranches]     = useState<Branch[]>([])
  const [loading,      setLoading]      = useState(true)
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editing,      setEditing]      = useState<Branch | null>(null)
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([])
  const [apptConfig,   setApptConfig]   = useState<ApptConfig | null>(null)
  const [saving,       setSaving]       = useState(false)

  const [branchForm] = Form.useForm()
  const [hoursForm]  = Form.useForm()
  const [configForm] = Form.useForm()

  const loadBranches = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getBranches()
      setBranches(data)
      if (!selectedId && data.length > 0) setSelectedId(data[0].id)
    } catch { /* handled by error boundary */ }
    finally { setLoading(false) }
  }, [api, selectedId])

  const loadBranchDetails = useCallback(async (id: string) => {
    try {
      const [hours, config] = await Promise.all([
        (api as unknown as { getBranchWorkingHours: (id: string) => Promise<WorkingHours[]> }).getBranchWorkingHours(id),
        api.getApptConfig(id),
      ])
      setWorkingHours(hours)
      setApptConfig(config)

      // Populate hours form
      const hoursValues: Record<string, unknown> = {}
      hours.forEach((h) => {
        hoursValues[`is_open_${h.day_of_week}`]    = h.is_open
        hoursValues[`open_time_${h.day_of_week}`]  = dayjs(h.open_time, 'HH:mm')
        hoursValues[`close_time_${h.day_of_week}`] = dayjs(h.close_time, 'HH:mm')
      })
      hoursForm.setFieldsValue(hoursValues)

      configForm.setFieldsValue({
        booking_mode:          config.booking_mode,
        slot_duration_mins:    config.slot_duration_mins,
        advance_booking_days:  config.advance_booking_days,
        allow_walk_in:         config.allow_walk_in,
      })
    } catch { /* */ }
  }, [api, hoursForm, configForm])

  useEffect(() => { void loadBranches() }, [loadBranches])

  useEffect(() => {
    if (selectedId) void loadBranchDetails(selectedId)
  }, [selectedId, loadBranchDetails])

  // ── Branch CRUD ─────────────────────────────────────────────────────────────

  const openCreateModal = (): void => {
    setEditing(null)
    branchForm.resetFields()
    setModalOpen(true)
  }

  const openEditModal = (branch: Branch): void => {
    setEditing(branch)
    branchForm.setFieldsValue({
      name:      branch.name,
      address:   branch.address,
      phone:     branch.phone,
      is_active: branch.is_active,
    })
    setModalOpen(true)
  }

  const handleSaveBranch = async (): Promise<void> => {
    try {
      const values = await branchForm.validateFields()
      setSaving(true)
      if (editing) {
        await api.updateBranch(editing.id, values as Partial<Branch>)
        void messageApi.success('Branch updated')
      } else {
        await api.createBranch(values as Omit<Branch, 'id' | 'clinic_id' | 'created_at'>)
        void messageApi.success('Branch created')
      }
      setModalOpen(false)
      void loadBranches()
    } catch { /* form validation errors are shown inline */ }
    finally { setSaving(false) }
  }

  const handleDeactivate = async (id: string): Promise<void> => {
    await api.deleteBranch(id)
    void messageApi.success('Branch deactivated')
    void loadBranches()
  }

  // ── Working hours save ──────────────────────────────────────────────────────

  const handleSaveHours = async (): Promise<void> => {
    if (!selectedId) return
    setSaving(true)
    try {
      const vals = hoursForm.getFieldsValue() as Record<string, unknown>
      const payload = DAY_NAMES.map((_, i) => ({
        day_of_week: i,
        is_open:     vals[`is_open_${i}`] as boolean ?? false,
        open_time:   (vals[`open_time_${i}`] as dayjs.Dayjs)?.format('HH:mm') ?? '09:00',
        close_time:  (vals[`close_time_${i}`] as dayjs.Dayjs)?.format('HH:mm') ?? '17:00',
      }))
      await (api as unknown as {
        updateBranchWorkingHours: (id: string, data: unknown[]) => Promise<void>
      }).updateBranchWorkingHours(selectedId, payload)
      void messageApi.success('Working hours saved')
    } catch (err) {
      void messageApi.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Appt config save ────────────────────────────────────────────────────────

  const handleSaveConfig = async (): Promise<void> => {
    if (!selectedId) return
    setSaving(true)
    try {
      const vals = await configForm.validateFields()
      await api.updateApptConfig(selectedId, vals as Partial<ApptConfig>)
      void messageApi.success('Appointment configuration saved')
    } catch (err) {
      void messageApi.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Table columns ───────────────────────────────────────────────────────────

  const columns = [
    {
      title: 'Branch',
      dataIndex: 'name',
      render: (name: string, row: Branch) => (
        <a style={{ color: '#c9a84c' }} onClick={() => setSelectedId(row.id)}>{name}</a>
      ),
    },
    { title: 'Phone',   dataIndex: 'phone',   render: (v: string) => v ?? '—' },
    { title: 'Address', dataIndex: 'address', render: (v: string) => v ?? '—', ellipsis: true },
    {
      title: 'Status',
      dataIndex: 'is_active',
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Actions',
      render: (_: unknown, row: Branch) => (
        <Space>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(row)} />
          </Tooltip>
          <Popconfirm
            title="Deactivate this branch?"
            onConfirm={() => void handleDeactivate(row.id)}
          >
            <Tooltip title="Deactivate">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────

  const selected = branches.find((b) => b.id === selectedId)

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: t.text }}>Branch Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}
          style={{ background: '#c9a84c', borderColor: '#c9a84c' }}>
          New Branch
        </Button>
      </div>

      <Table
        dataSource={branches}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={false}
        style={{ marginBottom: 28 }}
        rowClassName={(row) => row.id === selectedId ? 'ant-table-row-selected' : ''}
      />

      {/* Branch configuration panel */}
      {selected && (
        <Card
          title={
            <Text style={{ color: t.text, fontWeight: 600 }}>
              Configure: {selected.name}
            </Text>
          }
          style={{ background: t.bg, border: `1px solid ${t.border}` }}
        >
          <Tabs defaultActiveKey="hours">
            {/* Working hours */}
            <TabPane tab={<><ClockCircleOutlined /> Working Hours</>} key="hours">
              <Form form={hoursForm} layout="horizontal">
                {DAY_NAMES.map((day, i) => (
                  <Row key={i} gutter={12} align="middle" style={{ marginBottom: 12 }}>
                    <Col span={5}>
                      <Form.Item name={`is_open_${i}`} valuePropName="checked" style={{ margin: 0 }}>
                        <Switch checkedChildren={day} unCheckedChildren={day} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name={`open_time_${i}`} style={{ margin: 0 }}>
                        <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={1} style={{ textAlign: 'center', color: t.textSub }}>–</Col>
                    <Col span={8}>
                      <Form.Item name={`close_time_${i}`} style={{ margin: 0 }}>
                        <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                ))}
                <Button type="primary" loading={saving} onClick={() => void handleSaveHours()}
                  style={{ background: '#c9a84c', borderColor: '#c9a84c' }}>
                  Save Working Hours
                </Button>
              </Form>
            </TabPane>

            {/* Appointment config */}
            <TabPane tab={<><CalendarOutlined /> Appointment Settings</>} key="appt">
              <Form form={configForm} layout="vertical" style={{ maxWidth: 480 }}>
                <Form.Item label={<span style={{ color: t.text }}>Booking mode</span>} name="booking_mode">
                  <Select>
                    <Select.Option value="slot">
                      Slot — fixed time slots (e.g. 09:00, 09:30…)
                    </Select.Option>
                    <Select.Option value="open">
                      Open — date + doctor, no fixed time
                    </Select.Option>
                    <Select.Option value="token">
                      Token — numbered queue (T-001, T-002…)
                    </Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  noStyle
                  shouldUpdate={(prev, cur) => prev.booking_mode !== cur.booking_mode}
                >
                  {({ getFieldValue }) =>
                    getFieldValue('booking_mode') === 'slot' ? (
                      <Form.Item
                        label={<span style={{ color: t.text }}>Slot duration (minutes)</span>}
                        name="slot_duration_mins"
                        rules={[{ required: true }]}
                      >
                        <Select>
                          {[10, 15, 20, 30, 45, 60].map((m) => (
                            <Select.Option key={m} value={m}>{m} min</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    ) : null
                  }
                </Form.Item>

                <Form.Item
                  label={<span style={{ color: t.text }}>Advance booking days</span>}
                  name="advance_booking_days"
                >
                  <InputNumber min={1} max={365} style={{ width: '100%' }} addonAfter="days" />
                </Form.Item>

                <Form.Item
                  label={<span style={{ color: t.text }}>Allow walk-in</span>}
                  name="allow_walk_in"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <Button type="primary" loading={saving} onClick={() => void handleSaveConfig()}
                  style={{ background: '#c9a84c', borderColor: '#c9a84c' }}>
                  Save Configuration
                </Button>
              </Form>
            </TabPane>
          </Tabs>
        </Card>
      )}

      {/* Create / Edit branch modal */}
      <Modal
        title={<span style={{ color: t.text }}>{editing ? 'Edit Branch' : 'New Branch'}</span>}
        open={modalOpen}
        onOk={() => void handleSaveBranch()}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okButtonProps={{ style: { background: '#c9a84c', borderColor: '#c9a84c' } }}
      >
        <Form form={branchForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label={<span style={{ color: t.text }}>Branch name</span>}
            name="name"
            rules={[{ required: true, min: 2, message: 'Enter branch name' }]}
          >
            <Input placeholder="Main Branch" />
          </Form.Item>
          <Form.Item label={<span style={{ color: t.text }}>Address</span>} name="address">
            <Input.TextArea rows={2} placeholder="123 Dental St, City" />
          </Form.Item>
          <Form.Item label={<span style={{ color: t.text }}>Phone</span>} name="phone">
            <Input placeholder="+1 555 000 0000" />
          </Form.Item>
          <Form.Item label={<span style={{ color: t.text }}>Active</span>} name="is_active" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
