import { apiClient } from './client'

export interface PublicClientDocumentStatus {
  clientName: string
  brandName: string
  requestedDocTypes: string[]
  uploadedSlots: number[]
  status: string
  expiresAt: string
}

export async function verifyClientDocumentAccessCode(token: string, code: string): Promise<void> {
  await apiClient.post(`/public/client-documents/${token}/verify`, { code })
}

export async function getPublicClientDocumentStatus(
  token: string,
  code: string
): Promise<PublicClientDocumentStatus> {
  const { data } = await apiClient.get(`/public/client-documents/${token}`, { params: { code } })
  return data
}

export interface UploadClientDocumentsResult {
  uploaded: { slotIndex: number; docLabel: string }[]
  status: string
  uploadedSlots: number[]
}

export async function uploadPublicClientDocuments(
  token: string,
  code: string,
  files: Record<number, File>
): Promise<UploadClientDocumentsResult> {
  const formData = new FormData()
  formData.append('code', code)
  for (const [slotIndex, file] of Object.entries(files)) {
    formData.append(`doc_${slotIndex}`, file)
  }
  const { data } = await apiClient.post(`/public/client-documents/${token}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
