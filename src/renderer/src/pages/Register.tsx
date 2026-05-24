/**
 * Register page — new clinic registration (cloud/SaaS mode only).
 *
 * Creates the clinic + clinic_owner account in one shot.
 * On success, the user is redirected to the dashboard (already logged in).
 */
import React, { useState } from 'react'
import {
  Form, Input, Button, Typography, Card, Space, Divider, Alert
} from 'antd'
import {
  MedicineBoxOutlined,
  UserOutlined,
  MailOutlined,
  LockOutlined,
  PhoneOutlined,
  BankOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useT } from '../hooks/useT'
import { useAuthStore } from '../store/authStore'
import { useApi } from '../context/ApiContext'

const { Title, Text } = Typography

interface RegisterForm {
  clinicName:    string
  slug:          string
  ownerName:     string
  ownerEmail:    string
  ownerPassword: string
  confirmPassword: string
  ownerPhone?:   string
  branchName?:   string
}

export default function Register(): React.ReactElement {
  const t          = useT()
  const api        = useApi()
  const navigate   = useNavigate()
  const cloudLogin = useAuthStore((s) => s.cloudLogin)
  const [form]     = Form.useForm<RegisterForm>()
  const [loading, setLoading]  = useState(false)
  const [error,   setError]    = useState<string | null>(null)

  // Auto-generate a slug from the clinic name
  const handleClinicNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50)
    form.setFieldValue('slug', slug)
  }

  const onFinish = async (values: RegisterForm): Promise<void> => {
    if (values.ownerPassword !== values.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError(null)
    try {
      // Registration returns the clinic session directly
      const session = await (api as unknown as {
        register: (data: Omit<RegisterForm, 'confirmPassword'>) => Promise<{
          accessToken: string; refreshToken: string; expiresIn: number; clinicId: string
        }>
      }).register({
        clinicName:    values.clinicName,
        slug:          values.slug,
        ownerName:     values.ownerName,
        ownerEmail:    values.ownerEmail,
        ownerPassword: values.ownerPassword,
        ownerPhone:    values.ownerPhone,
        branchName:    values.branchName,
      })

      // Fetch the staff profile, then log in
      const me = await api.getMe()
      cloudLogin({
        staff:        me,
        accessToken:  session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn:    session.expiresIn,
      })

      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
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
        maxWidth: 560,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
      }}>
        {/* Logo + Header */}
        <Space direction="vertical" size={4} style={{ width: '100%', textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(201,168,76,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
          }}>
            <MedicineBoxOutlined style={{ fontSize: 28, color: '#c9a84c' }} />
          </div>
          <Title level={3} style={{ margin: '8px 0 0', color: t.text }}>
            Create your clinic
          </Title>
          <Text style={{ color: t.textSub }}>
            Set up your Vorsa account — it only takes a minute
          </Text>
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
          form={form}
          layout="vertical"
          onFinish={(values) => void onFinish(values)}
          requiredMark={false}
        >
          <Divider orientation="left" style={{ color: t.textSub, fontSize: 12 }}>
            Clinic details
          </Divider>

          <Form.Item
            label={<span style={{ color: t.text }}>Clinic / Practice name</span>}
            name="clinicName"
            rules={[{ required: true, min: 2, message: 'Enter your clinic name' }]}
          >
            <Input
              prefix={<BankOutlined style={{ color: t.textSub }} />}
              placeholder="Bright Smile Dental"
              onChange={handleClinicNameChange}
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: t.text }}>URL slug <Text type="secondary" style={{ fontSize: 12 }}>(your login identifier)</Text></span>}
            name="slug"
            rules={[
              { required: true, message: 'Slug is required' },
              { pattern: /^[a-z0-9-]+$/, message: 'Only lowercase letters, numbers, and hyphens' },
              { min: 3, message: 'At least 3 characters' },
            ]}
          >
            <Input
              prefix={<><LinkOutlined style={{ color: t.textSub }} /><Text style={{ color: t.textSub, marginLeft: 4 }}>vorsa.app/</Text></>}
              placeholder="bright-smile"
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: t.text }}>First branch name <Text type="secondary" style={{ fontSize: 12 }}>(optional — defaults to clinic name)</Text></span>}
            name="branchName"
          >
            <Input placeholder="Main Branch" />
          </Form.Item>

          <Divider orientation="left" style={{ color: t.textSub, fontSize: 12 }}>
            Owner account
          </Divider>

          <Form.Item
            label={<span style={{ color: t.text }}>Your name</span>}
            name="ownerName"
            rules={[{ required: true, min: 2, message: 'Enter your name' }]}
          >
            <Input prefix={<UserOutlined style={{ color: t.textSub }} />} placeholder="Dr. Jane Smith" />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: t.text }}>Email address</span>}
            name="ownerEmail"
            rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
          >
            <Input prefix={<MailOutlined style={{ color: t.textSub }} />} placeholder="you@example.com" />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: t.text }}>Phone number <Text type="secondary" style={{ fontSize: 12 }}>(optional)</Text></span>}
            name="ownerPhone"
          >
            <Input prefix={<PhoneOutlined style={{ color: t.textSub }} />} placeholder="+1 555 000 0000" />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: t.text }}>Password</span>}
            name="ownerPassword"
            rules={[
              { required: true, min: 8, message: 'At least 8 characters' },
              { pattern: /[A-Z]/, message: 'Must include an uppercase letter' },
              { pattern: /[0-9]/,  message: 'Must include a number' },
            ]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: t.textSub }} />} placeholder="Min. 8 characters" />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: t.text }}>Confirm password</span>}
            name="confirmPassword"
            dependencies={['ownerPassword']}
            rules={[
              { required: true, message: 'Please confirm your password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('ownerPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Passwords do not match'))
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: t.textSub }} />} placeholder="Repeat password" />
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
              marginTop: 8,
            }}
          >
            Create clinic account
          </Button>
        </Form>

        <Text style={{ display: 'block', textAlign: 'center', marginTop: 20, color: t.textSub }}>
          Already have an account?{' '}
          <Link to="/cloud-login" style={{ color: '#c9a84c' }}>Sign in</Link>
        </Text>
      </Card>
    </div>
  )
}
