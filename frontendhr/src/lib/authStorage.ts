const TOKEN_KEY = 'ems_auth_token'
const USER_KEY = 'ems_auth_user'

export interface StoredUser {
  id: string
  username: string
  role: 'admin' | 'ceo' | 'digital_admin' | 'hr' | 'operations_manager' | 'cto' | 'cfo' | 'sales' | 'team_lead' | 'technical' | 'finance' | 'worker'
  employeeLink: string | null
  permissions: string[]
  // Live from the server (backend access.service.js): the login's role plus
  // every Organisation chart post held, and what those allow — see
  // lib/access.ts. The host app refreshes these every minute.
  roles?: string[]
  postRoles?: string[]
  access?: string[]
  displayName?: string
  features?: { TASK_MANAGEMENT?: boolean; CLIENT_MANAGEMENT?: boolean }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredUser
  } catch {
    return null
  }
}

export function setStoredUser(user: StoredUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}
