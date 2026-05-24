import { useEffect, useState } from 'react'
import { Tooltip } from 'antd'
import {
  CalendarOutlined, TeamOutlined, MedicineBoxOutlined, IdcardOutlined,
  BarChartOutlined, CreditCardOutlined, InboxOutlined, AppstoreOutlined,
  PieChartOutlined, SettingOutlined, DatabaseOutlined, AuditOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, ShoppingCartOutlined
} from '@ant-design/icons'
import type { Route } from './MainLayout'
import type { IpcResult, AppSettings } from '../../../../shared/types'
import VorsaLogo from '../VorsaLogo'

interface Props { route: Route; navigate: (r: Route) => void }
interface NavItem { key: Route['page']; icon: React.ReactNode; label: string; badge?: number }
interface NavSection { label: string; items: NavItem[] }

// ── Palette (sidebar is always dark navy, theme-independent) ──────────
const S = {
  bg:          '#0a1628',
  bgHover:     'rgba(201,168,76,0.09)',
  bgActive:    'rgba(201,168,76,0.14)',
  border:      'rgba(201,168,76,0.18)',
  borderLight: 'rgba(255,255,255,0.06)',
  gold:        '#c9a84c',
  goldLight:   '#e8d080',
  silver:      '#7a8da8',
  silverDim:   '#4e5e74',
  white:       '#e8edf5',
}

const sections: NavSection[] = [
  {
    label: 'Clinical',
    items: [
      { key: 'appointments-calendar', icon: <CalendarOutlined />, label: 'Appointments' },
      { key: 'patients',              icon: <TeamOutlined />,     label: 'Patients' },
      { key: 'treatments',            icon: <MedicineBoxOutlined />, label: 'Treatments' },
      { key: 'users',                 icon: <IdcardOutlined />,   label: 'Staff' },
    ]
  },
  {
    label: 'Finance',
    items: [
      { key: 'invoices',         icon: <BarChartOutlined />,    label: 'Revenue' },
      { key: 'ledger',           icon: <CreditCardOutlined />,  label: 'Payment Ledger' },
      { key: 'pharmacy-billing', icon: <ShoppingCartOutlined />, label: 'Pharmacy Billing' },
    ]
  },
  {
    label: 'Inventory',
    items: [
      { key: 'inventory-items', icon: <InboxOutlined />,        label: 'Stocks' },
      { key: 'inventory',       icon: <AppstoreOutlined />,     label: 'Inventory' },
      { key: 'pharmacy-stock',  icon: <MedicineBoxOutlined />,  label: 'Pharmacy Stock' },
    ]
  }
]

const bottomItems: NavItem[] = [
  { key: 'dashboard', icon: <PieChartOutlined />,  label: 'Reports' },
  { key: 'settings',  icon: <SettingOutlined />,   label: 'Settings' },
  { key: 'backup',    icon: <DatabaseOutlined />,  label: 'Backup & Restore' },
  { key: 'audit',     icon: <AuditOutlined />,     label: 'Audit Log' },
]

export default function Sidebar({ route, navigate }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [lowStock, setLowStock]   = useState(0)
  const [clinicName, setClinicName] = useState('Vorsa Clinic')
  const [doctorName, setDoctorName] = useState('')

  useEffect(() => {
    window.api.inventory.getLowStockAlertCount().then((r) => {
      const res = r as IpcResult<number>
      if (res.success && res.data) setLowStock(res.data)
    })
    window.api.settings.get().then((r) => {
      const res = r as IpcResult<AppSettings>
      if (res.success && res.data) {
        setClinicName(res.data.clinic_name || 'Vorsa Clinic')
        setDoctorName((res.data as AppSettings & { doctor_name?: string }).doctor_name || '')
      }
    })
  }, [])

  const activeKey = route.page

  function isActive(key: string) {
    if (key === activeKey) return true
    if (key === 'invoices'       && (activeKey === 'invoice-create'          || activeKey === 'invoice-detail'))     return true
    if (key === 'inventory-items' && activeKey === 'inventory-item-detail')  return true
    if (key === 'patients'        && activeKey === 'patient-detail')          return true
    if (key === 'pharmacy-billing'&& activeKey === 'pharmacy-billing-create') return true
    return false
  }

  function handleNavigate(key: string) {
    navigate({ page: key as Route['page'] } as Route)
  }

  const w = collapsed ? 64 : 236

  return (
    <div
      className="zd-sidebar"
      style={{
        width: w, minWidth: w, maxWidth: w,
        height: '100vh', position: 'sticky', top: 0,
        background: S.bg,
        borderRight: `1px solid ${S.border}`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.24s cubic-bezier(.4,0,.2,1), min-width 0.24s cubic-bezier(.4,0,.2,1)',
        flexShrink: 0, zIndex: 100
      }}
    >
      {/* ── Logo header ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '16px 0' : '16px 16px',
        borderBottom: `1px solid ${S.border}`,
        flexShrink: 0, minHeight: 68,
        background: 'linear-gradient(180deg, rgba(201,168,76,0.07) 0%, transparent 100%)'
      }}>
        <VorsaLogo iconSize={collapsed ? 32 : 36} collapsed={collapsed} />
      </div>

      {/* ── Clinic / doctor card ─────────────────────────────── */}
      {!collapsed && (
        <div style={{
          margin: '12px 12px 4px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 8,
          padding: '10px 12px',
          border: `1px solid ${S.borderLight}`,
          flexShrink: 0
        }}>
          <div style={{
            fontSize: 11.5, fontWeight: 700, color: S.white,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            letterSpacing: '0.01em'
          }}>
            {clinicName}
          </div>
          {doctorName ? (
            <div style={{ fontSize: 10.5, color: S.gold, marginTop: 2, letterSpacing: '0.03em' }}>
              Dr. {doctorName}
            </div>
          ) : (
            <div style={{ fontSize: 10, color: S.silverDim, marginTop: 2, letterSpacing: '0.03em' }}>
              Management System
            </div>
          )}
        </div>
      )}

      {/* ── Navigation ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 4, marginTop: 8 }}>
        {sections.map(section => (
          <div key={section.label}>
            {!collapsed && (
              <div className="zd-section-label">{section.label}</div>
            )}
            {collapsed && <div style={{ height: 12 }} />}

            {section.items.map(item => {
              const active = isActive(item.key)
              const badge  = item.key === 'inventory-items' && lowStock > 0 ? lowStock : undefined

              const content = (
                <div
                  key={item.key}
                  className={`zd-nav-item${active ? ' active' : ''}`}
                  style={collapsed ? { justifyContent: 'center', padding: '10px 0', marginRight: 8, borderRadius: '0 8px 8px 0' } : {}}
                  onClick={() => handleNavigate(item.key)}
                >
                  <span className="zd-nav-icon" style={{ position: 'relative', color: active ? S.gold : S.silver }}>
                    {item.icon}
                    {badge && collapsed && (
                      <span style={{
                        position: 'absolute', top: -5, right: -6,
                        background: '#dc2626', color: '#fff',
                        borderRadius: 8, fontSize: 8, fontWeight: 700, padding: '1px 3px', lineHeight: 1.4
                      }}>{badge}</span>
                    )}
                  </span>
                  {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                  {!collapsed && badge && (
                    <span style={{
                      background: active ? 'rgba(255,255,255,0.18)' : 'rgba(220,38,38,0.15)',
                      color: active ? '#fff' : '#f87171',
                      borderRadius: 10, fontSize: 9.5, fontWeight: 700, padding: '1px 6px'
                    }}>{badge}</span>
                  )}
                </div>
              )
              return collapsed
                ? <Tooltip key={item.key} title={item.label} placement="right" color={S.bg}>{content}</Tooltip>
                : content
            })}
          </div>
        ))}

        {/* Gold divider */}
        <div style={{ height: 1, background: S.border, margin: '10px 18px' }} />

        {/* Bottom items */}
        {bottomItems.map(item => {
          const active = isActive(item.key)
          const content = (
            <div
              key={item.key}
              className={`zd-nav-item${active ? ' active' : ''}`}
              style={collapsed ? { justifyContent: 'center', padding: '10px 0', marginRight: 8, borderRadius: '0 8px 8px 0' } : {}}
              onClick={() => handleNavigate(item.key)}
            >
              <span className="zd-nav-icon" style={{ color: active ? S.gold : S.silver }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </div>
          )
          return collapsed
            ? <Tooltip key={item.key} title={item.label} placement="right" color={S.bg}>{content}</Tooltip>
            : content
        })}
      </div>

      {/* ── Collapse toggle ──────────────────────────────────── */}
      <div style={{
        borderTop: `1px solid ${S.border}`,
        padding: '10px 12px',
        flexShrink: 0,
        display: 'flex',
        justifyContent: collapsed ? 'center' : 'space-between',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.15)'
      }}>
        {!collapsed && (
          <span style={{ fontSize: 10, color: S.silverDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Collapse
          </span>
        )}
        <Tooltip title={collapsed ? 'Expand' : 'Collapse'} placement="right" color={S.bg}>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.borderLight}`,
              borderRadius: 6, width: 32, height: 32,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: S.silver, fontSize: 13, transition: 'background 0.15s, color 0.15s', flexShrink: 0
            }}
            onMouseEnter={e => { e.currentTarget.style.background = S.bgHover; e.currentTarget.style.color = S.gold }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = S.silver }}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
