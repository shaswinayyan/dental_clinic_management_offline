'use client'

import { useState }    from 'react'
import { useRouter }   from 'next/navigation'
import Link            from 'next/link'
import { useSupabase } from '@/components/providers'
import { Eye, EyeOff, Stethoscope, CheckCircle } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v2'

export default function SignUpPage() {
  const { supabase } = useSupabase()
  const router       = useRouter()

  const [step, setStep]               = useState<'form' | 'verify'>('form')
  const [showPw, setShowPw]           = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [clinicName, setClinicName]   = useState('')
  const [ownerName, setOwnerName]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    // 1. Create Supabase auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: ownerName },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // 2. If we have a session immediately (email confirmation disabled), register clinic now
    const token = authData.session?.access_token

    if (token) {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          clinic_name: clinicName,
          owner_name:  ownerName,
          owner_email: email,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setError(body.error ?? 'Failed to create clinic. Please contact support.')
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
      return
    }

    // 3. Email confirmation required — show "check your inbox" step
    // We store the clinic details in sessionStorage so we can complete
    // registration after the user confirms their email and signs back in
    sessionStorage.setItem('pendingClinic', JSON.stringify({ clinicName, ownerName, email }))
    setStep('verify')
    setLoading(false)
  }

  if (step === 'verify') {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-border p-8 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-text-primary mb-2">Check your email</h2>
        <p className="text-sm text-text-secondary mb-4">
          We sent a confirmation link to <strong>{email}</strong>.
          Click it to verify your account, then sign in — your clinic will be created automatically.
        </p>
        <Link
          href="/sign-in"
          className="inline-block px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          Go to sign in
        </Link>
      </div>
    )
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

      <h1 className="text-xl font-semibold text-text-primary mb-1">Register your clinic</h1>
      <p className="text-sm text-text-secondary mb-6">Create your free account — no credit card required</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Clinic name */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Clinic Name</label>
          <input
            type="text"
            required
            value={clinicName}
            onChange={e => setClinicName(e.target.value)}
            placeholder="Bright Smile Dental"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
          />
        </div>

        {/* Owner name */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Your Full Name</label>
          <input
            type="text"
            required
            value={ownerName}
            onChange={e => setOwnerName(e.target.value)}
            placeholder="Dr. John Smith"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
          />
        </div>

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
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Password <span className="text-text-muted font-normal">(min. 8 characters)</span>
          </label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
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
          {loading ? 'Creating your clinic…' : 'Create clinic account'}
        </button>
      </form>

      <p className="text-xs text-text-muted text-center mt-5">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-brand-600 hover:text-brand-700 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}
