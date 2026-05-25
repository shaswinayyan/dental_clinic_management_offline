'use client'

import { useState }       from 'react'
import { useQuery }       from '@tanstack/react-query'
import { useApi }         from '@/lib/api'
import { formatDate, formatCurrency, cn } from '@/lib/utils'
import { Plus, Search }   from 'lucide-react'

interface Invoice {
  id:           string
  patient_id:   string
  total_amount: string
  amount_paid:  string
  status:       'draft' | 'sent' | 'paid' | 'partial' | 'void'
  created_at:   string
}

const STATUS_STYLES: Record<string, string> = {
  draft:   'bg-gray-100 text-gray-600',
  sent:    'bg-blue-100 text-blue-700',
  paid:    'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  void:    'bg-red-100 text-red-500',
}

export default function BillingPage() {
  const api            = useApi()
  const [status, setStatus] = useState('')
  const [page, setPage]     = useState(1)

  const { data, isLoading } = useQuery<{
    success: boolean
    data: Invoice[]
    meta: { total: number; page: number; limit: number; pages: number }
  }>({
    queryKey: ['invoices', status, page],
    queryFn:  () => api.get(
      `/billing/invoices?${status ? `status=${status}&` : ''}page=${page}&limit=20`
    ),
  })

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Billing</h1>
          <p className="text-sm text-text-secondary">{data?.meta.total ?? 0} invoices</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
          <Plus className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'draft', 'sent', 'partial', 'paid', 'void'].map(s => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1) }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
              status === s
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-border text-text-secondary hover:bg-surface-muted',
            )}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide">Invoice</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide hidden md:table-cell">Patient</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide">Total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide hidden md:table-cell">Paid</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide hidden lg:table-cell">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3" colSpan={6}>
                      <div className="h-4 bg-surface-muted rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              : data?.data.map(inv => (
                  <tr key={inv.id} className="hover:bg-surface-muted transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">
                      {inv.id.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                      {inv.patient_id.slice(-8)}
                    </td>
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {formatCurrency(inv.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                      {formatCurrency(inv.amount_paid)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-xs px-2.5 py-1 rounded-full font-medium',
                        STATUS_STYLES[inv.status] ?? 'bg-gray-100 text-gray-600',
                      )}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted hidden lg:table-cell">
                      {formatDate(inv.created_at)}
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>

        {!isLoading && !data?.data.length && (
          <div className="py-12 text-center text-text-muted text-sm">No invoices found</div>
        )}
      </div>

      {/* Pagination */}
      {data && data.meta.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>Page {data.meta.page} of {data.meta.pages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-border rounded-lg disabled:opacity-40 hover:bg-surface-muted"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(data.meta.pages, p + 1))}
              disabled={page === data.meta.pages}
              className="px-3 py-1.5 border border-border rounded-lg disabled:opacity-40 hover:bg-surface-muted"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
