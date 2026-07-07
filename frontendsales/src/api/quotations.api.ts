import { apiClient } from './client'
import type { QuotationTemplate } from './quotationTemplates.api'

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

export function quotationFileUrl(quotationId: string, variant: 'draft' | 'admin-signed' | 'final'): string {
  return `/api/quotations/${quotationId}/file/${variant}`
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
  return `/api/public/quotations/${token}/file`
}

export async function signPublicQuotation(token: string, signatureDataUrl: string): Promise<void> {
  await apiClient.post(`/public/quotations/${token}/sign`, { signatureDataUrl })
}
