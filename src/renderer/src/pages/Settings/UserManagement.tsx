import { useEffect, useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Switch, message, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { User, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import { useAuthStore } from '../../store/authStore'

interface Props { navigate: (r: Route) => void }

export default function UserManagement({ navigate }: Props) {
  const [users, setUsers] = useState<User[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showReset, setShowReset] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [createForm] = Form.useForm()
  const [resetForm] = Form.useForm()
  const { user: currentUser } = useAuthStore()

  async function load() {
    const r = await window.api.auth.listUsers() as IpcResult<User[]>
    if (r.success && r.data) setUsers(r.data)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(values: { username: string; password: string; role: string }) {
    setSaving(true)
    try {
      const r = await window.api.auth.createUser(values.username, values.password, values.role) as IpcResult
      if (r.success) { message.success('User created'); setShowCreate(false); createForm.resetFields(); load() }
      else message.error(r.error)
    } finally { setSaving(false) }
  }

  async function handleResetPassword(values: { new_password: string }) {
    if (!showReset) return
    setSaving(true)
    try {
      const r = await window.api.auth.resetPassword(showReset.id, values.new_password) as IpcResult
      if (r.success) { message.success('Password reset'); setShowReset(null); resetForm.resetFields() }
      else message.error(r.error)
    } finally { setSaving(false) }
  }

  async function handleToggle(userId: number, active: boolean) {
    const r = await window.api.auth.toggleUser(userId, active) as IpcResult
    if (r.success) load()
    else message.error(r.error)
  }

  const columns = [
    { title: 'Username', dataIndex: 'username', fontWeight: 500 },
    { title: 'Role', dataIndex: 'role', width: 120, render: (v: string) => <Tag color={v === 'doctor' ? 'blue' : 'green'}>{v}</Tag> },
    { title: 'Status', dataIndex: 'is_active', width: 100, render: (v: number) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag> },
    { title: 'Created', dataIndex: 'created_at', width: 130, render: (v: string) => new Date(v).toLocaleDateString('en-IN') },
    { title: 'Actions', width: 200, render: (_: unknown, r: User) => (
      <Space>
        <Button size="small" onClick={() => setShowReset(r)}>Reset Password</Button>
        {r.id !== currentUser?.id && (
          <Switch checked={!!r.is_active} size="small" onChange={v => handleToggle(r.id, v)} checkedChildren="Active" unCheckedChildren="Inactive" />
        )}
      </Space>
    )}
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 16, color: '#1e3a8a' }}>User Management</div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>Create User</Button>
      </div>
      <Table dataSource={users} columns={columns} rowKey="id" size="small" pagination={false} />

      <Modal open={showCreate} title="Create User" footer={null} onCancel={() => setShowCreate(false)} destroyOnClose>
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input placeholder="Enter username" />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select options={[{ value: 'doctor', label: 'Doctor' }, { value: 'receptionist', label: 'Receptionist' }]} />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }, { min: 6 }]}>
            <Input.Password placeholder="Minimum 6 characters" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Create</Button>
          </div>
        </Form>
      </Modal>

      <Modal open={!!showReset} title={`Reset Password — ${showReset?.username}`} footer={null} onCancel={() => setShowReset(null)} destroyOnClose>
        <Form form={resetForm} layout="vertical" onFinish={handleResetPassword}>
          <Form.Item name="new_password" label="New Password" rules={[{ required: true }, { min: 6 }]}>
            <Input.Password placeholder="Minimum 6 characters" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setShowReset(null)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Reset Password</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
