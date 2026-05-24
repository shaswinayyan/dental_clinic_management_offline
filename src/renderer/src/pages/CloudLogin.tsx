/**
 * CloudLogin page — SaaS/web mode login.
 * Accepts email + password, calls the REST API, stores tokens, and redirects.
 */
import React, { useState } from 'react'
import {
  Form, Input, Button, Typography, Card, Space, Alert, Checkbox
} from 'antd'
import {
  MedicineBoxOutlined,
  MailOutlined,
  LockOutlined,
} from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useT } from '../hooks/useT'
import { useAuthStore } from '../store/authStore'
import { useApi } from '../context/ApiContext'

const { Title, Text } = Typography

interface LoginForm {
  email:      string
  password:   string
  rememberMe: boolean
}

export default function CloudLogin(): React.ReactElement {
  const t          = useT()
  const api        = useApi()
  const navigate   = useNavigate()
  const cloudLogin = useAuthStore((s) => s.cloudLogin)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const onFinish = async (values: LoginForm): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const session = await api.login(values.email, values.password)
      cloudLogin({
        staff:        session.staff,
        accessToken:  session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn:    session.expiresIn,
      })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--zd-bg-layout)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <Card style={{
        width: '100%',
        maxWidth: 420,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
      }}>
        {/* Logo */}
        <Space direction="vertical" size={4} style={{ width: '100%', textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(201,168,76,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
          }}>
            <MedicineBoxOutlined style={{ fontSize: 28, color: '#c9a84c' }} />
          </div>
          <Title level={3} style={{ margin: '8px 0 0', color: t.text }}>
            Welcome back
          </Title>
          <Text style={{ color: t.textSub }}>Sign in to your clinic account</Text>
        </Space>

        {error && (
          <Alert
            type="error"
            message={error}
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 20 }}
          />
        )}

        <Form
          layout="vertical"
          onFinish={(values) => void onFinish(values as LoginForm)}
          requiredMark={false}
          initialValues={{ rememberMe: false }}
        >
          <Form.Item
            label={<span style={{ color: t.text }}>Email address</span>}
            name="email"
            rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
          >
            <Input
              prefix={<MailOutlined style={{ color: t.textSub }} />}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: t.text }}>Password</span>}
            name="password"
            rules={[{ required: true, message: 'Password is required' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: t.textSub }} />}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item name="rememberMe" valuePropName="checked" style={{ marginBottom: 8 }}>
            <Checkbox style={{ color: t.textSub }}>Keep me signed in</Checkbox>
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={loading}
            style={{
              background: '#c9a84c',
              borderColor: '#c9a84c',
              fontWeight: 600,
              height: 44,
            }}
          >
            Sign in
          </Button>
        </Form>

        <Text style={{ display: 'block', textAlign: 'center', marginTop: 20, color: t.textSub }}>
          New to Vorsa?{' '}
          <Link to="/register" style={{ color: '#c9a84c' }}>Create a clinic account</Link>
        </Text>
      </Card>
    </div>
  )
}
