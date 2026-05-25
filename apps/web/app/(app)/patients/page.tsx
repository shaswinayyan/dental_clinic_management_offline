'use client'

import { useState }          from 'react'
import { useQuery }          from '@tanstack/react-query'
import { useApi }            from '@/lib/api'
import { formatDate, getInitials, cn } from '@/lib/utils'
import { Search, Plus, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Patient {
  id:         string
  name:       string
  email?:     string
  phone?:     string
  date_of_birth?: string
  gender?:    string
  created_at: string
}

interface PatientsResponse {
  success: boolean
  data:    Patient[]
  meta:    { total: number; page: number; limit: number; pages: number }
}

export default function PatientsPage() {
  const api            = useApi()
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)

  const { data, isLoading } = useQuery<PatientsResponse>({
    queryKey: ['patients', search, page],
    queryFn:  () => api.get<PatientsResponse>(
      `/patients?q=${encodeURIComponent(search)}&page=${page}&limit=20`
    ),
  })

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Patients</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {data?.meta.total ?? 0} total patients
          </p>
        </div>
        <Link
          href="/patients/new"
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Patient
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Search by name or phone…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide">Patient</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide hidden md:table-cell">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide hidden lg:table-cell">DOB</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide hidden lg:table-cell">Registered</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3" colSpan={5}>
                      <div className="h-4 bg-surface-muted rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              : data?.data.map(patient => (
                  <tr key={patient.id} className="hover:bg-surface-muted transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-semibold shrink-0">
                          {getInitials(patient.name)}
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">{patient.name}</p>
                          {patient.email && (
                            <p className="text-xs text-text-muted">{patient.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                      {patient.phone ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">
                      {patient.date_of_birth ? formatDate(patient.date_of_birth) : '—'}
                    </td>
                    <td className="px-4 py-3 text-text-muted hidden lg:table-cell">
                      {formatDate(patient.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/patients/${patient.id}`}>
                        <ChevronRight className="w-4 h-4 text-text-muted hover:text-text-primary" />
                      </Link>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>

        {/* Empty state */}
        {!isLoading && !data?.data.length && (
          <div className="py-12 text-center">
            <p className="text-text-muted text-sm">No patients found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.meta.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>
            Page {data.meta.page} of {data.meta.pages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-border rounded-lg disabled:opacity-40 hover:bg-surface-muted transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(data.meta.pages, p + 1))}
              disabled={page === data.meta.pages}
              className="px-3 py-1.5 border border-border rounded-lg disabled:opacity-40 hover:bg-surface-muted transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
