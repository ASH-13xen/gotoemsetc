import { apiClient } from './client'

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'ceo' | 'digital_admin' | 'hr' | 'operations_manager' | 'account_manager' | 'team_lead' | 'worker'
  // The Employee this credential belongs to. Client Management needs it to
  // tell whether the signed-in user is a given team's leader or social media
  // manager, which is what decides who may approve at each stage.
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
