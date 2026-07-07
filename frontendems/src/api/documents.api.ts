import { apiClient } from './client'

export interface FileRef {
  url: string
  publicId: string
  bytes: number
}

export interface GeneratedDocument {
  _id: string
  employee: string
  template: { _id: string; key: string; title: string; category: string }
  templateVersion: number
  mergeDataSnapshot?: Record<string, unknown>
  docx?: FileRef
  pdf?: FileRef
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
