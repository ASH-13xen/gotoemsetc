import { apiClient } from './client'

// Generated files are stored as bytes on the backend (Mongo, not Cloudinary
// or local disk — see backend/src/models/GeneratedDocument.js) and served
// through an authenticated download route instead of a direct URL. The list
// endpoint never sends the bytes themselves, just this metadata, so the UI
// knows a file exists and what to call it.
export interface FileMeta {
  contentType: string
  filename: string
}

export interface GeneratedDocument {
  _id: string
  employee: string
  template: { _id: string; key: string; title: string; category: string }
  templateVersion: number
  mergeDataSnapshot?: Record<string, unknown>
  docx?: FileMeta
  pdf?: FileMeta
  // The countersigned copy HR/admin uploads back after the employee
  // physically signs this document — separate from the generated pdf/docx.
  signedFile?: FileMeta
  status: 'completed' | 'failed'
  errorMessage?: string
  createdAt: string
}

export interface GenerateResult {
  templateId: string
  templateKey?: string
  status: 'completed' | 'failed'
  error?: string
  document?: GeneratedDocument
}

export async function generateDocuments(
  employeeId: string,
  templateIds: string[],
  overrides: Record<string, unknown>
): Promise<{ results: GenerateResult[] }> {
  const { data } = await apiClient.post(`/employees/${employeeId}/documents/generate`, {
    templateIds,
    overrides,
  })
  return data
}

export async function listEmployeeDocuments(
  employeeId: string
): Promise<{ documents: GeneratedDocument[] }> {
  const { data } = await apiClient.get(`/employees/${employeeId}/documents`)
  return data
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`)
}

// The download route is admin-gated (needs the Bearer token), so a plain
// <a href> can't be used — fetch it as a blob through the authenticated
// axios instance instead (same pattern as downloadSalarySlip).
export async function fetchGeneratedFileBlob(documentId: string): Promise<Blob> {
  const { data } = await apiClient.get(`/documents/${documentId}/file`, { responseType: 'blob' })
  return data
}

export async function downloadGeneratedFile(documentId: string, filename: string): Promise<void> {
  const blob = await fetchGeneratedFileBlob(documentId)
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function uploadSignedDocument(
  employeeId: string,
  documentId: string,
  file: File
): Promise<{ document: GeneratedDocument }> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post(
    `/employees/${employeeId}/documents/${documentId}/signed`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return data
}

export async function downloadSignedFile(documentId: string, filename: string): Promise<void> {
  const { data } = await apiClient.get(`/documents/${documentId}/signed-file`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(data as Blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
