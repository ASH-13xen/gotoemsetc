'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { ApiRequestError } from '@/lib/api'

export default function LoginPage() {
  const { client, isLoading, login } = useAuth()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Already signed in (e.g. hit /login directly with a valid session) —
  // send straight through rather than showing the form again.
  useEffect(() => {
    if (!isLoading && client) router.replace('/dashboard')
  }, [isLoading, client, router])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(username, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not sign in — try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-widest text-neutral-400 uppercase">Client Portal</p>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Sign in to your dashboard</h1>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="grid gap-1.5">
            <label htmlFor="username" className="text-sm font-medium text-neutral-700">
              Username
            </label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20"
            />
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-neutral-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-400">
          Use the username and password your team sent you.
        </p>
      </div>
    </main>
  )
}
