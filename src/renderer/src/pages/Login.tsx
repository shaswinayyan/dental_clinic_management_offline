import { useState, useEffect } from 'react'
import { Form, Input, Button, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import type { User, IpcResult } from '../../../shared/types'
import VorsaLogo from '../components/VorsaLogo'

interface Props { onLogin: (user: User) => void }

/** Animated gold diagonal lines decoration */
function GridDecoration() {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07, pointerEvents: 'none' }}
      viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice"
    >
      {Array.from({ length: 14 }).map((_, i) => (
        <line key={i} x1={i * 32 - 40} y1="0" x2={i * 32 + 160} y2="600"
          stroke="#c9a84c" strokeWidth="1" />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 64} x2="400" y2={i * 64}
          stroke="#c9a84c" strokeWidth="0.5" />
      ))}
    </svg>
  )
}

export default function LoginPage({ onLogin }: Props) {
  const [loading, setLoading]               = useState(false)
  const [credentialsChanged, setCredChanged] = useState<boolean | null>(null)

  useEffect(() => {
    ;(window.api.auth.credentialsChanged() as Promise<IpcResult<boolean>>)
      .then(r => setCredChanged(r.success ? (r.data ?? true) : true))
      .catch(() => setCredChanged(true))
  }, [])

  async function handleSubmit(values: { username: string; password: string }) {
    setLoading(true)
    try {
      const result = await window.api.auth.login(values.username, values.password) as IpcResult<User>
      if (result.success && result.data) {
        onLogin(result.data)
      } else {
        message.error(result.error || 'Invalid credentials. Please try again.')
      }
    } catch {
      message.error('Unable to connect. Please restart the application.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── LEFT PANEL — dark navy brand panel ─────────────────── */}
      <div style={{
        flex: '0 0 55%', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(155deg, #0a1628 0%, #0f2040 55%, #071020 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 52px'
      }}>
        <GridDecoration />

        {/* Glowing orb */}
        <div style={{
          position: 'absolute', bottom: -120, left: -80,
          width: 420, height: 420,
          background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 280, height: 280,
          background: 'radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none'
        }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <VorsaLogo iconSize={52} />
        </div>

        {/* Hero text */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 38, fontWeight: 800, lineHeight: 1.15,
            color: '#e8edf5', marginBottom: 16, letterSpacing: '-0.5px'
          }}>
            Precision Care.<br />
            <span style={{
              background: 'linear-gradient(90deg, #e8d080 0%, #c9a84c 60%, #a07828 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
            }}>
              Elevated Experience.
            </span>
          </div>
          <p style={{ fontSize: 14, color: '#5e7090', lineHeight: 1.7, maxWidth: 320, margin: 0 }}>
            A complete dental clinic management platform built for modern practices. Secure, offline, and always available.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 28 }}>
            {['Patient Records', 'Smart Billing', 'Dental Charts', 'Inventory', 'Analytics'].map(f => (
              <span key={f} style={{
                padding: '5px 12px', borderRadius: 20,
                border: '1px solid rgba(201,168,76,0.3)',
                background: 'rgba(201,168,76,0.08)',
                color: '#c9a84c', fontSize: 11.5, fontWeight: 600,
                letterSpacing: '0.04em'
              }}>{f}</span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ height: 1, background: 'rgba(201,168,76,0.2)', marginBottom: 16 }} />
          <p style={{ fontSize: 11, color: '#3a4d65', margin: 0, letterSpacing: '0.06em' }}>
            © {new Date().getFullYear()} VORSA DENTAL CLINIC MANAGEMENT · ALL RIGHTS RESERVED
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL — clean white login form ────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#ffffff', padding: '48px 52px',
        position: 'relative'
      }}>
        {/* Subtle top-right accent */}
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: 200, height: 200,
          background: 'radial-gradient(circle at top right, rgba(201,168,76,0.06) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ width: '100%', maxWidth: 360, position: 'relative' }}>
          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0a1628', letterSpacing: '-0.4px', lineHeight: 1.2 }}>
              Welcome back
            </div>
            <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 6, fontWeight: 400 }}>
              Sign in to your clinic account
            </div>
            {/* Gold underline accent */}
            <div style={{ width: 40, height: 3, background: 'linear-gradient(90deg, #c9a84c, #e8d080)', borderRadius: 2, marginTop: 12 }} />
          </div>

          {/* Form */}
          <Form layout="vertical" onFinish={handleSubmit} size="large" requiredMark={false}>
            <Form.Item
              name="username"
              label={<span style={{ fontSize: 12, fontWeight: 600, color: '#374151', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Username</span>}
              rules={[{ required: true, message: 'Please enter your username' }]}
              style={{ marginBottom: 20 }}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#c9a84c' }} />}
                placeholder="Enter your username"
                autoFocus
                style={{ borderRadius: 8, height: 46, borderColor: '#e5e7eb', fontSize: 14 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span style={{ fontSize: 12, fontWeight: 600, color: '#374151', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Password</span>}
              rules={[{ required: true, message: 'Please enter your password' }]}
              style={{ marginBottom: 28 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#c9a84c' }} />}
                placeholder="Enter your password"
                style={{ borderRadius: 8, height: 46, borderColor: '#e5e7eb', fontSize: 14 }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  height: 48, borderRadius: 8, fontSize: 14,
                  fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase'
                }}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </Form.Item>
          </Form>

          {/* First-time setup notice — hidden once passwords changed */}
          {credentialsChanged === false && (
            <div style={{
              marginTop: 24, padding: '14px 16px',
              background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: 8, fontSize: 12, color: '#92400e'
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ First-time setup</div>
              <div>Doctor: <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>doctor</code> / <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>admin123</code></div>
              <div style={{ marginTop: 2 }}>Receptionist: <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>receptionist</code> / <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>reception123</code></div>
              <div style={{ marginTop: 8, color: '#b45309', fontStyle: 'italic' }}>
                Change these in Settings → User Management after first login.
              </div>
            </div>
          )}

          {/* App version */}
          <div style={{ marginTop: 32, textAlign: 'center', fontSize: 11, color: '#d1d5db', letterSpacing: '0.08em' }}>
            VORSA v1.0 · SECURE · OFFLINE · ON-PREMISE
          </div>
        </div>
      </div>
    </div>
  )
}
