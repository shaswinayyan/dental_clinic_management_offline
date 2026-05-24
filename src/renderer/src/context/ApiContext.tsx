/**
 * ApiContext — provides the API client to the entire React tree.
 *
 * Usage in any component or hook:
 *   const api = useApi()
 *   const patients = await api.getPatients({ search: query })
 *
 * The context value is set once during app bootstrap by ApiProvider and never
 * changes, so consumers do NOT need to list `api` in useMemo/useCallback deps.
 */
import React, { createContext, useContext, type ReactNode } from 'react'
import type { ApiClient } from '../../../shared/types'
import { getApiClient } from '../api/client'

const ApiContext = createContext<ApiClient | null>(null)

interface ApiProviderProps {
  children: ReactNode
}

export function ApiProvider({ children }: ApiProviderProps): React.ReactElement {
  // getApiClient() is guaranteed to be ready by the time ApiProvider renders,
  // because initApiClient() is called before ReactDOM.createRoot().render().
  const api = getApiClient()
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
}

/**
 * Hook to access the API client anywhere in the component tree.
 * Throws if called outside of ApiProvider.
 */
export function useApi(): ApiClient {
  const ctx = useContext(ApiContext)
  if (!ctx) {
    throw new Error('useApi must be used within an <ApiProvider>')
  }
  return ctx
}
