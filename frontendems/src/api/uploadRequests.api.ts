import { apiClient } from './client'

export type UploadRequestStatus = 'pending' | 'partially_fulfilled' | 'fulfilled' | 'expired' | 'revoked'

export interface UploadRequest {
  _id: string
  employee: string
  requestedDocTypes: string[]
  status: UploadRequestStatus
  expiresAt: string
  fulfilledAt?: string
  createdAt: string
  // Reconstructed server-side from the (plainly stored) token — present on
  // every request, active or not; the frontend decides when to show it.
  link: string
  // The one-time login code the employee must enter on the upload page in
  // addition to the link. Cleared server-side (becomes null) once the
  // request stops being active — expired, revoked, or fully fulfilled.
  accessCode: string | null
}

export interface UploadedDocument {
  _id: string
  employee: string
  // Absent for documents an admin attached directly rather than an employee
  // fulfilling a request link — see uploadDocumentDirect below.
  uploadRequest?: string
  docType: string
  // Only set when docType is 'other' — the custom name typed in for it.
  otherLabel?: string
  originalFilename?: string
  mimeType?: string
  sizeBytes?: number
  url: string
  createdAt: string
}

export async function createUploadRequest(
  employeeId: string,
  requestedDocTypes: string[],
  expiresInHours?: number
): Promise<{ uploadRequest: UploadRequest }> {
  const { data } = await apiClient.post(`/employees/${employeeId}/upload-requests`, {
    requestedDocTypes,
    expiresInHours,
  })
  return data
}

export async function listUploadRequests(
  employeeId: string
): Promise<{ uploadRequests: UploadRequest[] }> {
  const { data } = await apiClient.get(`/employees/${employeeId}/upload-requests`)
  return data
}

export async function revokeUploadRequest(id: string): Promise<void> {
  await apiClient.post(`/upload-requests/${id}/revoke`)
}

export async function listUploadedDocuments(
  employeeId: string
): Promise<{ uploadedDocuments: UploadedDocument[] }> {
  const { data } = await apiClient.get(`/employees/${employeeId}/uploaded-documents`)
  return data
}

export async function deleteUploadedDocument(id: string): Promise<void> {
  await apiClient.delete(`/uploaded-documents/${id}`)
}

// Admin attaching a document straight to an employee's file — no request
// link/access-code round trip, distinct from the employee-facing flow above.
export async function uploadDocumentDirect(
  employeeId: string,
  docType: string,
  file: File,
  otherLabel?: string
): Promise<{ document: UploadedDocument }> {
  const formData = new FormData()
  formData.append('docType', docType)
  if (otherLabel) formData.append('otherLabel', otherLabel)
  formData.append('file', file)
  const { data } = await apiClient.post(`/employees/${employeeId}/uploaded-documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
