const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5050/api'

export interface ClientTheme {
  primaryColor: string
  secondaryColor: string
}

export interface ClientProfile {
  id: string
  username: string
  clientName: string
  brandName?: string
  logoUrl: string | null
  theme: ClientTheme
}

export interface LoginResponse {
  token: string
  client: ClientProfile
}

export class ApiRequestError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string })
    throw new ApiRequestError(body.message ?? 'Something went wrong', res.status)
  }
  return res.json() as Promise<T>
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/client-portal/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function fetchMe(token: string): Promise<{ client: ClientProfile }> {
  return request<{ client: ClientProfile }>('/client-portal/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
}
