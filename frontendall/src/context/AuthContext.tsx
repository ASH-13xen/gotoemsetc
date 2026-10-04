import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getToken, getStoredUser, setToken, setStoredUser, clearToken, type StoredUser } from '@/lib/authStorage'
import { fetchMe } from '@/api/auth.api'

interface AuthContextValue {
  user: StoredUser | null
  token: string | null
  isReady: boolean
  signIn: (token: string, user: StoredUser) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken())
  const [user, setUserState] = useState<StoredUser | null>(() => getStoredUser())
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!token) {
      setIsReady(true)
      return
    }
    fetchMe()
      .then(({ user: freshUser }) => {
        setUserState(freshUser)
        setStoredUser(freshUser)
      })
      .catch(() => {
        clearToken()
        setTokenState(null)
        setUserState(null)
      })
      .finally(() => setIsReady(true))
    // Only re-validate when the token itself changes (sign in/out).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Access follows the Organisation chart and can change any time — re-read
  // it every minute and whenever the tab comes back into focus, so a menu
  // appears (or disappears) without signing out.
  useEffect(() => {
    if (!token) return
    const refresh = () =>
      fetchMe()
        .then(({ user: freshUser }) => {
          setUserState((prev) => (JSON.stringify(prev) === JSON.stringify(freshUser) ? prev : freshUser))
          setStoredUser(freshUser)
        })
        .catch(() => {
          // a 401 is handled by the API client (signs out); ignore blips
        })
    const timer = setInterval(refresh, 60_000)
    const onFocus = () => document.visibilityState === 'visible' && refresh()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [token])

  function signIn(nextToken: string, nextUser: StoredUser) {
    setToken(nextToken)
    setStoredUser(nextUser)
    setTokenState(nextToken)
    setUserState(nextUser)
  }

  function signOut() {
    clearToken()
    setTokenState(null)
    setUserState(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, isReady, signIn, signOut }}>{children}</AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
