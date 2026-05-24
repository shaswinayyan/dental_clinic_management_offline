import { useEffect, useState } from 'react'
import { Avatar, Tooltip } from 'antd'
import {
  CalendarOutlined, TeamOutlined, MedicineBoxOutlined, IdcardOutlined,
  BarChartOutlined, CreditCardOutlined, InboxOutlined, AppstoreOutlined,
  PieChartOutlined, SettingOutlined, DatabaseOutlined, AuditOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, ShoppingCartOutlined
} from '@ant-design/icons'
import type { Route } from './MainLayout'
import type { IpcResult } from '../../../../shared/types'
import { useTheme } from '../../context/ThemeContext'

interface Props { route: Route; navigate: (r: Route) => void }

interface NavItem { key: Route['page']; icon: React.ReactNode; label: string; badge?: number }
interface NavSection { label: string; items: NavItem[] }

const ToothIcon = ({ color }: { color: string }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M12 2C9.5 2 7.5 3.5 6.5 5.5C5.5 4.5 4 4 3 5C1.5 6.5 2 9 3 11C4 13 4 15 4.5 17.5C5 20 6.5 22 8 22C9 22 9.5 21 10 19.5C10.5 18 11 17 12 17C13 17 13.5 18 14 19.5C14.5 21 15 22 16 22C17.5 22 19 20 19.5 17.5C20 15 20 13 21 11C22 9 22.5 6.5 21 5C20 4 18.5 4.5 17.5 5.5C16.5 3.5 14.5 2 12 2Z"
      fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
)

const sections: NavSection[] = [
  {
    label: 'Clinic',
    items: [
      { key: 'appointments-calendar', icon: <CalendarOutlined />, label: 'Appointments' },
      { key: 'patients', icon: <TeamOutlined />, label: 'Patients' },
      { key: 'treatments', icon: <MedicineBoxOutlined />, label: 'Treatments' },
      { key: 'users', icon: <IdcardOutlined />, label: 'Staff List' },
    ]
  },
  {
    label: 'Finance',
    items: [
      { key: 'invoices', icon: <BarChartOutlined />, label: 'Revenue' },
      { key: 'ledger', icon: <CreditCardOutlined />, label: 'Payment Ledger' },
      { key: 'pharmacy-billing', icon: <ShoppingCartOutlined />, label: 'Pharmacy Billing' },
    ]
  },
  {
    label: 'Physical Asset',
    items: [
      { key: 'inventory-items', icon: <InboxOutlined />, label: 'Stocks' },
      { key: 'inventory', icon: <AppstoreOutlined />, label: 'Inventory' },
      { key: 'pharmacy-stock', icon: <MedicineBoxOutlined />, label: 'Pharmacy Stock' },
    ]
  }
]

const bottomItems: NavItem[] = [
  { key: 'dashboard', icon: <PieChartOutlined />, label: 'Report' },
  { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
  { key: 'backup', icon: <DatabaseOutlined />, label: 'Backup & Restore' },
  { key: 'audit', icon: <AuditOutlined />, label: 'Audit Log' },
]

export default function Sidebar({ route, navigate }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [lowStock, setLowStock] = useState(0)
  const { isDark } = useTheme()

  const bg = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#e2e8f0'
  const subBg = isDark ? '#0f172a' : '#f8fafc'
  const subBorder = isDark ? '#334155' : '#e2e8f0'
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b'
  const textMuted = isDark ? '#94a3b8' : '#94a3b8'
  const toggleBg = isDark ? '#334155' : '#f1f5f9'
  const toggleColor = isDark ? '#94a3b8' : '#64748b'

  useEffect(() => {
    window.api.inventory.getLowStockAlertCount().then((r) => {
      const result = r as IpcResult<number>
      if (result.success && result.data) setLowStock(result.data)
    })
  }, [])

  const activeKey = route.page

  function isActive(key: string) {
    if (key === activeKey) return true
    if (key === 'invoices' && (activeKey === 'invoice-create' || activeKey === 'invoice-detail')) return true
    if (key === 'inventory-items' && activeKey === 'inventory-item-detail') return true
    if (key === 'patients' && activeKey === 'patient-detail') return true
    if (key === 'pharmacy-billing' && activeKey === 'pharmacy-billing-create') return true
    return false
  }

  function handleNavigate(key: string) {
    navigate({ page: key as Route['page'] } as Route)
  }

  const w = collapsed ? 68 : 232

  return (
    <div
      className="zd-sidebar"
      style={{
        width: w, minWidth: w, maxWidth: w,
        height: '100vh', position: 'sticky', top: 0,
        background: bg,
        borderRight: `1px solid ${border}`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.22s cubic-bezier(.4,0,.2,1), min-width 0.22s cubic-bezier(.4,0,.2,1)',
        flexShrink: 0, zIndex: 100
      }}
    >
      {/* Logo header — no toggle button here */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '18px 0' : '18px 18px',
        borderBottom: `1px solid ${border}`,
        flexShrink: 0, gap: 10, minHeight: 62
      }}>
        <ToothIcon color="#2563eb" />
        {!collapsed && (
          <span style={{
            fontWeight: 800, fontSize: 17, color: '#2563eb',
            whiteSpace: 'nowrap', letterSpacing: '-0.4px'
          }}>
            Zendenta
          </span>
        )}
      </div>

      {/* Clinic info card */}
      {!collapsed && (
        <div style={{
          margin: '10px 12px 2px',
          background: subBg,
          borderRadius: 10,
          padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: 10,
          border: `1px solid ${subBorder}`, flexShrink: 0
        }}>
          <Avatar size={34} style={{ background: '#dbeafe', color: '#2563eb', flexShrink: 0, fontSize: 14, fontWeight: 700 }}>C</Avatar>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, fontSize: 12.5, color: textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Dental Clinic
            </div>
            <div style={{ fontSize: 11, color: textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Management System
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 4 }}>
        {sections.map(section => (
          <div key={section.label}>
            {!collapsed && (
              <div className="zd-section-label" style={{ color: textMuted }}>{section.label}</div>
            )}
            {collapsed && <div style={{ height: 10 }} />}
            {section.items.map(item => {
              const active = isActive(item.key)
              const badge = item.key === 'inventory-items' && lowStock > 0 ? lowStock : undefined
              const content = (
                <div
                  key={item.key}
                  className={`zd-nav-item${active ? ' active' : ''}`}
                  style={{
                    ...(collapsed ? { justifyContent: 'center', padding: '10px 0', margin: '2px 8px' } : {}),
                    ...(isDark && !active ? { color: '#94a3b8' } : {})
                  }}
                  onClick={() => handleNavigate(item.key)}
                >
                  <span className="zd-nav-icon" style={{ position: 'relative' }}>
                    {item.icon}
                    {badge && !collapsed && (
                      <span style={{
                        position: 'absolute', top: -6, right: -8,
                        background: '#ef4444', color: '#fff',
                        borderRadius: 10, fontSize: 9, fontWeight: 700,
                        padding: '1px 4px', lineHeight: 1.4
                      }}>{badge}</span>
                    )}
                  </span>
                  {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                  {!collapsed && badge && (
                    <span style={{
                      background: active ? 'rgba(255,255,255,0.25)' : '#fee2e2',
                      color: active ? '#fff' : '#dc2626',
                      borderRadius: 10, fontSize: 10, fontWeight: 700,
                      padding: '1px 6px', lineHeight: 1.4
                    }}>{badge}</span>
                  )}
                </div>
              )
              return collapsed
                ? <Tooltip key={item.key} title={item.label} placement="right">{content}</Tooltip>
                : content
            })}
          </div>
        ))}

        {/* Divider */}
        <div style={{ height: 1, background: border, margin: '8px 16px' }} />

        {/* Bottom standalone items */}
        {bottomItems.map(item => {
          const active = isActive(item.key)
          const content = (
            <div
              key={item.key}
              className={`zd-nav-item${active ? ' active' : ''}`}
              style={{
                ...(collapsed ? { justifyContent: 'center', padding: '10px 0', margin: '2px 8px' } : {}),
                ...(isDark && !active ? { color: '#94a3b8' } : {})
              }}
              onClick={() => handleNavigate(item.key)}
            >
              <span className="zd-nav-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </div>
          )
          return collapsed
            ? <Tooltip key={item.key} title={item.label} placement="right">{content}</Tooltip>
            : content
        })}
      </div>

      {/* Collapse toggle at the very bottom */}
      <div style={{
        borderTop: `1px solid ${border}`,
        padding: '10px 12px',
        flexShrink: 0, display: 'flex',
        justifyContent: collapsed ? 'center' : 'flex-start'
      }}>
        <Tooltip title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'} placement="right">
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              background: toggleBg, border: 'none', borderRadius: 8,
              width: 36, height: 36, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              color: toggleColor, fontSize: 14, transition: 'background 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = isDark ? '#475569' : '#e2e8f0')}
            onMouseLeave={e => (e.currentTarget.style.background = toggleBg)}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        </Tooltip>
        {!collapsed && (
          <span style={{ marginLeft: 10, fontSize: 12, color: textMuted, alignSelf: 'center' }}>
            Collapse
          </span>
        )}
      </div>
    </div>
  )
}
