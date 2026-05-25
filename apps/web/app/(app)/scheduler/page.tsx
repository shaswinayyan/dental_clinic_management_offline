'use client'

import { useState }      from 'react'
import { useQuery }      from '@tanstack/react-query'
import { useApi }        from '@/lib/api'
import { formatDate, formatTime, APPT_STATUS_COLOURS, cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'

interface Appointment {
  id:         string
  patient_id: string
  doctor_id:  string
  start_time: string
  end_time:   string
  status:     string
  notes?:     string
}

function dateKey(date: Date) {
  return date.toISOString().split('T')[0]
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export default function SchedulerPage() {
  const api            = useApi()
  const [current, setCurrent] = useState(new Date())

  const from = new Date(current)
  from.setHours(0, 0, 0, 0)
  const to = new Date(current)
  to.setHours(23, 59, 59, 999)

  const { data, isLoading } = useQuery<{ success: boolean; data: Appointment[] }>({
    queryKey: ['appointments', dateKey(current)],
    queryFn:  () => api.get<{ success: boolean; data: Appointment[] }>(
      `/appointments?dateFrom=${from.toISOString()}&dateTo=${to.toISOString()}`
    ),
  })

  const appointments = data?.data ?? []

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Scheduler</h1>
          <p className="text-sm text-text-secondary">{formatDate(current)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrent(d => addDays(d, -1))}
            className="p-2 border border-border rounded-lg hover:bg-surface-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrent(new Date())}
            className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-surface-muted transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrent(d => addDays(d, 1))}
            className="p-2 border border-border rounded-lg hover:bg-surface-muted transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors ml-2">
            <Plus className="w-4 h-4" />
            New Appointment
          </button>
        </div>
      </div>

      {/* Appointments list */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-surface-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="py-16 text-center text-text-muted text-sm">
            No appointments scheduled for this day
          </div>
        ) : (
          <div className="divide-y divide-border">
            {appointments
              .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
              .map(appt => (
                <div key={appt.id} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted transition-colors">
                  {/* Time */}
                  <div className="w-20 shrink-0 text-center">
                    <p className="text-sm font-medium text-text-primary">{formatTime(appt.start_time)}</p>
                    <p className="text-xs text-text-muted">{formatTime(appt.end_time)}</p>
                  </div>

                  {/* Colour stripe */}
                  <div className="w-1 h-10 rounded-full bg-brand-400 shrink-0" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      Patient #{appt.patient_id.slice(-6)}
                    </p>
                    {appt.notes && (
                      <p className="text-xs text-text-muted truncate">{appt.notes}</p>
                    )}
                  </div>

                  {/* Status */}
                  <span className={cn(
                    'text-xs px-2.5 py-1 rounded-full font-medium shrink-0',
                    APPT_STATUS_COLOURS[appt.status] ?? 'bg-gray-100 text-gray-600',
                  )}>
                    {appt.status.replace('_', ' ')}
                  </span>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  )
}
