import { apiClient } from './client'

// E-signing generated documents (backend services/esign.service.js): HR sends
// a document to the employee's company or personal mail; they sign it online
// (or it's issued, for letters with nothing to sign); the company's
// signatories' signatures are placed when documents are generated.

export type SignatureStatus = 'sent' | 'viewed' | 'signed' | 'declined' | 'cancelled' | 'issued'
export interface DocumentSignature {
  _id: string
  document: string
  employee: string
  title: string
  templateKey: string
  kind: 'sign' | 'issue'
  status: SignatureStatus
  code: string
  channel: 'company' | 'personal'
  email: string
  sentAt: string
  viewedAt: string | null
  codeVerifiedAt: string | null
  signedAt: string | null
  issuedAt: string | null
  signerName: string | null
  declinedAt: string | null
  declineReason: string | null
  cancelledAt: string | null
  cancelReason: string | null
  tokenExpiresAt: string | null
  originalHash: string
  signedHash: string | null
  verifyUrl: string
}
export interface Signatory {
  key: 'ceo' | 'hr'
  name: string
  title: string
  hasSignature: boolean
  image: string | null
  updatedAt: string | null
}

export const listSignatures = async (employeeId: string) => (await apiClient.get<{ signatures: DocumentSignature[] }>(`/esign/employee/${employeeId}`)).data.signatures
export const sendForSignature = async (input: { employeeId: string; documentId: string; channel: 'company' | 'personal' }) =>
  (await apiClient.post<{ signature: DocumentSignature }>('/esign/send', input)).data.signature
export const remindSignature = async (id: string) => (await apiClient.post<{ signature: DocumentSignature }>(`/esign/${id}/remind`)).data.signature
export const cancelSignature = async (id: string, reason?: string) => (await apiClient.post<{ signature: DocumentSignature }>(`/esign/${id}/cancel`, { reason })).data.signature
export const openToSign = async (id: string) => (await apiClient.post<{ token: string }>(`/esign/${id}/open`)).data.token
export async function downloadSignedPdf(id: string, filename: string) {
  const { data } = await apiClient.get(`/esign/${id}/file`, { responseType: 'blob' })
  const url = URL.createObjectURL(data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const getSignatories = async () => (await apiClient.get<{ signatories: Signatory[] }>('/esign/settings')).data.signatories
export async function saveSignatory(key: 'ceo' | 'hr', input: { name: string; title?: string; image?: Blob }) {
  const form = new FormData()
  form.append('name', input.name)
  if (input.title) form.append('title', input.title)
  if (input.image) form.append('image', input.image, `${key}-signature.png`)
  return (await apiClient.put<{ signatories: Signatory[] }>(`/esign/signatories/${key}`, form)).data.signatories
}

// Letters with nothing for the employee to sign are issued instead.
export const ISSUE_ONLY = ['experience-letter', 'relieving-letter']
