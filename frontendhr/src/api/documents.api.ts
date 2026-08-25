import { apiClient } from './client'

export interface DocumentTemplateSummary {
  _id: string
  key: string
  title: string
  category: string
}

export async function listActiveTemplates(): Promise<{ templates: DocumentTemplateSummary[] }> {
  const { data } = await apiClient.get('/templates', { params: { active: true } })
  return data
}

export type DocumentOverviewBucket = 'generated_and_signed' | 'generated' | 'not_generated'

export interface DocumentOverviewRow {
  employeeId: string
  employeeName: string
  employeeCode: string
  bucket: DocumentOverviewBucket
  documentId: string | null
}

export interface DocumentOverview {
  template: { key: string; title: string }
  rows: DocumentOverviewRow[]
}

export async function getDocumentsOverview(templateKey: string): Promise<DocumentOverview> {
  const { data } = await apiClient.get('/documents/overview', { params: { templateKey } })
  return data
}

async function openBlobInNewTab(path: string) {
  const { data } = await apiClient.get(path, { responseType: 'blob' })
  const url = window.URL.createObjectURL(data as Blob)
  window.open(url, '_blank')
  // Revoked after a short delay rather than immediately — the new tab needs
  // the URL to still be valid by the time it finishes loading the PDF.
  setTimeout(() => window.URL.revokeObjectURL(url), 30000)
}

export function previewGeneratedFile(documentId: string) {
  return openBlobInNewTab(`/documents/${documentId}/file`)
}

export function previewSignedFile(documentId: string) {
  return openBlobInNewTab(`/documents/${documentId}/signed-file`)
}
