import { apiClient } from './client'

export type PlanType = 'duration' | 'quantity' | 'fixed'

export interface PlanOption {
  key: string
  label: string
}

export interface FieldPosition {
  page: number
  xPct: number
  yPct: number
}

export interface QuotationTemplateFields {
  clientName?: FieldPosition
  brandName?: FieldPosition
  date?: FieldPosition
  planCheckboxes?: FieldPosition[]
  totalPayableAmount?: FieldPosition
  shootDate?: FieldPosition
  adminSignature?: FieldPosition
  clientSignature?: FieldPosition
}

export interface QuotationTemplate {
  _id: string
  key: string
  title: string
  companyLabel: string
  pdfFilename: string
  pageCount: number
  planType: PlanType
  planOptions: PlanOption[]
  hasBrandName: boolean
  combinedNameBrand: boolean
  hasDateField: boolean
  fixedAmount?: number
  fields: QuotationTemplateFields
  isConfigured: boolean
}

export async function listQuotationTemplates(): Promise<QuotationTemplate[]> {
  const { data } = await apiClient.get<{ templates: QuotationTemplate[] }>('/quotation-templates')
  return data.templates
}

export async function getQuotationTemplate(id: string): Promise<QuotationTemplate> {
  const { data } = await apiClient.get<{ template: QuotationTemplate }>(`/quotation-templates/${id}`)
  return data.template
}

export async function updateQuotationTemplateFields(
  id: string,
  fields: QuotationTemplateFields
): Promise<QuotationTemplate> {
  const { data } = await apiClient.patch<{ template: QuotationTemplate }>(`/quotation-templates/${id}/fields`, fields)
  return data.template
}

export function quotationTemplatePdfUrl(id: string): string {
  return `/api/quotation-templates/${id}/pdf`
}
