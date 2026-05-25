'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider }               from '@tanstack/react-query'
import { createBrowserSupabase }                          from '@/lib/supabase'
import type { Session, SupabaseClient, User }             from '@supabase/supabase-js'

// ── Supabase context ──────────────────────────────────────────────────────────

type SupabaseCtx = {
  supabase: SupabaseClient
  session:  Session | null
  user:     User | null
}

const SupabaseContext = createContext<SupabaseCtx | undefined>(undefined)

export function useSupabase() {
  const ctx = useContext(SupabaseContext)
  if (!ctx) throw new Error('useSupabase must be used inside <Providers>')
  return ctx
}

// ── Providers ─────────────────────────────────────────────────────────────────

export function Providers({ children }: { children: React.ReactNode }) {
  const [supabase]     = useState(() => createBrowserSupabase())
  const [session, setSession] = useState<Session | null>(null)
  const [queryClient]  = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime:            60 * 1000,
        retry:                1,
        refetchOnWindowFocus: false,
      },
    },
  }))

  useEffect(() => {
    // Hydrate session on mount
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    // Keep session in sync across tabs
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return (
    <SupabaseContext.Provider value={{ supabase, session, user: session?.user ?? null }}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SupabaseContext.Provider>
  )
}
