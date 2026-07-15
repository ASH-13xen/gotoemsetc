import { apiClient } from './client'

export interface PublicUploadStatus {
  employeeName: string
  requestedDocTypes: string[]
  uploadedDocTypes: string[]
  status: string
  expiresAt: string
}

export async function verifyUploadAccessCode(token: string, code: string): Promise<void> {
  await apiClient.post(`/public/upload-requests/${token}/verify`, { code })
}

export async function getPublicUploadStatus(token: string, code: string): Promise<PublicUploadStatus> {
  const { data } = await apiClient.get(`/public/upload-requests/${token}`, { params: { code } })
  return data
}

export interface UploadDocumentsResult {
  uploaded: { docType: string; url: string }[]
  status: string
  uploadedDocTypes: string[]
}

export async function uploadPublicDocuments(
  token: string,
  code: string,
  files: Record<string, File>
): Promise<UploadDocumentsResult> {
  const formData = new FormData()
  formData.append('code', code)
  for (const [docType, file] of Object.entries(files)) {
    formData.append(docType, file)
  }
  const { data } = await apiClient.post(`/public/upload-requests/${token}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
