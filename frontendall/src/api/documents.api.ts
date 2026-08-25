import { apiClient } from './client'

export interface FileMeta {
  contentType: string
  filename: string
}

export interface GeneratedDocument {
  _id: string
  employee: string
  template: { _id: string; key: string; title: string; category: string }
  docx?: FileMeta
  pdf?: FileMeta
  // Only present once HR uploads the countersigned copy back — the
  // self-service dashboard only ever shows/downloads this, never the bare
  // unsigned original.
  signedFile?: FileMeta
  status: 'completed' | 'failed'
  createdAt: string
}

export async function listMyDocuments(employeeId: string): Promise<{ documents: GeneratedDocument[] }> {
  const { data } = await apiClient.get(`/employees/${employeeId}/documents`)
  return data
}

export async function downloadMySignedDocument(
  employeeId: string,
  documentId: string,
  filename: string
): Promise<void> {
  const { data } = await apiClient.get(`/employees/${employeeId}/documents/${documentId}/signed-file`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(data as Blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
