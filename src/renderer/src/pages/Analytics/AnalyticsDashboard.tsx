/**
 * Analytics Dashboard — PRD §9.5
 *
 * Requires Business or Enterprise plan.  Displays:
 *   • KPI summary cards (revenue, appointments, patients)
 *   • Revenue over time (CSS bar chart — no external lib required)
 *   • Top procedures table
 *   • Doctor performance table
 *   • Lapsed-patients table
 *
 * All data is fetched from /api/v2/analytics/*.
 * Falls back to a plan-gate banner for Starter plans.
 */
import { useEffect, useState, useCallback } from 'react'
import {
  Select, DatePicker, Button, Statistic, Table, Tag, Tooltip,
  Spin, Alert, Progress, Segmented
} from 'antd'
import {
  ArrowUpOutlined, ArrowDownOutlined,
  ReloadOutlined, LockOutlined,
  UserOutlined, CalendarOutlined,
  DollarOutlined, MedicineBoxOutlined,
  TeamOutlined, ExclamationCircleOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useApi } from '../../context/ApiContext'
import { useAuthStore } from '../../store/authStore'
import type { ClinicPlan } from '../../../../shared/types'

const { RangePicker } = DatePicker

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  revenue: {
    today: number; this_month: number; last_month: number
    outstanding: number; growth_pct: number | null
  }
  appointments: {
    today: number; confirmed: number; completed: number
    cancelled: number; cancellation_rate: number
  }
  patients: { total: number; new_this_month: number; lapsed: number }
}

interface RevenueRow {
  period: string; branch_name: string
  revenue: number | string; invoice_count: number | string
}

interface ProcedureRow {
  treatment_name: string; category: string
  volume: number | string; revenue: number | string; avg_price: number | string
}

interface DoctorRow {
  doctor_id: string; doctor_name: string; designation: string
  completed: number | string; cancelled: number | string
  unique_patients: number | string; revenue_generated: number | string
}

interface LapsedPatient {
  id: string; op_id: string; name: string
  contact_number: string; last_visit: string | null
}

// ── Colour palette (matches PRD §10) ─────────────────────────────────────────

const C = {
  gold:    '#c9a84c',
  navy:    '#0d1b2a',
  green:   '#22c55e',
  red:     '#ef4444',
  blue:    '#3b82f6',
  purple:  '#a855f7',
  orange:  '#f97316',
  teal:    '#14b8a6',
}

// ── Currency helper (reads from settings, defaults to the raw number) ─────────

function fmt(val: number | string, prefix = ''): string {
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return '—'
  return `${prefix}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtInt(val: number | string): string {
  const n = typeof val === 'string' ? parseInt(val as string, 10) : val
  return isNaN(n) ? '—' : n.toLocaleString()
}

// ── Mini bar chart (CSS only) ─────────────────────────────────────────────────

interface BarData { label: string; value: number; color?: string }

function MiniBarChart({ data, height = 80, currency = '' }: { data: BarData[]; height?: number; currency?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, padding: '4px 0' }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100
        return (
          <Tooltip key={i} title={`${d.label}: ${currency}${d.value.toLocaleString()}`}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'default' }}>
              <div
                style={{
                  width: '100%', background: d.color ?? C.gold,
                  borderRadius: '3px 3px 0 0',
                  height: `${Math.max(pct, 2)}%`,
                  transition: 'height 0.4s ease',
                  opacity: 0.85,
                }}
              />
              <span style={{ fontSize: 9, color: 'var(--text-muted, #7a8da8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center' }}>
                {d.label}
              </span>
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon, title, value, prefix = '', suffix = '',
  trend, trendLabel, color = C.gold, loading = false
}: {
  icon: React.ReactNode; title: string; value: string | number
  prefix?: string; suffix?: string
  trend?: number | null; trendLabel?: string; color?: string; loading?: boolean
}) {
  return (
    <div style={{
      background: 'var(--surface-secondary, #f5f7fa)',
      borderRadius: 12,
      padding: '20px 24px',
      border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      flex: 1, minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary, #6b7280)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </span>
        <span style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color, fontSize: 15, flexShrink: 0
        }}>
          {icon}
        </span>
      </div>

      {loading ? (
        <Spin size="small" />
      ) : (
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary, #0d1b2a)', lineHeight: 1.1, fontFamily: 'var(--font-mono, monospace)' }}>
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </div>
      )}

      {trend !== undefined && trend !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          {trend >= 0 ? (
            <ArrowUpOutlined style={{ color: C.green }} />
          ) : (
            <ArrowDownOutlined style={{ color: C.red }} />
          )}
          <span style={{ color: trend >= 0 ? C.green : C.red, fontWeight: 600 }}>
            {Math.abs(trend)}%
          </span>
          {trendLabel && <span style={{ color: 'var(--text-muted, #9ca3af)' }}>{trendLabel}</span>}
        </div>
      )}
    </div>
  )
}

// ── Upgrade gate ──────────────────────────────────────────────────────────────

function UpgradeGate({ plan }: { plan: ClinicPlan | null }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 400, gap: 20, textAlign: 'center', padding: 40
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: `${C.gold}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, color: C.gold
      }}>
        <LockOutlined />
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          Analytics requires Business plan
        </div>
        <div style={{ color: 'var(--text-secondary)', maxWidth: 420, lineHeight: 1.7 }}>
          You are on the <Tag color="default">{plan ?? 'Starter'}</Tag> plan.
          Upgrade to <Tag color="gold">Business</Tag> or <Tag color="purple">Enterprise</Tag> to
          unlock revenue analytics, doctor performance metrics, and patient retention insights.
        </div>
      </div>
      <Button type="primary" size="large" style={{ background: C.gold, borderColor: C.gold, color: C.navy, fontWeight: 700 }}>
        Upgrade Plan
      </Button>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props { navigate?: (r: { page: string }) => void }

export default function AnalyticsDashboard({ navigate: _navigate }: Props) {
  const api  = useApi()
  const auth = useAuthStore()

  const isPlanAllowed = auth.staff?.plan === 'business' || auth.staff?.plan === 'enterprise'
  const isOwner       = auth.role === 'clinic_owner'

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading,       setLoading]      = useState(false)
  const [loadingRev,    setLoadingRev]   = useState(false)
  const [loadingProc,   setLoadingProc]  = useState(false)
  const [loadingDoc,    setLoadingDoc]   = useState(false)
  const [loadingPat,    setLoadingPat]   = useState(false)

  const [dashboard,     setDashboard]    = useState<DashboardData | null>(null)
  const [revenueRows,   setRevenueRows]  = useState<RevenueRow[]>([])
  const [procedures,    setProcedures]   = useState<ProcedureRow[]>([])
  const [doctors,       setDoctors]      = useState<DoctorRow[]>([])
  const [lapsed,        setLapsed]       = useState<LapsedPatient[]>([])

  const [error,         setError]        = useState<string | null>(null)
  const [revenueGroup,  setRevenueGroup] = useState<'day' | 'week' | 'month'>('month')
  const [dateRange,     setDateRange]    = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'), dayjs()
  ])
  const [activeTab,     setActiveTab]    = useState<'overview' | 'revenue' | 'doctors' | 'patients'>('overview')

  const from = dateRange[0].format('YYYY-MM-DD')
  const to   = dateRange[1].format('YYYY-MM-DD')

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.http.get<DashboardData>('/analytics/dashboard')
      setDashboard(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load dashboard'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [api])

  const fetchRevenue = useCallback(async () => {
    setLoadingRev(true)
    try {
      const rows = await api.http.get<RevenueRow[]>(
        `/analytics/revenue?from=${from}&to=${to}&groupBy=${revenueGroup}`
      )
      setRevenueRows(rows)
    } catch { /* non-fatal */ }
    finally { setLoadingRev(false) }
  }, [api, from, to, revenueGroup])

  const fetchProcedures = useCallback(async () => {
    setLoadingProc(true)
    try {
      const rows = await api.http.get<ProcedureRow[]>(
        `/analytics/procedures?from=${from}&to=${to}`
      )
      setProcedures(rows)
    } catch { /* non-fatal */ }
    finally { setLoadingProc(false) }
  }, [api, from, to])

  const fetchDoctors = useCallback(async () => {
    if (!isOwner) return
    setLoadingDoc(true)
    try {
      const rows = await api.http.get<DoctorRow[]>(
        `/analytics/doctors?from=${from}&to=${to}`
      )
      setDoctors(rows)
    } catch { /* non-fatal */ }
    finally { setLoadingDoc(false) }
  }, [api, from, to, isOwner])

  const fetchPatients = useCallback(async () => {
    setLoadingPat(true)
    try {
      const data = await api.http.get<{ cohorts: unknown[]; lapsed: LapsedPatient[] }>(
        `/analytics/patients?from=${from}&to=${to}`
      )
      setLapsed(data.lapsed ?? [])
    } catch { /* non-fatal */ }
    finally { setLoadingPat(false) }
  }, [api, from, to])

  useEffect(() => {
    if (!isPlanAllowed) return
    fetchDashboard()
    fetchRevenue()
    fetchProcedures()
    fetchDoctors()
    fetchPatients()
  }, [isPlanAllowed, fetchDashboard, fetchRevenue, fetchProcedures, fetchDoctors, fetchPatients])

  // ── Plan gate ───────────────────────────────────────────────────────────────

  if (!isPlanAllowed) {
    return <UpgradeGate plan={auth.staff?.plan ?? null} />
  }

  // ── Revenue bar chart data ──────────────────────────────────────────────────

  // Aggregate by period label (sum across branches)
  const revByPeriod = revenueRows.reduce<Record<string, number>>((acc, r) => {
    const period = r.period ?? ''
    const key = revenueGroup === 'month'
      ? period.slice(0, 7)        // YYYY-MM
      : revenueGroup === 'week'
        ? period.slice(0, 10)     // YYYY-MM-DD (week start)
        : period.slice(0, 10)     // YYYY-MM-DD
    acc[key] = (acc[key] ?? 0) + parseFloat(String(r.revenue))
    return acc
  }, {})

  const barData: BarData[] = Object.entries(revByPeriod)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12) // Last 12 periods
    .map(([label, value]) => ({
      label: revenueGroup === 'month' ? label.slice(0, 7) : label.slice(5), // Trim year for day/week
      value,
      color: C.gold,
    }))

  // ── Tables ──────────────────────────────────────────────────────────────────

  const procColumns = [
    { title: 'Procedure', dataIndex: 'treatment_name', key: 'name', ellipsis: true },
    { title: 'Category', dataIndex: 'category', key: 'cat',
      render: (v: string) => <Tag color="blue">{v || '—'}</Tag> },
    { title: 'Volume', dataIndex: 'volume', key: 'vol',
      sorter: (a: ProcedureRow, b: ProcedureRow) => Number(a.volume) - Number(b.volume),
      render: fmtInt },
    { title: 'Revenue', dataIndex: 'revenue', key: 'rev',
      sorter: (a: ProcedureRow, b: ProcedureRow) => Number(a.revenue) - Number(b.revenue),
      render: (v: number) => fmt(v) },
    { title: 'Avg Price', dataIndex: 'avg_price', key: 'avg', render: fmt },
  ]

  const doctorColumns = [
    { title: 'Doctor', dataIndex: 'doctor_name', key: 'name',
      render: (v: string, r: DoctorRow) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          {r.designation && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.designation}</div>}
        </div>
      )
    },
    { title: 'Completed', dataIndex: 'completed', key: 'done', render: fmtInt },
    { title: 'Cancelled', dataIndex: 'cancelled', key: 'can', render: fmtInt },
    { title: 'Patients', dataIndex: 'unique_patients', key: 'pts', render: fmtInt },
    { title: 'Revenue', dataIndex: 'revenue_generated', key: 'rev', render: fmt,
      sorter: (a: DoctorRow, b: DoctorRow) => Number(a.revenue_generated) - Number(b.revenue_generated) },
    {
      title: 'Utilisation',
      key: 'util',
      render: (_: unknown, r: DoctorRow) => {
        const done = Number(r.completed)
        const total = done + Number(r.cancelled)
        const pct = total > 0 ? Math.round((done / total) * 100) : 0
        return <Progress percent={pct} size="small" strokeColor={C.gold} />
      }
    }
  ]

  const lapsedColumns = [
    { title: 'OP ID', dataIndex: 'op_id', key: 'op',
      render: (v: string) => <span className="patient-op-id">{v}</span> },
    { title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'Contact', dataIndex: 'contact_number', key: 'contact' },
    { title: 'Last Visit', dataIndex: 'last_visit', key: 'visit',
      render: (v: string | null) => v
        ? <span style={{ color: C.red }}>{dayjs(v).format('DD MMM YYYY')}</span>
        : <Tag color="red">Never visited</Tag> },
    { title: 'Gap', key: 'gap',
      render: (_: unknown, r: LapsedPatient) => r.last_visit
        ? `${dayjs().diff(dayjs(r.last_visit), 'month')}m ago`
        : '—' },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400 }}>

      {/* ── Page header ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            Analytics
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            Business intelligence &amp; clinic performance
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <RangePicker
            value={dateRange}
            onChange={(v) => { if (v?.[0] && v?.[1]) setDateRange([v[0], v[1]]) }}
            size="middle"
            style={{ width: 240 }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => { fetchDashboard(); fetchRevenue(); fetchProcedures(); fetchDoctors(); fetchPatients() }}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} />}

      {/* ── Tabs ────────────────────────────────────────────── */}
      <Segmented
        value={activeTab}
        onChange={v => setActiveTab(v as typeof activeTab)}
        options={[
          { label: 'Overview', value: 'overview' },
          { label: 'Revenue', value: 'revenue' },
          ...(isOwner ? [{ label: 'Doctors', value: 'doctors' }] : []),
          { label: 'Patients', value: 'patients' },
        ]}
        style={{ alignSelf: 'flex-start' }}
      />

      {/* ═══════════════════════════════════════════════════ */}
      {/* OVERVIEW TAB                                        */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* ── KPI row ──── */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <KpiCard
              icon={<DollarOutlined />}
              title="Revenue Today"
              value={fmt(dashboard?.revenue.today ?? 0)}
              color={C.gold}
              loading={loading}
            />
            <KpiCard
              icon={<DollarOutlined />}
              title="This Month"
              value={fmt(dashboard?.revenue.this_month ?? 0)}
              trend={dashboard?.revenue.growth_pct ?? null}
              trendLabel="vs last month"
              color={C.gold}
              loading={loading}
            />
            <KpiCard
              icon={<ExclamationCircleOutlined />}
              title="Outstanding"
              value={fmt(dashboard?.revenue.outstanding ?? 0)}
              color={C.red}
              loading={loading}
            />
            <KpiCard
              icon={<CalendarOutlined />}
              title="Appointments Today"
              value={dashboard?.appointments.today ?? 0}
              suffix={` / ${dashboard?.appointments.confirmed ?? 0} confirmed`}
              color={C.blue}
              loading={loading}
            />
            <KpiCard
              icon={<UserOutlined />}
              title="Total Patients"
              value={dashboard?.patients.total ?? 0}
              suffix={` (+${dashboard?.patients.new_this_month ?? 0} this month)`}
              color={C.teal}
              loading={loading}
            />
          </div>

          {/* ── Second row: cancellation + lapsed ─── */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div className="analytics-chart-card" style={{ flex: '1 1 300px' }}>
              <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 14 }}>Appointment Split (This Month)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Completed', value: dashboard?.appointments.completed ?? 0, color: C.green },
                  { label: 'Cancelled', value: dashboard?.appointments.cancelled ?? 0, color: C.red },
                ].map(item => {
                  const total = (dashboard?.appointments.completed ?? 0) + (dashboard?.appointments.cancelled ?? 0)
                  const pct   = total > 0 ? Math.round((item.value / total) * 100) : 0
                  return (
                    <div key={item.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span>{item.label}</span>
                        <span style={{ fontWeight: 600 }}>{item.value} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct}%)</span></span>
                      </div>
                      <Progress percent={pct} showInfo={false} strokeColor={item.color} size="small" />
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
                Cancellation rate: <strong style={{ color: (dashboard?.appointments.cancellation_rate ?? 0) > 20 ? C.red : C.green }}>
                  {dashboard?.appointments.cancellation_rate ?? 0}%
                </strong>
              </div>
            </div>

            <div className="analytics-chart-card" style={{ flex: '1 1 300px' }}>
              <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 14 }}>Patient Status</div>
              {[
                { label: 'Active (last 6 months)', value: (dashboard?.patients.total ?? 0) - (dashboard?.patients.lapsed ?? 0), color: C.green },
                { label: 'Lapsed (>6 months)', value: dashboard?.patients.lapsed ?? 0, color: C.orange },
              ].map(item => {
                const total = dashboard?.patients.total ?? 1
                const pct   = Math.round((item.value / total) * 100)
                return (
                  <div key={item.label} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span>{item.label}</span>
                      <span style={{ fontWeight: 600 }}>{item.value.toLocaleString()}</span>
                    </div>
                    <Progress percent={pct} showInfo={false} strokeColor={item.color} size="small" />
                  </div>
                )
              })}
            </div>

            <div className="analytics-chart-card" style={{ flex: '1 1 340px' }}>
              <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Top Procedures (by volume)</div>
              {procedures.slice(0, 5).map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                    background: `${C.gold}22`, color: C.gold,
                    fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.treatment_name}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.gold, flexShrink: 0 }}>
                    ×{fmtInt(p.volume)}
                  </span>
                </div>
              ))}
              {procedures.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No data for period</div>}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* REVENUE TAB                                         */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'revenue' && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Group by:</span>
            <Select
              value={revenueGroup}
              onChange={v => setRevenueGroup(v)}
              options={[
                { label: 'Day', value: 'day' },
                { label: 'Week', value: 'week' },
                { label: 'Month', value: 'month' },
              ]}
              style={{ width: 100 }}
            />
          </div>

          <div className="analytics-chart-card">
            <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 14 }}>
              Revenue ({dateRange[0].format('DD MMM')} – {dateRange[1].format('DD MMM YYYY')})
            </div>
            {loadingRev ? (
              <Spin />
            ) : barData.length > 0 ? (
              <MiniBarChart data={barData} height={120} />
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>
                No revenue data for this period
              </div>
            )}
          </div>

          <div className="analytics-chart-card">
            <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 14 }}>Revenue Detail</div>
            <Table
              dataSource={revenueRows}
              loading={loadingRev}
              rowKey={(r, i) => `${r.period}_${r.branch_name}_${i}`}
              size="small"
              pagination={{ pageSize: 20 }}
              columns={[
                { title: 'Period', dataIndex: 'period', key: 'period' },
                { title: 'Branch', dataIndex: 'branch_name', key: 'branch' },
                { title: 'Invoices', dataIndex: 'invoice_count', key: 'cnt', render: fmtInt },
                { title: 'Revenue', dataIndex: 'revenue', key: 'rev',
                  render: (v: number) => <strong>{fmt(v)}</strong>,
                  sorter: (a: RevenueRow, b: RevenueRow) => Number(a.revenue) - Number(b.revenue) },
              ]}
            />
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* DOCTORS TAB                                         */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'doctors' && isOwner && (
        <div className="analytics-chart-card">
          <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 14 }}>
            Doctor Performance ({dateRange[0].format('DD MMM')} – {dateRange[1].format('DD MMM YYYY')})
          </div>
          <Table
            dataSource={doctors}
            loading={loadingDoc}
            rowKey="doctor_id"
            size="small"
            pagination={false}
            columns={doctorColumns}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* PATIENTS TAB                                        */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'patients' && (
        <>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <KpiCard icon={<TeamOutlined />} title="Total Patients" value={dashboard?.patients.total ?? 0} color={C.teal} loading={loading} />
            <KpiCard icon={<UserOutlined />} title="New This Month" value={dashboard?.patients.new_this_month ?? 0} color={C.green} loading={loading} />
            <KpiCard icon={<ExclamationCircleOutlined />} title="Lapsed (>6 months)" value={dashboard?.patients.lapsed ?? 0} color={C.orange} loading={loading} />
          </div>

          <div className="analytics-chart-card">
            <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ExclamationCircleOutlined style={{ color: C.orange }} />
              Lapsed Patients — Re-engagement List
            </div>
            <Table
              dataSource={lapsed}
              loading={loadingPat}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 15 }}
              columns={lapsedColumns}
            />
          </div>

          <div className="analytics-chart-card">
            <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MedicineBoxOutlined style={{ color: C.gold }} />
              Top Procedures ({dateRange[0].format('DD MMM')} – {dateRange[1].format('DD MMM YYYY')})
            </div>
            <Table
              dataSource={procedures}
              loading={loadingProc}
              rowKey={(r, i) => `${r.treatment_name}_${i}`}
              size="small"
              pagination={{ pageSize: 10 }}
              columns={procColumns}
            />
          </div>
        </>
      )}
    </div>
  )
}
