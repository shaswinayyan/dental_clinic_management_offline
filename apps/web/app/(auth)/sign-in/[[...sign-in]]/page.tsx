'use client'

import { useState }              from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link                      from 'next/link'
import { useSupabase }           from '@/components/providers'
import { Eye, EyeOff, Stethoscope } from 'lucide-react'

export default function SignInPage() {
  const { supabase }   = useSupabase()
  const router         = useRouter()
  const searchParams   = useSearchParams()
  const next           = searchParams.get('next') ?? '/dashboard'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-border p-8">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
          <Stethoscope className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-semibold text-text-primary">Vorsa Cloud</span>
      </div>

      <h1 className="text-xl font-semibold text-text-primary mb-1">Welcome back</h1>
      <p className="text-sm text-text-secondary mb-6">Sign in to your clinic account</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@clinic.com"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
          />
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-text-secondary">Password</label>
            <button
              type="button"
              className="text-xs text-brand-600 hover:text-brand-700"
              onClick={async () => {
                if (!email) { setError('Enter your email first'); return }
                await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                })
                setError('Password reset email sent — check your inbox')
              }}
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-xs text-text-muted text-center mt-5">
        No account?{' '}
        <Link href="/sign-up" className="text-brand-600 hover:text-brand-700 font-medium">
          Register your clinic
        </Link>
      </p>
    </div>
  )
}
