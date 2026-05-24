/**
 * Doctor / Staff Management page.
 *
 * clinic_owner  → sees all staff across all branches, can assign any role
 * branch_manager → sees only their branch's staff, can add/edit doctor and receptionist
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Switch,
  Typography, Space, Tag, Tooltip, message, Popconfirm, Avatar,
} from 'antd'
import {
  PlusOutlined, EditOutlined, UserDeleteOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useT } from '../../hooks/useT'
import { useApi } from '../../context/ApiContext'
import { useAuthStore } from '../../store/authStore'
import type { StaffMember, Branch, CloudRole } from '../../../../shared/types'

const { Title, Text } = Typography

const ROLE_COLORS: Record<CloudRole, string> = {
  clinic_owner:   'gold',
  branch_manager: 'blue',
  doctor:         'green',
  receptionist:   'default',
}

const ROLE_LABELS: Record<CloudRole, string> = {
  clinic_owner:   'Clinic Owner',
  branch_manager: 'Branch Manager',
  doctor:         'Doctor',
  receptionist:   'Receptionist',
}

export default function DoctorManagement(): React.ReactElement {
  const t              = useT()
  const api            = useApi()
  const role           = useAuthStore((s) => s.role)
  const myBranchId     = useAuthStore((s) => s.branchId)
  const [messageApi, contextHolder] = message.useMessage()

  const [staff,      setStaff]      = useState<StaffMember[]>([])
  const [branches,   setBranches]   = useState<Branch[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editing,    setEditing]    = useState<StaffMember | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [form]                      = Form.useForm()

  const isOwner = role === 'clinic_owner'

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [staffData, branchData] = await Promise.all([
        api.getStaff(isOwner ? undefined : myBranchId ?? undefined),
        isOwner ? api.getBranches() : Promise.resolve([] as Branch[]),
      ])
      setStaff(staffData)
      setBranches(branchData)
    } finally {
      setLoading(false)
    }
  }, [api, isOwner, myBranchId])

  useEffect(() => { void loadData() }, [loadData])

  const openCreate = (): void => {
    setEditing(null)
    form.resetFields()
    if (!isOwner && myBranchId) form.setFieldValue('branch_id', myBranchId)
    setModalOpen(true)
  }

  const openEdit = (member: StaffMember): void => {
    setEditing(member)
    form.setFieldsValue({
      name:        member.name,
      email:       member.email,
      phone:       member.phone,
      role:        member.role,
      designation: member.designation,
      branch_id:   member.branch_id,
      is_active:   member.is_active,
    })
    setModalOpen(true)
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const values = await form.validateFields()
      if (editing) {
        await api.updateStaff(editing.id, values as Partial<StaffMember>)
        void messageApi.success('Staff member updated')
      } else {
        await api.createStaff(values as Omit<StaffMember, 'id' | 'clinic_id' | 'created_at'> & { password: string })
        void messageApi.success('Staff member created')
      }
      setModalOpen(false)
      void loadData()
    } catch { /* form errors shown inline */ }
    finally { setSaving(false) }
  }

  const handleDeactivate = async (id: string): Promise<void> => {
    await api.deleteStaff(id)
    void messageApi.success('Staff member deactivated')
    void loadData()
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (name: string) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} style={{ background: 'rgba(201,168,76,0.2)', color: '#c9a84c' }} />
          <Text style={{ color: t.text }}>{name}</Text>
        </Space>
      ),
    },
    { title: 'Email',       dataIndex: 'email',       render: (v: string) => <Text style={{ color: t.textSub }}>{v}</Text> },
    { title: 'Designation', dataIndex: 'designation', render: (v: string) => v ?? '—' },
    {
      title: 'Role',
      dataIndex: 'role',
      render: (r: CloudRole) => (
        <Tag color={ROLE_COLORS[r]}>{ROLE_LABELS[r]}</Tag>
      ),
    },
    ...(isOwner ? [{
      title: 'Branch',
      dataIndex: 'branch_id',
      render: (bid: string) => {
        const b = branches.find((br) => br.id === bid)
        return b ? b.name : <Text style={{ color: t.textSub }}>All branches</Text>
      },
    }] : []),
    {
      title: 'Status',
      dataIndex: 'is_active',
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Actions',
      render: (_: unknown, row: StaffMember) => (
        <Space>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          </Tooltip>
          <Popconfirm title="Deactivate this staff member?" onConfirm={() => void handleDeactivate(row.id)}>
            <Tooltip title="Deactivate">
              <Button size="small" danger icon={<UserDeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // Roles the current user is allowed to assign
  const assignableRoles: Array<{ value: CloudRole; label: string }> = isOwner
    ? [
        { value: 'branch_manager', label: ROLE_LABELS.branch_manager },
        { value: 'doctor',         label: ROLE_LABELS.doctor },
        { value: 'receptionist',   label: ROLE_LABELS.receptionist },
      ]
    : [
        { value: 'doctor',       label: ROLE_LABELS.doctor },
        { value: 'receptionist', label: ROLE_LABELS.receptionist },
      ]

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: t.text }}>Staff Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#c9a84c', borderColor: '#c9a84c' }}>
          Add Staff Member
        </Button>
      </div>

      <Table
        dataSource={staff}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
      />

      <Modal
        title={<span style={{ color: t.text }}>{editing ? 'Edit Staff Member' : 'Add Staff Member'}</span>}
        open={modalOpen}
        onOk={() => void handleSave()}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okButtonProps={{ style: { background: '#c9a84c', borderColor: '#c9a84c' } }}
        width={520}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            label={<span style={{ color: t.text }}>Full name</span>}
            name="name"
            rules={[{ required: true, min: 2, message: 'Name is required' }]}
          >
            <Input placeholder="Dr. Jane Smith" />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: t.text }}>Email address</span>}
            name="email"
            rules={[{ required: true, type: 'email', message: 'Valid email required' }]}
          >
            <Input placeholder="jane@example.com" disabled={!!editing} />
          </Form.Item>

          {!editing && (
            <Form.Item
              label={<span style={{ color: t.text }}>Password</span>}
              name="password"
              rules={[
                { required: true, min: 8, message: 'At least 8 characters' },
                { pattern: /[A-Z]/, message: 'Must include an uppercase letter' },
                { pattern: /[0-9]/, message: 'Must include a number' },
              ]}
            >
              <Input.Password placeholder="Temporary password" />
            </Form.Item>
          )}

          <Form.Item label={<span style={{ color: t.text }}>Phone</span>} name="phone">
            <Input placeholder="+1 555 000 0000" />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: t.text }}>Role</span>}
            name="role"
            rules={[{ required: true, message: 'Select a role' }]}
          >
            <Select placeholder="Select role">
              {assignableRoles.map((r) => (
                <Select.Option key={r.value} value={r.value}>{r.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label={<span style={{ color: t.text }}>Designation</span>} name="designation">
            <Input placeholder="BDS, MDS, etc." />
          </Form.Item>

          {isOwner && (
            <Form.Item label={<span style={{ color: t.text }}>Branch</span>} name="branch_id">
              <Select placeholder="Select branch" allowClear>
                {branches.map((b) => (
                  <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {editing && (
            <Form.Item
              label={<span style={{ color: t.text }}>Active</span>}
              name="is_active"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
