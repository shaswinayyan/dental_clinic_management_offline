import { useState } from 'react'
import { Input, Avatar, Dropdown, Badge, Tooltip } from 'antd'
import {
  SearchOutlined, PlusOutlined, QuestionCircleOutlined,
  SunOutlined, MoonFilled, LogoutOutlined, SettingOutlined, UserOutlined,
  BellOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../context/ThemeContext'
import type { Route } from './MainLayout'

interface Props { route: Route; navigate: (r: Route) => void }

function getPageTitle(route: Route): string {
  switch (route.page) {
    case 'dashboard': return 'Report'
    case 'appointments-calendar': return 'Appointments'
    case 'appointments-list': return 'Appointments'
    case 'patients': return 'Patients'
    case 'patient-detail': return 'Patients'
    case 'invoices': return 'Revenue'
    case 'invoice-create': return 'Revenue'
    case 'invoice-detail': return 'Revenue'
    case 'ledger': return 'Payment Ledger'
    case 'inventory': return 'Inventory'
    case 'inventory-items': return 'Stocks'
    case 'inventory-item-detail': return 'Stocks'
    case 'treatments': return 'Treatments'
    case 'users': return 'Staff List'
    case 'settings': return 'Settings'
    case 'backup': return 'Backup & Restore'
    case 'audit': return 'Audit Log'
    default: return 'Dashboard'
  }
}

export default function TopBar({ route, navigate }: Props) {
  const { user, logout } = useAuthStore()
  const { isDark, toggleTheme } = useTheme()
  const [search, setSearch] = useState('')

  const initials = (user?.username ?? 'U').slice(0, 2).toUpperCase()

  const bg = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#e2e8f0'
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b'
  const iconColor = isDark ? '#94a3b8' : '#64748b'

  const quickAddItems = [
    { key: 'new-appt', label: 'New Appointment', onClick: () => navigate({ page: 'appointments-calendar' }) },
    { key: 'new-patient', label: 'New Patient', onClick: () => navigate({ page: 'patients' }) },
    { key: 'new-invoice', label: 'New Invoice', onClick: () => navigate({ page: 'invoice-create' }) },
  ]

  const userMenuItems = [
    { key: 'profile', label: 'My Profile', icon: <UserOutlined /> },
    { key: 'settings', label: 'Settings', icon: <SettingOutlined />, onClick: () => navigate({ page: 'settings' }) },
    { type: 'divider' as const },
    { key: 'logout', label: 'Sign Out', icon: <LogoutOutlined />, danger: true, onClick: logout },
  ]

  const iconBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    width: 34, height: 34, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: iconColor, fontSize: 16,
    transition: 'background 0.15s, color 0.15s'
  }

  return (
    <div
      className="zd-topbar"
      style={{
        height: 60, background: bg,
        borderBottom: `1px solid ${border}`,
        display: 'flex', alignItems: 'center',
        padding: '0 24px', gap: 16,
        position: 'sticky', top: 0, zIndex: 99,
        flexShrink: 0
      }}
    >
      {/* Page title */}
      <div style={{ fontWeight: 700, fontSize: 20, color: textPrimary, minWidth: 120 }}>
        {getPageTitle(route)}
      </div>

      {/* Search bar */}
      <div className="zd-search" style={{ flex: 1, maxWidth: 420 }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search for anything here..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ borderRadius: 20, fontSize: 13 }}
          allowClear
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* Quick add */}
      <Dropdown menu={{ items: quickAddItems }} trigger={['click']}>
        <button
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#2563eb', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, color: '#fff', fontSize: 18,
            boxShadow: '0 2px 8px rgba(37,99,235,0.35)'
          }}
        >
          <PlusOutlined />
        </button>
      </Dropdown>

      {/* Action icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Tooltip title="Help">
          <button style={iconBtnStyle}><QuestionCircleOutlined /></button>
        </Tooltip>
        <Tooltip title="Notifications">
          <button style={iconBtnStyle} onClick={() => navigate({ page: 'audit' })}>
            <Badge count={0} size="small">
              <BellOutlined style={{ fontSize: 16, color: iconColor }} />
            </Badge>
          </button>
        </Tooltip>
        <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
          <button
            style={{ ...iconBtnStyle, color: isDark ? '#fbbf24' : '#64748b' }}
            onClick={toggleTheme}
          >
            {isDark ? <SunOutlined style={{ fontSize: 17 }} /> : <MoonFilled style={{ fontSize: 16 }} />}
          </button>
        </Tooltip>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: border }} />

      {/* User profile */}
      <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderRadius: 8, padding: '4px 8px', transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = isDark ? '#334155' : '#f8fafc')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Avatar size={34} style={{ background: '#dbeafe', color: '#2563eb', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
            {initials}
          </Avatar>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: textPrimary, whiteSpace: 'nowrap' }}>
              {user?.username ?? 'User'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>
              {user?.role ?? 'staff'}
            </div>
          </div>
        </div>
      </Dropdown>
    </div>
  )
}
