import { useEffect, useState } from 'react'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/Login'
import MainLayout from './components/Layout/MainLayout'
import type { IpcResult, User } from '../../shared/types'


export default function App() {
  const { isAuthenticated, login } = useAuthStore()
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const result = await window.api.auth.initAdmin() as IpcResult
        if (!result.success) console.error('initAdmin failed:', result.error)
      } catch (e) {
        console.error('initAdmin error:', e)
      } finally {
        setInitializing(false)
      }
    }
    init()
  }, [])

  if (initializing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a1628', flexDirection: 'column', gap: 16 }}>
        <svg width="56" height="56" viewBox="0 0 80 80" fill="none" style={{ opacity: 0.85 }}>
          <path d="M38 10C34 10 30.5 12.5 29 16C27 14 24 13.5 22.5 15C20.5 17.5 21 21.5 22.5 25C24 28.5 24 32 24.5 36.5C25 41 27 45 29 45C30.5 45 31 43 31.5 40.5C32 38 32.5 36.5 34.5 36.5C36.5 36.5 37 38 37.5 40.5C38 43 38.5 45 40.5 45C42.5 45 44.5 41 45 36.5C45.5 32 45.5 28.5 47 25C48.5 21.5 49 17.5 47 15C45.5 13.5 42.5 14 41 16C39.5 12.5 38.5 10 38 10Z" fill="rgba(201,168,76,0.15)" stroke="#c9a84c" strokeWidth="1.8"/>
          <path d="M 48 40 C 54 34 56 22 50 14 C 44 7 32 6 24 12 C 16 18 15 30 20 38" stroke="#c9a84c" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
          <line x1="50" y1="14" x2="66" y2="5" stroke="#c9a84c" strokeWidth="2.2" strokeLinecap="round"/>
          <path d="M 58 4 L 72 3 L 68 16 Z" fill="#c9a84c"/>
        </svg>
        <div style={{ color: 'rgba(201,168,76,0.8)', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Initialising Vorsa…</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={(user: User) => login(user)} />
  }

  return <MainLayout />
}
