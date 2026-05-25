'use client'

import { useQuery }   from '@tanstack/react-query'
import { useApi }     from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, Users, CalendarCheck, DollarSign } from 'lucide-react'

interface RevenueData {
  success: boolean
  data: {
    grand_total: string
    by_method:   { method: string; total: string; count: number }[]
    daily_trend: { date: string; total: string }[]
  }
}

interface ApptData {
  success: boolean
  data: {
    total:     number
    by_status: { status: string; count: number }[]
  }
}

interface PatientsData {
  success: boolean
  data: {
    total:         number
    new_in_period: number
  }
}

function StatCard({ label, value, icon: Icon, colour }: {
  label: string; value: string; icon: React.ElementType; colour: string
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${colour}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-text-secondary">{label}</p>
        <p className="text-2xl font-semibold text-text-primary mt-0.5">{value}</p>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const api  = useApi()

  const { data: revenue,  isError: revErr }  = useQuery<RevenueData>({
    queryKey: ['analytics', 'revenue'],
    queryFn:  () => api.get('/analytics/revenue'),
  })

  const { data: appts,    isError: apptErr } = useQuery<ApptData>({
    queryKey: ['analytics', 'appointments'],
    queryFn:  () => api.get('/analytics/appointments'),
  })

  const { data: patients, isError: patErr }  = useQuery<PatientsData>({
    queryKey: ['analytics', 'patients'],
    queryFn:  () => api.get('/analytics/patients'),
  })

  const isError = revErr || apptErr || patErr

  if (isError) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-800 text-sm">
          <p className="font-medium">Analytics requires Business or Enterprise plan</p>
          <p className="mt-1 text-amber-700">Upgrade your plan to access detailed analytics and reporting.</p>
        </div>
      </div>
    )
  }

  const maxRevenue = Math.max(...(revenue?.data.daily_trend.map(d => parseFloat(d.total)) ?? [1]))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Analytics</h1>
        <p className="text-sm text-text-secondary mt-0.5">Current month performance</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(revenue?.data.grand_total ?? '0')}
          icon={DollarSign}
          colour="bg-green-50 text-green-600"
        />
        <StatCard
          label="Appointments"
          value={String(appts?.data.total ?? 0)}
          icon={CalendarCheck}
          colour="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Total Patients"
          value={String(patients?.data.total ?? 0)}
          icon={Users}
          colour="bg-purple-50 text-purple-600"
        />
        <StatCard
          label="New Patients"
          value={String(patients?.data.new_in_period ?? 0)}
          icon={TrendingUp}
          colour="bg-amber-50 text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by method */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h2 className="font-medium text-text-primary text-sm mb-4">Revenue by Payment Method</h2>
          <div className="space-y-3">
            {revenue?.data.by_method.map(m => {
              const pct = ((parseFloat(m.total) / parseFloat(revenue.data.grand_total || '1')) * 100).toFixed(0)
              return (
                <div key={m.method}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text-secondary capitalize">{m.method.replace('_', ' ')}</span>
                    <span className="font-medium text-text-primary">{formatCurrency(m.total)}</span>
                  </div>
                  <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {!revenue?.data.by_method.length && (
              <p className="text-sm text-text-muted py-4 text-center">No revenue data yet</p>
            )}
          </div>
        </div>

        {/* Appointment by status */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h2 className="font-medium text-text-primary text-sm mb-4">Appointments by Status</h2>
          <div className="space-y-3">
            {appts?.data.by_status.map(s => {
              const pct = ((Number(s.count) / (appts.data.total || 1)) * 100).toFixed(0)
              return (
                <div key={s.status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text-secondary capitalize">{s.status.replace('_', ' ')}</span>
                    <span className="font-medium text-text-primary">{s.count}</span>
                  </div>
                  <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {!appts?.data.by_status.length && (
              <p className="text-sm text-text-muted py-4 text-center">No appointment data yet</p>
            )}
          </div>
        </div>

        {/* Daily revenue trend */}
        <div className="bg-white rounded-xl border border-border p-5 lg:col-span-2">
          <h2 className="font-medium text-text-primary text-sm mb-4">Daily Revenue Trend</h2>
          {revenue?.data.daily_trend.length ? (
            <div className="flex items-end gap-1 h-32">
              {revenue.data.daily_trend.map(d => {
                const height = Math.max(4, (parseFloat(d.total) / maxRevenue) * 100)
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center gap-1 group"
                    title={`${d.date}: ${formatCurrency(d.total)}`}
                  >
                    <div
                      className="w-full bg-brand-100 group-hover:bg-brand-400 rounded-t transition-colors"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-text-muted text-sm">
              No revenue recorded yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
