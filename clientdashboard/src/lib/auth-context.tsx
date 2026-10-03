'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchMe, login as apiLogin, type ClientProfile } from './api'

const TOKEN_KEY = 'client_portal_token'

interface AuthContextValue {
  client: ClientProfile | null
  // True only while the very first "do we already have a session" check is
  // in flight (page load / refresh) — never true again after that settles,
  // so callers can tell "still finding out" apart from "logged out".
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Repaints the whole app in the logged-in client's two colors — set as CSS
// custom properties on <html> so every component can reference
// var(--brand-primary)/var(--brand-secondary) via Tailwind's arbitrary-value
// syntax, rather than threading theme props through every element. Cleared
// back to the neutral defaults (see globals.css) on logout.
function applyTheme(client: ClientProfile | null) {
  const root = document.documentElement
  if (client) {
    root.style.setProperty('--brand-primary', client.theme.primaryColor)
    root.style.setProperty('--brand-secondary', client.theme.secondaryColor)
  } else {
    root.style.removeProperty('--brand-primary')
    root.style.removeProperty('--brand-secondary')
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<ClientProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restores the session from a stored token on first load (page refresh,
  // new tab) — /me is the source of truth, never the locally-cached client
  // profile alone, so a deactivated/edited account is caught immediately.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setIsLoading(false)
      return
    }
    fetchMe(token)
      .then(({ client }) => setClient(client))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    applyTheme(client)
  }, [client])

  async function login(username: string, password: string) {
    const { token, client } = await apiLogin(username, password)
    localStorage.setItem(TOKEN_KEY, token)
    setClient(client)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setClient(null)
  }

  return <AuthContext.Provider value={{ client, isLoading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
