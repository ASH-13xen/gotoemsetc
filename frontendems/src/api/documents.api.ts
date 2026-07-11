import { apiClient } from './client'

export interface FileRef {
  url: string
  publicId: string
  bytes: number
}

// PDFs generated from HTML templates are stored on our own disk (Cloudinary
// blocks unauthenticated PDF delivery by default) and served through an
// authenticated download route instead of a direct URL — so unlike `docx`,
// this only tells the UI a PDF exists, not where to fetch it from directly.
export interface LocalFileRef {
  filePath: string
}

export interface GeneratedDocument {
  _id: string
  employee: string
  template: { _id: string; key: string; title: string; category: string }
  templateVersion: number
  mergeDataSnapshot?: Record<string, unknown>
  docx?: FileRef
  pdf?: LocalFileRef
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
// axios instance and trigger the browser download manually (same pattern as
// downloadSalarySlip).
export async function downloadGeneratedPdf(documentId: string, filename: string): Promise<void> {
  const { data } = await apiClient.get(`/documents/${documentId}/file`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
