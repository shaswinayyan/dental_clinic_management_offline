import { useEffect, useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Switch, message, Space, Divider, Typography, Avatar } from 'antd'
import {
  PlusOutlined, EditOutlined, KeyOutlined, UserOutlined,
  IdcardOutlined, SafetyCertificateOutlined
} from '@ant-design/icons'
import type { User, IpcResult } from '../../../../shared/types'
import { useAuthStore } from '../../store/authStore'

const GOLD   = '#c9a84c'
const NAVY   = '#0a1628'

export default function UserManagement() {
  const [users, setUsers]           = useState<User[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showReset, setShowReset]   = useState<User | null>(null)
  const [showProfile, setShowProfile] = useState<User | null>(null)
  const [saving, setSaving]         = useState(false)
  const [createForm]  = Form.useForm()
  const [resetForm]   = Form.useForm()
  const [profileForm] = Form.useForm()
  const { user: currentUser, login } = useAuthStore()

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
      if (r.success) { message.success('Password updated'); setShowReset(null); resetForm.resetFields() }
      else message.error(r.error)
    } finally { setSaving(false) }
  }

  async function handleSaveProfile(values: { full_name?: string; designation?: string; qualification?: string; license_no?: string }) {
    if (!showProfile) return
    setSaving(true)
    try {
      const r = await (window.api.auth as unknown as { updateProfile: (id: number, data: unknown) => Promise<IpcResult<User>> })
        .updateProfile(showProfile.id, values)
      if (r.success && r.data) {
        message.success('Profile updated')
        // If updating own profile, refresh auth store so sidebar reflects change immediately
        if (showProfile.id === currentUser?.id) login(r.data)
        setShowProfile(null)
        profileForm.resetFields()
        load()
      } else {
        message.error(r.error)
      }
    } finally { setSaving(false) }
  }

  function openProfile(u: User) {
    setShowProfile(u)
    profileForm.setFieldsValue({
      full_name:    u.full_name    ?? '',
      designation:  u.designation  ?? '',
      qualification:u.qualification ?? '',
      license_no:   u.license_no   ?? '',
    })
  }

  async function handleToggle(userId: number, active: boolean) {
    const r = await window.api.auth.toggleUser(userId, active) as IpcResult
    if (r.success) load()
    else message.error(r.error)
  }

  const initials = (name: string) => name.slice(0, 2).toUpperCase()

  const columns = [
    {
      title: 'User',
      render: (_: unknown, u: User) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar style={{ background: u.role === 'doctor' ? 'linear-gradient(135deg,#c9a84c,#8a6020)' : 'linear-gradient(135deg,#4a7cc9,#1e4a8a)', color: '#fff', fontWeight: 700 }}>
            {initials(u.full_name || u.username)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: NAVY }}>
              {u.full_name || u.username}
              {u.full_name && <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 6, fontSize: 12 }}>@{u.username}</span>}
            </div>
            {u.designation && <div style={{ fontSize: 11, color: GOLD }}>{u.designation}</div>}
            {u.qualification && <div style={{ fontSize: 11, color: '#9ca3af' }}>{u.qualification}</div>}
          </div>
        </div>
      )
    },
    {
      title: 'Role', dataIndex: 'role', width: 130,
      render: (v: string) => (
        <Tag style={{
          background: v === 'doctor' ? 'rgba(201,168,76,0.12)' : 'rgba(37,99,235,0.10)',
          border: `1px solid ${v === 'doctor' ? 'rgba(201,168,76,0.35)' : 'rgba(37,99,235,0.25)'}`,
          color: v === 'doctor' ? '#a07020' : '#1d4ed8',
          borderRadius: 20, fontWeight: 600, fontSize: 11, textTransform: 'capitalize'
        }}>
          {v === 'doctor' ? '⚕ Doctor' : '📋 Receptionist'}
        </Tag>
      )
    },
    {
      title: 'Status', dataIndex: 'is_active', width: 100,
      render: (v: number) => (
        <Tag color={v ? 'green' : 'red'} style={{ borderRadius: 12 }}>{v ? 'Active' : 'Inactive'}</Tag>
      )
    },
    {
      title: 'License No.', dataIndex: 'license_no', width: 140,
      render: (v: string) => v ? <span style={{ fontSize: 12, color: '#6b7280' }}>{v}</span> : <span style={{ color: '#d1d5db' }}>—</span>
    },
    {
      title: 'Actions', width: 220,
      render: (_: unknown, u: User) => (
        <Space size={6}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openProfile(u)}
            style={{ borderColor: 'rgba(201,168,76,0.4)', color: GOLD }}>
            Profile
          </Button>
          <Button size="small" icon={<KeyOutlined />} onClick={() => setShowReset(u)}>
            Password
          </Button>
          {u.id !== currentUser?.id && (
            <Switch
              checked={!!u.is_active} size="small"
              onChange={v => handleToggle(u.id, v)}
              checkedChildren="On" unCheckedChildren="Off"
            />
          )}
        </Space>
      )
    }
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, color: NAVY, letterSpacing: '-0.2px' }}>
            Staff & User Management
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            Manage accounts and doctor profiles — names appear across all records, invoices and reports
          </div>
        </div>
        <Button
          type="primary" icon={<PlusOutlined />}
          onClick={() => setShowCreate(true)}
          style={{ fontWeight: 600 }}
        >
          Add User
        </Button>
      </div>

      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        size="middle"
        pagination={false}
        style={{ borderRadius: 8, overflow: 'hidden' }}
      />

      {/* ── Edit Doctor Profile Modal ─────────────────────────────── */}
      <Modal
        open={!!showProfile}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 4, height: 20, borderRadius: 2, background: `linear-gradient(${GOLD},#8a6020)` }} />
            <span style={{ fontWeight: 700, color: NAVY }}>
              {showProfile?.role === 'doctor' ? 'Doctor Profile' : 'Staff Profile'} — {showProfile?.username}
            </span>
          </div>
        }
        footer={null}
        onCancel={() => { setShowProfile(null); profileForm.resetFields() }}
        destroyOnClose
        width={520}
      >
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 12 }}>
          {showProfile?.role === 'doctor'
            ? 'This information is displayed across all patient records, treatment history, billing, and prescriptions.'
            : 'Staff name is shown in appointments, billing records, and audit logs.'}
        </Typography.Text>

        <Form form={profileForm} layout="vertical" onFinish={handleSaveProfile}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item
              name="full_name"
              label={<span style={{ fontSize: 12, fontWeight: 600, color: '#374151', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Full Name</span>}
              style={{ gridColumn: '1 / -1' }}
            >
              <Input
                prefix={<UserOutlined style={{ color: GOLD }} />}
                placeholder={showProfile?.role === 'doctor' ? 'e.g. Rajesh Kumar' : 'e.g. Priya Sharma'}
                size="large"
              />
            </Form.Item>

            {showProfile?.role === 'doctor' && (
              <>
                <Form.Item
                  name="designation"
                  label={<span style={{ fontSize: 12, fontWeight: 600, color: '#374151', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Designation</span>}
                >
                  <Input prefix={<IdcardOutlined style={{ color: GOLD }} />} placeholder="e.g. Chief Dental Surgeon" />
                </Form.Item>

                <Form.Item
                  name="license_no"
                  label={<span style={{ fontSize: 12, fontWeight: 600, color: '#374151', letterSpacing: '0.05em', textTransform: 'uppercase' }}>License / Reg. No.</span>}
                >
                  <Input prefix={<SafetyCertificateOutlined style={{ color: GOLD }} />} placeholder="e.g. TN-DCI-12345" />
                </Form.Item>

                <Form.Item
                  name="qualification"
                  label={<span style={{ fontSize: 12, fontWeight: 600, color: '#374151', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Qualifications</span>}
                  style={{ gridColumn: '1 / -1' }}
                >
                  <Input placeholder="e.g. BDS, MDS (Orthodontics), FAGE" />
                </Form.Item>
              </>
            )}
          </div>

          <Divider style={{ borderColor: 'rgba(201,168,76,0.2)', margin: '12px 0 16px' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setShowProfile(null); profileForm.resetFields() }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving} style={{ fontWeight: 600 }}>
              Save Profile
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── Create User Modal ────────────────────────────────────── */}
      <Modal
        open={showCreate}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 4, height: 20, borderRadius: 2, background: `linear-gradient(${GOLD},#8a6020)` }} />
            <span style={{ fontWeight: 700, color: NAVY }}>Create New User</span>
          </div>
        }
        footer={null}
        onCancel={() => setShowCreate(false)}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined style={{ color: GOLD }} />} placeholder="Login username" />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select
              placeholder="Select role"
              options={[
                { value: 'doctor',       label: '⚕ Doctor — Full clinical access' },
                { value: 'receptionist', label: '📋 Receptionist — Appointments & billing' }
              ]}
            />
          </Form.Item>
          <Form.Item name="password" label="Initial Password" rules={[{ required: true }, { min: 6, message: 'Minimum 6 characters' }]}>
            <Input.Password placeholder="Minimum 6 characters" />
          </Form.Item>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 16 }}>
            After creating the account, use <strong>Edit Profile</strong> to add their full name, designation and qualifications.
          </Typography.Text>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving} style={{ fontWeight: 600 }}>Create User</Button>
          </div>
        </Form>
      </Modal>

      {/* ── Reset Password Modal ──────────────────────────────────── */}
      <Modal
        open={!!showReset}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 4, height: 20, borderRadius: 2, background: `linear-gradient(${GOLD},#8a6020)` }} />
            <span style={{ fontWeight: 700, color: NAVY }}>Reset Password — {showReset?.full_name || showReset?.username}</span>
          </div>
        }
        footer={null}
        onCancel={() => { setShowReset(null); resetForm.resetFields() }}
        destroyOnClose
      >
        <Form form={resetForm} layout="vertical" onFinish={handleResetPassword} style={{ marginTop: 16 }}>
          <Form.Item name="new_password" label="New Password" rules={[{ required: true }, { min: 6, message: 'Minimum 6 characters' }]}>
            <Input.Password prefix={<KeyOutlined style={{ color: GOLD }} />} placeholder="Enter new password" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setShowReset(null); resetForm.resetFields() }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving} style={{ fontWeight: 600 }}>Update Password</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
