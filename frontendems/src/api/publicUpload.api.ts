import { apiClient } from './client'

export interface PublicUploadStatus {
  employeeName: string
  requestedDocTypes: string[]
  uploadedDocTypes: string[]
  status: string
  expiresAt: string
}

export async function getPublicUploadStatus(token: string): Promise<PublicUploadStatus> {
  const { data } = await apiClient.get(`/public/upload-requests/${token}`)
  return data
}

export async function uploadPublicDocuments(
  token: string,
  files: Record<string, File>
): Promise<{ uploaded: { docType: string; url: string }[] }> {
  const formData = new FormData()
  for (const [docType, file] of Object.entries(files)) {
    formData.append(docType, file)
  }
  const { data } = await apiClient.post(`/public/upload-requests/${token}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
