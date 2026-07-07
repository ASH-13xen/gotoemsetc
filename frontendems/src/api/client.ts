import axios from 'axios'
import { getToken, clearToken } from '@/lib/authStorage'

export const apiClient = axios.create({
  // In dev this stays '/api' and goes through the Vite proxy; in production
  // (no proxy exists once this is a static Vercel deployment) set
  // VITE_API_URL to the deployed backend's absolute URL, e.g.
  // https://ems-backend.onrender.com/api.
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
