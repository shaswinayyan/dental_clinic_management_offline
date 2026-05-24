import { useState, useEffect } from 'react'
import { Form, Input, Button, Card, message, Typography } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import type { User, IpcResult } from '../../../shared/types'

interface Props { onLogin: (user: User) => void }

export default function LoginPage({ onLogin }: Props) {
  const [loading, setLoading] = useState(false)
  // null = still checking; true = changed (hide hint); false = still default (show hint)
  const [credentialsChanged, setCredentialsChanged] = useState<boolean | null>(null)

  useEffect(() => {
    ;(window.api.auth.credentialsChanged() as Promise<IpcResult<boolean>>)
      .then(res => setCredentialsChanged(res.success ? (res.data ?? true) : true))
      .catch(() => setCredentialsChanged(true)) // fail-safe: hide hint on error
  }, [])

  async function handleSubmit(values: { username: string; password: string }) {
    setLoading(true)
    try {
      const result = await window.api.auth.login(values.username, values.password) as IpcResult<User>
      if (result.success && result.data) {
        onLogin(result.data)
      } else {
        message.error(result.error || 'Login failed')
      }
    } catch (e) {
      message.error('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)'
    }}>
      <div style={{ width: 380, textAlign: 'center' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🦷</div>
          <Typography.Title level={2} style={{ color: '#fff', margin: 0 }}>Dental Clinic Manager</Typography.Title>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.7)' }}>Secure • Offline • On-Premise</Typography.Text>
        </div>
        <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <Typography.Title level={4} style={{ marginBottom: 24, color: '#1e3a8a' }}>Sign In</Typography.Title>
          <Form layout="vertical" onFinish={handleSubmit} size="large">
            <Form.Item name="username" rules={[{ required: true, message: 'Please enter your username' }]}>
              <Input prefix={<UserOutlined />} placeholder="Username" autoFocus />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: 'Please enter your password' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Password" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 44 }}>
                Sign In
              </Button>
            </Form.Item>
          </Form>
          {/* Show default credentials ONLY on a fresh install — hidden once any password is changed */}
          {credentialsChanged === false && (
            <div style={{ marginTop: 16, padding: '12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#92400e', textAlign: 'left' }}>
              <strong>First-time setup — default credentials:</strong><br />
              Doctor: <code>doctor</code> / <code>admin123</code><br />
              Receptionist: <code>receptionist</code> / <code>reception123</code><br />
              <span style={{ color: '#b45309', fontStyle: 'italic' }}>
                Please change these passwords in Settings → User Management after first login.
              </span>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
