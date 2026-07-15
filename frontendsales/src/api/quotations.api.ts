import { apiClient } from './client'
import type { QuotationTemplate } from './quotationTemplates.api'

const API_BASE_URL = apiClient.defaults.baseURL ?? '/api'

export type QuotationStatus = 'draft' | 'shared' | 'signed' | 'superseded'

export interface FileRef {
  filePath: string
}

export interface Quotation {
  _id: string
  client: string
  template: QuotationTemplate
  version: number
  planOptionKey?: string
  status: QuotationStatus
  generatedFile?: FileRef
  adminSignedFile?: FileRef
  finalSignedFile?: FileRef
  sharedAt?: string
  signedAt?: string
  createdAt: string
  updatedAt: string
}

export interface GenerateQuotationInput {
  templateId: string
  planOptionKey?: string
}

export async function listQuotations(clientId: string): Promise<Quotation[]> {
  const { data } = await apiClient.get<{ quotations: Quotation[] }>(`/clients/${clientId}/quotations`)
  return data.quotations
}

export async function generateQuotation(clientId: string, input: GenerateQuotationInput): Promise<Quotation> {
  const { data } = await apiClient.post<{ quotation: Quotation }>(`/clients/${clientId}/quotations`, input)
  return data.quotation
}

export async function adminSignQuotation(
  quotationId: string,
  signatureDataUrl: string
): Promise<{ quotation: Quotation; shareToken: string; shareUrl: string }> {
  const { data } = await apiClient.post<{ quotation: Quotation; shareToken: string; shareUrl: string }>(
    `/quotations/${quotationId}/admin-sign`,
    { signatureDataUrl }
  )
  return data
}

// Mints a fresh share link for an already admin-signed quotation — lets the
// admin re-fetch the client-facing signing link (and share buttons) any
// time after the initial sign, not just in the one-shot moment right after
// signing. Invalidates whatever link was shared before.
export async function regenerateQuotationShareLink(
  quotationId: string
): Promise<{ quotation: Quotation; shareToken: string; shareUrl: string }> {
  const { data } = await apiClient.post<{ quotation: Quotation; shareToken: string; shareUrl: string }>(
    `/quotations/${quotationId}/share-link`
  )
  return data
}

export function quotationFileUrl(quotationId: string, variant: 'draft' | 'admin-signed' | 'final'): string {
  return `${API_BASE_URL}/quotations/${quotationId}/file/${variant}`
}

// This route is admin-gated (needs the Bearer token), so a plain <a href>
// can't be used — a bare browser navigation never attaches the Authorization
// header and just gets a 401 JSON body back. Fetch it as a blob through the
// authenticated axios instance instead and open that in a new tab.
export async function openQuotationFile(
  quotationId: string,
  variant: 'draft' | 'admin-signed' | 'final'
): Promise<void> {
  const { data } = await apiClient.get(`/quotations/${quotationId}/file/${variant}`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(data)
  window.open(url, '_blank', 'noreferrer')
}

// --- Public (client-facing, token-gated) ---

export interface PublicQuotation {
  clientName: string
  brandName: string
  templateTitle: string
  companyLabel: string
  status: QuotationStatus
}

export async function getPublicQuotation(token: string): Promise<PublicQuotation> {
  const { data } = await apiClient.get<{ quotation: PublicQuotation }>(`/public/quotations/${token}`)
  return data.quotation
}

export function publicQuotationFileUrl(token: string): string {
  return `${API_BASE_URL}/public/quotations/${token}/file`
}

export async function signPublicQuotation(token: string, signatureDataUrl: string): Promise<void> {
  await apiClient.post(`/public/quotations/${token}/sign`, { signatureDataUrl })
}
