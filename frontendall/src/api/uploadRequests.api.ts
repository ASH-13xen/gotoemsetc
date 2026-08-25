import { apiClient } from './client'

export type UploadRequestStatus = 'pending' | 'partially_fulfilled' | 'fulfilled' | 'expired' | 'revoked'

export interface UploadRequest {
  _id: string
  requestedDocTypes: string[]
  status: UploadRequestStatus
  expiresAt: string
  createdAt: string
}

export async function listMyUploadRequests(employeeId: string): Promise<{ uploadRequests: UploadRequest[] }> {
  const { data } = await apiClient.get(`/employees/${employeeId}/upload-requests`)
  return data
}
