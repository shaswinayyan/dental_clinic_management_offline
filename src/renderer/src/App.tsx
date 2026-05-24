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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1e3a8a' }}>
        <div style={{ color: '#fff', fontSize: 18 }}>Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={(user: User) => login(user)} />
  }

  return <MainLayout />
}
