import { useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useTheme } from '../../context/ThemeContext'
import Dashboard from '../../pages/Dashboard'
import PatientList from '../../pages/Patients/PatientList'
import PatientDetail from '../../pages/Patients/PatientDetail'
import AppointmentScheduler from '../../pages/Appointments/AppointmentScheduler'
import AppointmentList from '../../pages/Appointments/AppointmentList'
import InvoiceList from '../../pages/Billing/InvoiceList'
import InvoiceForm from '../../pages/Billing/InvoiceForm'
import InvoiceDetail from '../../pages/Billing/InvoiceDetail'
import Ledger from '../../pages/Billing/Ledger'
import PharmacyBilling from '../../pages/Billing/PharmacyBilling'
import PharmacyBillingForm from '../../pages/Billing/PharmacyBillingForm'
import InventoryDashboard from '../../pages/Inventory/InventoryDashboard'
import ItemList from '../../pages/Inventory/ItemList'
import ItemDetail from '../../pages/Inventory/ItemDetail'
import PharmacyStock from '../../pages/Inventory/PharmacyStock'
import SettingsPage from '../../pages/Settings/Settings'
import UserManagement from '../../pages/Settings/UserManagement'
import TreatmentCatalogue from '../../pages/Settings/TreatmentCatalogue'
import BackupRestore from '../../pages/Settings/BackupRestore'
import AuditLog from '../../pages/Settings/AuditLog'

export type Route =
  | { page: 'dashboard' }
  | { page: 'patients' }
  | { page: 'patient-detail'; id: number }
  | { page: 'appointments-calendar' }
  | { page: 'appointments-list' }
  | { page: 'invoices' }
  | { page: 'invoice-create'; patientId?: number; appointmentId?: number; prescriptionId?: number }
  | { page: 'invoice-detail'; id: number }
  | { page: 'ledger' }
  | { page: 'pharmacy-billing' }
  | { page: 'pharmacy-billing-create' }
  | { page: 'pharmacy-stock' }
  | { page: 'inventory' }
  | { page: 'inventory-items' }
  | { page: 'inventory-item-detail'; id: number }
  | { page: 'settings' }
  | { page: 'users' }
  | { page: 'treatments' }
  | { page: 'backup' }
  | { page: 'audit' }

// ── Breadcrumb ────────────────────────────────────────────────────────────────
interface Crumb { label: string; route?: Route }

function getBreadcrumbs(route: Route, navigate: (r: Route) => void): Crumb[] {
  switch (route.page) {
    case 'dashboard':
      return [{ label: 'Report' }]
    case 'patients':
      return [{ label: 'Patients' }]
    case 'patient-detail':
      return [{ label: 'Patients', route: { page: 'patients' } }, { label: 'Patient Record' }]
    case 'appointments-calendar':
      return [{ label: 'Appointments' }]
    case 'appointments-list':
      return [{ label: 'Appointments', route: { page: 'appointments-calendar' } }, { label: 'List View' }]
    case 'invoices':
      return [{ label: 'Revenue' }]
    case 'invoice-create':
      return [{ label: 'Revenue', route: { page: 'invoices' } }, { label: 'New Invoice' }]
    case 'invoice-detail':
      return [{ label: 'Revenue', route: { page: 'invoices' } }, { label: 'Invoice Detail' }]
    case 'ledger':
      return [{ label: 'Finance' }, { label: 'Payment Ledger' }]
    case 'pharmacy-billing':
      return [{ label: 'Finance' }, { label: 'Pharmacy Billing' }]
    case 'pharmacy-billing-create':
      return [{ label: 'Finance' }, { label: 'Pharmacy Billing', route: { page: 'pharmacy-billing' } }, { label: 'New Bill' }]
    case 'pharmacy-stock':
      return [{ label: 'Inventory' }, { label: 'Pharmacy Stock' }]
    case 'inventory':
      return [{ label: 'Inventory' }]
    case 'inventory-items':
      return [{ label: 'Inventory', route: { page: 'inventory' } }, { label: 'Stocks' }]
    case 'inventory-item-detail':
      return [{ label: 'Inventory', route: { page: 'inventory' } }, { label: 'Stocks', route: { page: 'inventory-items' } }, { label: 'Item Detail' }]
    case 'settings':
      return [{ label: 'Settings' }]
    case 'users':
      return [{ label: 'Settings', route: { page: 'settings' } }, { label: 'Staff List' }]
    case 'treatments':
      return [{ label: 'Settings', route: { page: 'settings' } }, { label: 'Treatments' }]
    case 'backup':
      return [{ label: 'Settings', route: { page: 'settings' } }, { label: 'Backup & Restore' }]
    case 'audit':
      return [{ label: 'Settings', route: { page: 'settings' } }, { label: 'Audit Log' }]
    default:
      return []
  }
}

function Breadcrumb({ route, navigate }: { route: Route; navigate: (r: Route) => void }) {
  const crumbs = getBreadcrumbs(route, navigate)
  if (crumbs.length <= 1) return null
  return (
    <nav className="zd-breadcrumb">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span className="zd-breadcrumb-sep">›</span>}
            {!isLast && crumb.route ? (
              <button className="zd-breadcrumb-link" onClick={() => navigate(crumb.route!)}>
                {crumb.label}
              </button>
            ) : (
              <span className={isLast ? 'zd-breadcrumb-current' : 'zd-breadcrumb-link'}>
                {crumb.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

export default function MainLayout() {
  const [route, setRoute] = useState<Route>({ page: 'appointments-calendar' })
  const { isDark } = useTheme()

  function navigate(r: Route) { setRoute(r) }

  function renderContent() {
    switch (route.page) {
      case 'dashboard': return <Dashboard navigate={navigate} />
      case 'patients': return <PatientList navigate={navigate} />
      case 'patient-detail': return <PatientDetail id={route.id} navigate={navigate} />
      case 'appointments-calendar': return <AppointmentScheduler navigate={navigate} />
      case 'appointments-list': return <AppointmentList navigate={navigate} />
      case 'invoices': return <InvoiceList navigate={navigate} />
      case 'invoice-create': return (
        <InvoiceForm
          patientId={route.patientId}
          appointmentId={route.appointmentId}
          navigate={navigate}
        />
      )
      case 'invoice-detail': return <InvoiceDetail id={route.id} navigate={navigate} />
      case 'ledger': return <Ledger navigate={navigate} />
      case 'pharmacy-billing': return <PharmacyBilling navigate={navigate} />
      case 'pharmacy-billing-create': return <PharmacyBillingForm navigate={navigate} />
      case 'pharmacy-stock': return <PharmacyStock navigate={navigate} />
      case 'inventory': return <InventoryDashboard navigate={navigate} />
      case 'inventory-items': return <ItemList navigate={navigate} />
      case 'inventory-item-detail': return <ItemDetail id={route.id} navigate={navigate} />
      case 'settings': return <SettingsPage navigate={navigate} />
      case 'users': return <UserManagement navigate={navigate} />
      case 'treatments': return <TreatmentCatalogue navigate={navigate} />
      case 'backup': return <BackupRestore navigate={navigate} />
      case 'audit': return <AuditLog navigate={navigate} />
      default: return <Dashboard navigate={navigate} />
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: isDark ? '#0f172a' : '#f1f5f9' }}>
      <Sidebar route={route} navigate={navigate} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar route={route} navigate={navigate} />
        <Breadcrumb route={route} navigate={navigate} />
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 24px 20px' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
