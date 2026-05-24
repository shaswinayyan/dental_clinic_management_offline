/**
 * HTTP implementation of ApiClient.
 *
 * Used when the app runs in web/SaaS mode (VITE_APP_MODE=web).
 * Mirrors the same interface as the Electron IPC bridge so all pages can call
 * the same API regardless of mode.
 *
 * Features:
 *  - Automatic Authorization header injection from authStore
 *  - Silent token refresh on 401 (single-flight — avoids thundering herd)
 *  - Retry the failed request once after a successful refresh
 *  - Throws typed ApiError for non-2xx responses
 */
import type {
  ApiClient,
  Clinic, Branch, WorkingHours, StaffMember, CloudAuthSession,
  ApptConfig, ApptCustomStatus, CustomField,
  Patient, PatientFormData, Appointment, AppointmentFormData, AppointmentStatus,
  Invoice, InvoiceItem, Payment,
  InventoryItem, InventoryTransaction,
  PagedResponse,
} from '../../../shared/types'

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues?: Array<{ path: string; message: string }>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Token refresh single-flight ───────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null

async function doRefresh(baseUrl: string, getRefreshToken: () => string | null): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const rt = getRefreshToken()
      if (!rt) throw new ApiError(401, 'No refresh token — please log in again')

      const res  = await fetch(`${baseUrl}/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken: rt }),
      })
      const data = await res.json() as { success: boolean; data?: { accessToken: string }; error?: string }

      if (!res.ok || !data.success || !data.data) {
        throw new ApiError(401, data.error ?? 'Session expired — please log in again')
      }
      return data.data.accessToken
    })().finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

// ── HTTP client factory ───────────────────────────────────────────────────────

export interface TokenStore {
  getAccessToken:  () => string | null
  getRefreshToken: () => string | null
  setAccessToken:  (token: string) => void
  clearTokens:     () => void
}

export function createFetchApi(
  baseUrl:    string,
  tokenStore: TokenStore,
): ApiClient {
  /**
   * Core fetch wrapper. Injects auth header, parses JSON, throws ApiError on
   * non-2xx, and retries once after a silent token refresh on 401.
   */
  async function request<T>(
    method:  string,
    path:    string,
    body?:   unknown,
    retry = true,
  ): Promise<T> {
    const accessToken = tokenStore.getAccessToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    // Attempt silent token refresh on first 401
    if (res.status === 401 && retry) {
      try {
        const newToken = await doRefresh(baseUrl, tokenStore.getRefreshToken)
        tokenStore.setAccessToken(newToken)
        return request<T>(method, path, body, false)
      } catch {
        tokenStore.clearTokens()
        throw new ApiError(401, 'Session expired — please log in again')
      }
    }

    const json = await res.json() as { success: boolean; data?: T; error?: string; issues?: Array<{ path: string; message: string }> }

    if (!res.ok || !json.success) {
      throw new ApiError(res.status, json.error ?? 'Request failed', json.issues)
    }
    return json.data as T
  }

  const get    = <T>(path: string)                   => request<T>('GET',    path)
  const post   = <T>(path: string, body?: unknown)   => request<T>('POST',   path, body)
  const patch  = <T>(path: string, body?: unknown)   => request<T>('PATCH',  path, body)
  const put    = <T>(path: string, body?: unknown)    => request<T>('PUT',    path, body)
  const del    = <T>(path: string, body?: unknown)   => request<T>('DELETE', path, body)

  // ── ApiClient implementation ───────────────────────────────────────────────

  return {
    // ── Auth ──────────────────────────────────────────────────────────────
    async login(email, password) {
      const data = await post<CloudAuthSession>('/auth/login', { email, password })
      tokenStore.setAccessToken(data.accessToken)
      return data
    },
    async logout() {
      const rt = tokenStore.getRefreshToken()
      if (rt) await post<null>('/auth/logout', { refreshToken: rt }).catch(() => {/* best-effort */})
      tokenStore.clearTokens()
    },
    async refreshTokens() {
      const rt = tokenStore.getRefreshToken()
      if (!rt) throw new ApiError(401, 'No refresh token')
      return post('/auth/refresh', { refreshToken: rt })
    },
    getMe: () => get<StaffMember>('/auth/me'),

    // ── Clinic ────────────────────────────────────────────────────────────
    getClinic:        ()           => get<Clinic>('/settings/clinic'),
    updateClinic:     (data)       => patch<Clinic>('/settings/clinic', data),

    // ── Branches ──────────────────────────────────────────────────────────
    getBranches:      ()           => get<Branch[]>('/branches'),
    getBranch:        (id)         => get<Branch>(`/branches/${id}`),
    createBranch:     (data)       => post<Branch>('/branches', data),
    updateBranch:     (id, data)   => patch<Branch>(`/branches/${id}`, data),
    deleteBranch:     (id)         => del<void>(`/branches/${id}`),

    // ── Staff ─────────────────────────────────────────────────────────────
    getStaff:         (branchId)   => get<StaffMember[]>(branchId ? `/staff?branchId=${branchId}` : '/staff'),
    getStaffMember:   (id)         => get<StaffMember>(`/staff/${id}`),
    createStaff:      (data)       => post<StaffMember>('/staff', data),
    updateStaff:      (id, data)   => patch<StaffMember>(`/staff/${id}`, data),
    deleteStaff:      (id)         => del<void>(`/staff/${id}`),

    // ── Patients ──────────────────────────────────────────────────────────
    getPatients(params) {
      const qs = new URLSearchParams()
      if (params?.page)     qs.set('page',     String(params.page))
      if (params?.limit)    qs.set('limit',    String(params.limit))
      if (params?.search)   qs.set('search',   params.search)
      if (params?.branchId) qs.set('branchId', params.branchId)
      const q = qs.toString()
      return get<PagedResponse<Patient>>(`/patients${q ? `?${q}` : ''}`) as Promise<PagedResponse<Patient>>
    },
    getPatient:        (id)         => get<Patient>(`/patients/${id}`),
    createPatient:     (data)       => post<Patient>('/patients', data),
    updatePatient:     (id, data)   => patch<Patient>(`/patients/${id}`, data),
    archivePatient:    (id)         => del<void>(`/patients/${id}`),

    // ── Appointments ──────────────────────────────────────────────────────
    getAppointments(params) {
      const qs = new URLSearchParams()
      if (params?.date)     qs.set('date',     params.date)
      if (params?.branchId) qs.set('branchId', params.branchId)
      if (params?.doctorId) qs.set('doctorId', params.doctorId)
      if (params?.status)   qs.set('status',   params.status)
      const q = qs.toString()
      return get<Appointment[]>(`/appointments${q ? `?${q}` : ''}`)
    },
    getAppointment:   (id)          => get<Appointment>(`/appointments/${id}`),
    createAppointment: (data)        => post<Appointment>('/appointments', data),
    updateAppointment: (id, data)    => patch<Appointment>(`/appointments/${id}`, data),
    deleteAppointment: (id)          => del<void>(`/appointments/${id}`),

    // ── Billing ───────────────────────────────────────────────────────────
    getInvoices(params) {
      const qs = new URLSearchParams()
      if (params?.page)      qs.set('page',      String(params.page))
      if (params?.limit)     qs.set('limit',     String(params.limit))
      if (params?.patientId) qs.set('patientId', params.patientId)
      if (params?.status)    qs.set('status',    params.status)
      const q = qs.toString()
      return get<PagedResponse<Invoice>>(`/billing/invoices${q ? `?${q}` : ''}`) as Promise<PagedResponse<Invoice>>
    },
    getInvoice:    (id)           => get<Invoice & { items: InvoiceItem[]; payments: Payment[] }>(`/billing/invoices/${id}`),
    createInvoice: (data)         => post<Invoice>('/billing/invoices', data),
    voidInvoice:   (id, reason)   => post<Invoice>(`/billing/invoices/${id}/void`, { reason }),
    recordPayment: (invoiceId, data) => post<Payment>(`/billing/invoices/${invoiceId}/payments`, data),

    // ── Inventory ─────────────────────────────────────────────────────────
    getInventoryItems:          (branchId) => get<InventoryItem[]>(`/inventory/items?branchId=${branchId}`),
    createInventoryItem:        (data)     => post<InventoryItem>('/inventory/items', data),
    updateInventoryItem:        (id, data) => patch<InventoryItem>(`/inventory/items/${id}`, data),
    recordInventoryTransaction: (data)     => post<InventoryTransaction>('/inventory/transactions', data),

    // ── Settings ──────────────────────────────────────────────────────────
    getApptConfig:    (branchId)    => get<ApptConfig>(`/branches/${branchId}/appt-config`),
    updateApptConfig: (branchId, d) => patch<ApptConfig>(`/branches/${branchId}/appt-config`, d),
    getCustomStatuses: (branchId)   => get<ApptCustomStatus[]>(`/branches/${branchId}/custom-statuses`),
    upsertCustomStatus: (branchId, d) => post<ApptCustomStatus>(`/branches/${branchId}/custom-statuses`, d),
    deleteCustomStatus: (id)        => del<void>(`/appointments/custom-statuses/${id}`),
    getCustomFields:   (et)         => get<CustomField[]>(`/settings/custom-fields?entity_type=${et}`),
    upsertCustomField: (data)       => post<CustomField>('/settings/custom-fields', data),
    deleteCustomField: (id)         => del<void>(`/settings/custom-fields/${id}`),
  }
}
