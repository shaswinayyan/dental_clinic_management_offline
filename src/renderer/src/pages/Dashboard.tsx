import { useEffect, useState } from 'react'
import { Row, Col, Card, Table, Tag, Button, Spin, Avatar } from 'antd'
import {
  CalendarOutlined, TeamOutlined, DollarOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, ClockCircleOutlined, MedicineBoxOutlined, WarningOutlined,
  RiseOutlined, FallOutlined, ArrowRightOutlined
} from '@ant-design/icons'
import type { DashboardStats, Appointment, IpcResult } from '../../../shared/types'
import type { Route } from '../components/Layout/MainLayout'
import { useT } from '../hooks/useT'
import dayjs from 'dayjs'

interface Props { navigate: (r: Route) => void }

const KPI_CARDS = (stats: DashboardStats | null, nav: (r: Route) => void) => [
  {
    title: "Today's Appointments", value: stats?.todayAppointments ?? 0,
    icon: <CalendarOutlined />, iconBg: 'rgba(201,168,76,0.15)', iconColor: '#c9a84c',
    onClick: () => nav({ page: 'appointments-calendar' })
  },
  {
    title: 'Confirmed Today', value: stats?.confirmedAppointments ?? 0,
    icon: <CheckCircleOutlined />, iconBg: 'rgba(34,197,94,0.13)', iconColor: '#22c55e',
    onClick: null
  },
  {
    title: 'Pending Follow-up', value: stats?.pendingAppointments ?? 0,
    icon: <ClockCircleOutlined />, iconBg: 'rgba(251,146,60,0.13)', iconColor: '#fb923c',
    onClick: null
  },
  {
    title: 'Total Patients', value: stats?.totalPatients ?? 0,
    icon: <TeamOutlined />, iconBg: 'rgba(167,139,250,0.13)', iconColor: '#a78bfa',
    onClick: () => nav({ page: 'patients' })
  },
]

const FINANCE_CARDS = (stats: DashboardStats | null, nav: (r: Route) => void) => [
  {
    title: 'Revenue This Month', value: `₹${(stats?.monthRevenue ?? 0).toLocaleString('en-IN')}`,
    icon: <DollarOutlined />, iconBg: 'rgba(201,168,76,0.15)', iconColor: '#c9a84c',
    trend: 'up' as const, trendLabel: 'vs last month',
    onClick: () => nav({ page: 'invoices' })
  },
  {
    title: 'Outstanding Balance', value: `₹${(stats?.outstandingBalance ?? 0).toLocaleString('en-IN')}`,
    icon: <ExclamationCircleOutlined />, iconBg: 'rgba(248,113,113,0.13)', iconColor: '#f87171',
    trend: 'down' as const, trendLabel: 'needs follow-up',
    onClick: () => nav({ page: 'invoices' })
  },
  {
    title: 'Low Stock Items', value: stats?.lowStockCount ?? 0,
    icon: <MedicineBoxOutlined />, iconBg: 'rgba(251,146,60,0.13)', iconColor: '#fb923c',
    trend: null, trendLabel: '',
    onClick: () => nav({ page: 'inventory-items' })
  },
  {
    title: 'Expiring Items (30d)', value: stats?.expiringItemsCount ?? 0,
    icon: <WarningOutlined />, iconBg: 'rgba(251,191,36,0.13)', iconColor: '#fbbf24',
    trend: null, trendLabel: '',
    onClick: () => nav({ page: 'inventory' })
  },
]

export default function Dashboard({ navigate }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const t = useT()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [statsRes, apptRes] = await Promise.all([
        window.api.appointments.dashboard() as Promise<IpcResult<DashboardStats>>,
        window.api.appointments.list({ date: dayjs().format('YYYY-MM-DD') }) as Promise<IpcResult<Appointment[]>>
      ])
      if (statsRes.success && statsRes.data) setStats(statsRes.data)
      if (apptRes.success && apptRes.data) setTodayAppts(apptRes.data)
      setLoading(false)
    }
    load()
  }, [])

  const statusColor: Record<string, string> = {
    scheduled: 'blue', confirmed: 'green', pending: 'orange',
    completed: 'default', cancelled: 'red', rescheduled: 'purple'
  }

  const columns = [
    {
      title: 'Time', dataIndex: 'scheduled_at', width: 70,
      render: (v: string) => (
        <span style={{ fontWeight: 600, color: t.textSub }}>{dayjs(v).format('HH:mm')}</span>
      )
    },
    {
      title: 'Patient', dataIndex: 'patient_name',
      render: (v: string, r: Appointment) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar size={28} style={{ background: 'linear-gradient(135deg,#c9a84c,#8a6020)', color: '#fff', fontSize: 11, fontWeight: 700 }}>
            {v?.charAt(0) ?? 'P'}
          </Avatar>
          <Button type="link" style={{ padding: 0, fontWeight: 500 }}
            onClick={() => navigate({ page: 'patient-detail', id: r.patient_id })}>{v}</Button>
        </div>
      )
    },
    { title: 'Treatment', dataIndex: 'treatment_name', ellipsis: true },
    {
      title: 'Chair', dataIndex: 'chair_name', width: 90,
      render: (v: string) => <span style={{ fontSize: 12, color: t.textSub }}>{v}</span>
    },
    {
      title: 'Status', dataIndex: 'status', width: 120,
      render: (v: string) => <Tag color={statusColor[v]}>{v.toUpperCase()}</Tag>
    }
  ]

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>

  return (
    <div>
      {/* Date header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: t.textHint, fontWeight: 500 }}>
            {dayjs().format('dddd, DD MMMM YYYY')}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.textSub, marginTop: 2 }}>
            Overview & today's activity
          </div>
        </div>
        <Button type="primary" icon={<CalendarOutlined />} onClick={() => navigate({ page: 'appointments-calendar' })}>
          Open Scheduler
        </Button>
      </div>

      {/* KPI Cards */}
      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        {KPI_CARDS(stats, navigate).map((c, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card
              className="stat-card"
              style={{ cursor: c.onClick ? 'pointer' : 'default', border: `1px solid ${t.border}` }}
              styles={{ body: { padding: '18px 20px' } }}
              onClick={c.onClick ?? undefined}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, color: t.textHint, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {c.title}
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: t.text, lineHeight: 1 }}>
                    {c.value}
                  </div>
                </div>
                <div style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, color: c.iconColor, flexShrink: 0
                }}>
                  {c.icon}
                </div>
              </div>
              {c.onClick && (
                <div style={{ marginTop: 12, fontSize: 12, color: '#c9a84c', display: 'flex', alignItems: 'center', gap: 4 }}>
                  View details <ArrowRightOutlined style={{ fontSize: 10 }} />
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {/* Finance Cards */}
      <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
        {FINANCE_CARDS(stats, navigate).map((c, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card
              className="stat-card"
              style={{ cursor: 'pointer', border: `1px solid ${t.border}` }}
              styles={{ body: { padding: '18px 20px' } }}
              onClick={c.onClick}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, color: t.textHint, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {c.title}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: t.text, lineHeight: 1.1 }}>
                    {c.value}
                  </div>
                  {c.trend && (
                    <div style={{ marginTop: 4, fontSize: 11, color: c.trend === 'up' ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: 3 }}>
                      {c.trend === 'up' ? <RiseOutlined /> : <FallOutlined />}
                      {c.trendLabel}
                    </div>
                  )}
                </div>
                <div style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, color: c.iconColor, flexShrink: 0
                }}>
                  {c.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Today's Schedule */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarOutlined style={{ color: '#c9a84c' }} />
            <span style={{ fontWeight: 700 }}>Today's Schedule</span>
            <Tag color="gold" style={{ marginLeft: 4 }}>{todayAppts.length} appointments</Tag>
          </div>
        }
        extra={
          <Button type="link" icon={<ArrowRightOutlined />} onClick={() => navigate({ page: 'appointments-list' })}>
            View All
          </Button>
        }
        style={{ border: `1px solid ${t.border}` }}
      >
        <Table
          dataSource={todayAppts}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: 'No appointments scheduled for today' }}
        />
      </Card>
    </div>
  )
}
