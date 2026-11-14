import { apiClient } from './client'

// E-signing — the public pages (no login): signing from the email link, and
// checking any signed or issued copy. Backend: services/esign.service.js.

export interface SignView {
  title: string
  company: string
  firstName: string
  status: 'sent' | 'viewed' | 'signed' | 'declined' | 'cancelled' | 'issued'
  email: string
  code: string | null
  signedAt: string | null
  expiresAt: string | null
  consent: string
}

export interface VerifyRecord {
  found: boolean
  code?: string
  title?: string
  company?: string
  issuedTo?: string
  kind?: 'sign' | 'issue'
  status?: SignView['status']
  signedAt?: string | null
  issuedAt?: string | null
  signerName?: string | null
  sentAt?: string
  companySignatories?: { key: string; name: string; title?: string }[]
  originalHash?: string
  signedHash?: string | null
}

export const getSignView = async (token: string) => (await apiClient.get<SignView>(`/public/esign/${token}`)).data
export const requestSignCode = async (token: string) => (await apiClient.post<{ sentTo: string; expiresInMinutes: number }>(`/public/esign/${token}/code`)).data
export const verifySignCode = async (token: string, code: string) =>
  (await apiClient.post<{ session: string; expiresInMinutes: number }>(`/public/esign/${token}/verify`, { code })).data
export const fetchSignFile = async (token: string, session: string) =>
  (await apiClient.get<Blob>(`/public/esign/${token}/file`, { headers: { 'x-esign-session': session }, responseType: 'blob' })).data
export const signDocument = async (token: string, input: { session: string; name: string; signature: string; consent: boolean }) =>
  (await apiClient.post<{ status: 'signed'; code: string; verifyUrl: string }>(`/public/esign/${token}/sign`, input)).data
export const declineDocument = async (token: string, input: { session: string; reason: string }) =>
  (await apiClient.post<{ status: 'declined' }>(`/public/esign/${token}/decline`, input)).data

export const verifyByCode = async (code: string) => (await apiClient.get<VerifyRecord>(`/public/verify/${encodeURIComponent(code)}`)).data
export const verifyUpload = async (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return (await apiClient.post<{ hash: string; match: 'signed' | 'issued' | 'as_sent' | 'none'; record?: VerifyRecord }>('/public/verify', form)).data
}

export function apiMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } } }
  return e?.response?.data?.message || fallback
}
