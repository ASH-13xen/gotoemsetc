import { apiClient } from './client'

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'ceo' | 'digital_admin' | 'hr' | 'operations_manager' | 'cto' | 'cfo' | 'sales' | 'team_lead' | 'technical' | 'finance' | 'worker'
  employeeLink: string | null
  permissions: string[]
  // Live from the server (backend access.service.js): the login's role plus
  // every Organisation chart post held, and what those allow — see
  // lib/access.ts. Refreshed every minute and whenever the tab regains focus.
  roles?: string[]
  postRoles?: string[]
  access?: string[]
  displayName?: string
  features?: { TASK_MANAGEMENT?: boolean; CLIENT_MANAGEMENT?: boolean }
}

export interface LoginInput {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

export async function login(input: LoginInput): Promise<LoginResponse> {
  const { data } = await apiClient.post('/auth/login', input)
  return data
}

export async function fetchMe(): Promise<{ user: AuthUser }> {
  const { data } = await apiClient.get('/auth/me')
  return data
}
