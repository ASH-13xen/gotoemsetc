import { apiClient } from './client'

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'worker'
  employeeLink: string | null
  permissions: string[]
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
