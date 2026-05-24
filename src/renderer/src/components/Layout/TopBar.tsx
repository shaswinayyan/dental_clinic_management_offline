import { useState } from 'react'
import { Input, Dropdown, Badge, Tooltip, Avatar } from 'antd'
import {
  SearchOutlined, PlusOutlined,
  SunOutlined, MoonFilled, LogoutOutlined, SettingOutlined, UserOutlined,
  BellOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../context/ThemeContext'
import type { Route } from './MainLayout'

interface Props { route: Route; navigate: (r: Route) => void }

const PAGE_TITLES: Partial<Record<Route['page'], string>> = {
  dashboard:               'Reports & Analytics',
  'appointments-calendar': 'Appointments',
  'appointments-list':     'Appointments',
  patients:                'Patients',
  'patient-detail':        'Patient Record',
  invoices:                'Revenue',
  'invoice-create':        'New Invoice',
  'invoice-detail':        'Invoice Detail',
  ledger:                  'Payment Ledger',
  inventory:               'Inventory',
  'inventory-items':       'Stock Management',
  'inventory-item-detail': 'Item Detail',
  treatments:              'Treatments',
  users:                   'Staff Management',
  settings:                'Settings',
  backup:                  'Backup & Restore',
  audit:                   'Audit Log',
  'pharmacy-billing':      'Pharmacy Billing',
  'pharmacy-billing-create':'New Pharmacy Bill',
  'pharmacy-stock':        'Pharmacy Stock',
}

export default function TopBar({ route, navigate }: Props) {
  const { user, logout }    = useAuthStore()
  const { isDark, toggleTheme } = useTheme()
  const [search, setSearch] = useState('')

  const bg      = isDark ? '#111c2e' : '#ffffff'
  const border  = isDark ? '#1e2d45' : '#eaecf0'
  const text1   = isDark ? '#e8edf5' : '#111827'
  const text2   = isDark ? '#7a8da8' : '#6b7280'

  const initials = (user?.username ?? 'U').slice(0, 2).toUpperCase()
  const title    = PAGE_TITLES[route.page] ?? 'Dashboard'

  const quickAddItems = [
    { key: 'appt',    label: 'New Appointment', onClick: () => navigate({ page: 'appointments-calendar' }) },
    { key: 'patient', label: 'New Patient',     onClick: () => navigate({ page: 'patients' }) },
    { key: 'invoice', label: 'New Invoice',     onClick: () => navigate({ page: 'invoice-create' }) },
  ]

  const userMenuItems = [
    { key: 'settings', label: 'Settings', icon: <SettingOutlined />, onClick: () => navigate({ page: 'settings' }) },
    { type: 'divider' as const },
    { key: 'logout',   label: 'Sign Out',  icon: <LogoutOutlined />, danger: true, onClick: logout },
  ]

  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    width: 34, height: 34, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: text2, fontSize: 16, transition: 'background 0.15s, color 0.15s'
  }

  return (
    <div
      className="zd-topbar"
      style={{
        height: 60, background: bg,
        borderBottom: `1px solid ${border}`,
        display: 'flex', alignItems: 'center',
        padding: '0 24px', gap: 14,
        position: 'sticky', top: 0, zIndex: 99,
        flexShrink: 0,
      }}
    >
      {/* Page title */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 140, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 17, color: text1, letterSpacing: '-0.2px', lineHeight: 1.2 }}>
          {title}
        </span>
        <span style={{ fontSize: 10, color: '#c9a84c', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
          Vorsa
        </span>
      </div>

      {/* Search */}
      <div className="zd-search" style={{ flex: 1, maxWidth: 400 }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#c9a84c', opacity: 0.7 }} />}
          placeholder="Search patients, invoices, appointments…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ borderRadius: 20, fontSize: 13 }}
          allowClear
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* Quick add */}
      <Dropdown menu={{ items: quickAddItems }} trigger={['click']}>
        <button style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'linear-gradient(135deg, #e8d080 0%, #c9a84c 60%, #a07828 100%)',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0, color: '#0a1628', fontSize: 17,
          boxShadow: '0 2px 10px rgba(201,168,76,0.45)',
          transition: 'box-shadow 0.2s, transform 0.15s'
        }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(201,168,76,0.65)'; e.currentTarget.style.transform = 'scale(1.08)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 10px rgba(201,168,76,0.45)'; e.currentTarget.style.transform = 'scale(1)' }}
        >
          <PlusOutlined style={{ fontWeight: 900 }} />
        </button>
      </Dropdown>

      {/* Action icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Tooltip title="Notifications">
          <button style={iconBtn} onClick={() => navigate({ page: 'audit' })}>
            <Badge count={0} size="small">
              <BellOutlined style={{ fontSize: 16, color: text2 }} />
            </Badge>
          </button>
        </Tooltip>

        <Tooltip title={isDark ? 'Light Mode' : 'Dark Mode'}>
          <button
            style={{ ...iconBtn, color: isDark ? '#c9a84c' : text2 }}
            onClick={toggleTheme}
          >
            {isDark ? <SunOutlined style={{ fontSize: 16 }} /> : <MoonFilled style={{ fontSize: 15 }} />}
          </button>
        </Tooltip>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 26, background: border }} />

      {/* User */}
      <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', borderRadius: 8, padding: '4px 8px', transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#f5f6f8')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Avatar
            size={33}
            style={{
              background: 'linear-gradient(135deg, #c9a84c, #8a6020)',
              color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0
            }}
          >
            {initials}
          </Avatar>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: text1, whiteSpace: 'nowrap' }}>
              {user?.full_name || user?.username || 'User'}
            </div>
            <div style={{ fontSize: 10, color: '#c9a84c', textTransform: 'capitalize', letterSpacing: '0.05em' }}>
              {user?.designation || user?.role || 'staff'}
            </div>
          </div>
        </div>
      </Dropdown>
    </div>
  )
}
