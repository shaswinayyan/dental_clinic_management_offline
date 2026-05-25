'use client'

import { useQuery }   from '@tanstack/react-query'
import { useApi }     from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import {
  Users, CalendarDays, DollarSign, UserPlus,
} from 'lucide-react'

interface OverviewData {
  success: boolean
  data: {
    month_revenue:      string
    month_appointments: number
    total_patients:     number
    new_patients_month: number
    period_start:       string
  }
}

function KpiCard({
  label, value, icon: Icon, colour,
}: { label: string; value: string; icon: React.ElementType; colour: string }) {
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

export default function DashboardPage() {
  const api  = useApi()
  const { data, isLoading, isError } = useQuery<OverviewData>({
    queryKey: ['analytics', 'overview'],
    queryFn:  () => api.get<OverviewData>('/analytics/overview'),
  })

  const kpis = data?.data

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-border p-5 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          Failed to load dashboard data. Analytics may require a Business or Enterprise plan.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          This month&apos;s overview
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Monthly Revenue"
          value={formatCurrency(kpis?.month_revenue ?? '0')}
          icon={DollarSign}
          colour="bg-green-50 text-green-600"
        />
        <KpiCard
          label="Appointments"
          value={String(kpis?.month_appointments ?? 0)}
          icon={CalendarDays}
          colour="bg-blue-50 text-blue-600"
        />
        <KpiCard
          label="Total Patients"
          value={String(kpis?.total_patients ?? 0)}
          icon={Users}
          colour="bg-purple-50 text-purple-600"
        />
        <KpiCard
          label="New Patients"
          value={String(kpis?.new_patients_month ?? 0)}
          icon={UserPlus}
          colour="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Today\'s Appointments', href: '/scheduler', desc: 'View and manage today\'s schedule' },
          { title: 'Outstanding Invoices',  href: '/billing',   desc: 'Review unpaid and partial invoices' },
          { title: 'Low Stock Alerts',      href: '/inventory', desc: 'Items below reorder level' },
        ].map(card => (
          <a
            key={card.href}
            href={card.href}
            className="bg-white rounded-xl border border-border p-5 hover:border-brand-300 hover:shadow-sm transition-all"
          >
            <h3 className="font-medium text-text-primary text-sm">{card.title}</h3>
            <p className="text-xs text-text-muted mt-1">{card.desc}</p>
          </a>
        ))}
      </div>
    </div>
  )
}
