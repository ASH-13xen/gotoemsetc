import axios from 'axios'
import { getToken, clearToken } from '@/lib/authStorage'

// In dev this stays '/api' and goes through the Vite proxy. In production set
// VITE_API_URL to the deployed backend's origin — with or without a trailing
// '/api', either works, since it's normalized here rather than requiring the
// env var to be typed exactly right.
function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL || '/api'
  const trimmed = raw.replace(/\/+$/, '')
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken()
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  }
)
