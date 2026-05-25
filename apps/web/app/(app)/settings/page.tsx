'use client'

import { useState }      from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi }        from '@/lib/api'
import { cn }            from '@/lib/utils'

type Tab = 'clinic' | 'notation' | 'currency' | 'payment-methods' | 'modules'

const TABS: { id: Tab; label: string }[] = [
  { id: 'clinic',          label: 'Clinic Info' },
  { id: 'notation',        label: 'Tooth Notation' },
  { id: 'currency',        label: 'Currency & Tax' },
  { id: 'payment-methods', label: 'Payment Methods' },
  { id: 'modules',         label: 'Modules' },
]

export default function SettingsPage() {
  const api          = useApi()
  const qc           = useQueryClient()
  const [tab, setTab] = useState<Tab>('clinic')
  const [saved, setSaved] = useState(false)

  const { data: clinicRes } = useQuery<{
    success: boolean
    data: { clinic: { name: string }; settings: Record<string, unknown> | null }
  }>({
    queryKey: ['settings', 'clinic'],
    queryFn:  () => api.get('/settings/clinic'),
  })

  const { data: notationRes } = useQuery<{ success: boolean; data: { notation: string } }>({
    queryKey: ['customisation', 'notation'],
    queryFn:  () => api.get('/customisation/notation'),
  })

  const { data: currencyRes } = useQuery<{
    success: boolean
    data: { currency_code: string; currency_symbol: string; tax_label: string; tax_rate: string }
  }>({
    queryKey: ['customisation', 'currency'],
    queryFn:  () => api.get('/customisation/currency'),
  })

  const { data: modsRes } = useQuery<{
    success: boolean
    data: { modules_enabled: Record<string, boolean> }
  }>({
    queryKey: ['customisation', 'modules'],
    queryFn:  () => api.get('/customisation/modules'),
  })

  const { data: pmRes } = useQuery<{
    success: boolean
    data: { payment_methods: string[] }
  }>({
    queryKey: ['customisation', 'payment-methods'],
    queryFn:  () => api.get('/customisation/payment-methods'),
  })

  const showSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const patchNotation = useMutation({
    mutationFn: (notation: string) => api.patch('/customisation/notation', { notation }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['customisation', 'notation'] }); showSaved() },
  })

  const patchCurrency = useMutation({
    mutationFn: (body: unknown) => api.patch('/customisation/currency', body),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['customisation', 'currency'] }); showSaved() },
  })

  const patchModules = useMutation({
    mutationFn: (modules: Record<string, boolean>) => api.patch('/customisation/modules', { modules }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['customisation', 'modules'] }); showSaved() },
  })

  const patchPM = useMutation({
    mutationFn: (methods: string[]) => api.patch('/customisation/payment-methods', { methods }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['customisation', 'payment-methods'] }); showSaved() },
  })

  const modules   = modsRes?.data.modules_enabled ?? {}
  const pmethods  = pmRes?.data.payment_methods   ?? []

  const ALL_METHODS = ['cash', 'card', 'bank_transfer', 'insurance', 'cheque', 'online']

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
        {saved && <p className="text-sm text-green-600 mt-0.5 font-medium">Saved ✓</p>}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface-muted rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t.id
                ? 'bg-white text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border p-5 max-w-xl">
        {/* ── Clinic Info ── */}
        {tab === 'clinic' && (
          <div className="space-y-4">
            <h2 className="font-medium text-text-primary">Clinic Information</h2>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Clinic Name</label>
              <input
                defaultValue={clinicRes?.data.clinic.name ?? ''}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <p className="text-xs text-text-muted">
              For billing contact and staff details, manage via the Staff section.
            </p>
          </div>
        )}

        {/* ── Tooth Notation ── */}
        {tab === 'notation' && (
          <div className="space-y-4">
            <h2 className="font-medium text-text-primary">Tooth Notation System</h2>
            {(['fdi', 'universal', 'palmer'] as const).map(n => (
              <label key={n} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="notation"
                  value={n}
                  defaultChecked={notationRes?.data.notation === n}
                  onChange={() => patchNotation.mutate(n)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-text-primary capitalize">{n} Notation</p>
                  <p className="text-xs text-text-muted">
                    {n === 'fdi'       && 'International two-digit system (11–48). Most commonly used globally.'}
                    {n === 'universal' && 'North American 1–32 numbering system.'}
                    {n === 'palmer'    && 'UK quadrant-based notation using brackets.'}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* ── Currency ── */}
        {tab === 'currency' && currencyRes && (
          <div className="space-y-4">
            <h2 className="font-medium text-text-primary">Currency & Tax</h2>
            {[
              { label: 'Currency Code',   key: 'currency_code',   placeholder: 'USD' },
              { label: 'Currency Symbol', key: 'currency_symbol', placeholder: '$' },
              { label: 'Tax Label',       key: 'tax_label',       placeholder: 'Tax' },
              { label: 'Default Tax Rate (%)', key: 'tax_rate',   placeholder: '0' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-text-muted mb-1">{field.label}</label>
                <input
                  id={`currency-${field.key}`}
                  defaultValue={String(currencyRes.data[field.key as keyof typeof currencyRes.data] ?? '')}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            ))}
            <button
              onClick={() => {
                const get = (k: string) =>
                  (document.getElementById(`currency-${k}`) as HTMLInputElement)?.value
                patchCurrency.mutate({
                  currency_code:   get('currency_code'),
                  currency_symbol: get('currency_symbol'),
                  tax_label:       get('tax_label'),
                  tax_rate:        get('tax_rate'),
                })
              }}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Save Currency Settings
            </button>
          </div>
        )}

        {/* ── Payment Methods ── */}
        {tab === 'payment-methods' && (
          <div className="space-y-4">
            <h2 className="font-medium text-text-primary">Accepted Payment Methods</h2>
            <div className="space-y-2">
              {ALL_METHODS.map(method => (
                <label key={method} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={pmethods.includes(method)}
                    id={`pm-${method}`}
                    className="w-4 h-4 accent-brand-600"
                  />
                  <span className="text-sm text-text-primary capitalize">{method.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => {
                const selected = ALL_METHODS.filter(m =>
                  (document.getElementById(`pm-${m}`) as HTMLInputElement)?.checked
                )
                patchPM.mutate(selected)
              }}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Save Payment Methods
            </button>
          </div>
        )}

        {/* ── Modules ── */}
        {tab === 'modules' && (
          <div className="space-y-4">
            <h2 className="font-medium text-text-primary">Feature Modules</h2>
            <div className="space-y-3">
              {Object.entries(modules).map(([key, enabled]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-text-primary capitalize">{key.replace('_', ' ')}</span>
                  <button
                    onClick={() => patchModules.mutate({ [key]: !enabled })}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors',
                      enabled ? 'bg-brand-600' : 'bg-border',
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                      enabled ? 'translate-x-5' : 'translate-x-0.5',
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
