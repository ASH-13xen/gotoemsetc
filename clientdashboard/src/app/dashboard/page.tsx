'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { ClientLogo } from '@/components/ClientLogo'
import { readableTextColor, withAlpha } from '@/lib/color'

export default function DashboardPage() {
  const { client, isLoading, logout } = useAuth()
  const router = useRouter()
  const [isSignOutHovered, setIsSignOutHovered] = useState(false)

  useEffect(() => {
    if (!isLoading && !client) router.replace('/login')
  }, [isLoading, client, router])

  if (isLoading || !client) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading…</p>
      </main>
    )
  }

  // Secondary color can land anywhere from near-black to pale cream
  // depending on the client, so the header's own text/hover colors are
  // picked for contrast against it rather than assumed to always be white.
  const headerFg = readableTextColor(client.theme.secondaryColor)
  const headerFgMuted = withAlpha(headerFg, 0.6)
  const headerFgHoverBg = withAlpha(headerFg, 0.1)

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      {/* Secondary color is the "structure" of the shell — header + a thin
          accent rule — primary is reserved for the one visually loud thing
          per screen (right now, just the logo badge and the sign-out
          hover), so a light primary (e.g. yellow) never has to carry a
          whole header's worth of surface. */}
      <header
        className="flex items-center justify-between px-6 py-4 sm:px-10"
        style={{ backgroundColor: 'var(--brand-secondary)' }}
      >
        <div className="flex items-center gap-3">
          <ClientLogo client={client} />
          <div>
            <p className="text-sm font-semibold" style={{ color: headerFg }}>
              {client.brandName || client.clientName}
            </p>
            <p className="text-xs" style={{ color: headerFgMuted }}>
              Client Dashboard
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          onMouseEnter={() => setIsSignOutHovered(true)}
          onMouseLeave={() => setIsSignOutHovered(false)}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
          style={{
            color: isSignOutHovered ? headerFg : headerFgMuted,
            backgroundColor: isSignOutHovered ? headerFgHoverBg : 'transparent',
          }}
        >
          Sign out
        </button>
      </header>
      <div className="h-1 w-full" style={{ backgroundColor: 'var(--brand-primary)' }} />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <ClientLogo client={client} size={56} />
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">
          Welcome, {client.brandName || client.clientName}
        </h1>
        <p className="max-w-sm text-sm text-neutral-500">
          Your dashboard is set up and themed just for you — the tools you&apos;ll use here are coming soon.
        </p>
      </main>
    </div>
  )
}
