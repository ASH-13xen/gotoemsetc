import { apiClient } from './client'

const API_BASE_URL = apiClient.defaults.baseURL ?? '/api'

export type PlanType = 'duration' | 'quantity' | 'fixed'

export interface PlanOption {
  key: string
  label: string
}

export interface FieldPosition {
  page: number
  xPct: number
  yPct: number
  widthPct: number
  heightPct: number
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

export interface ScopeOfWorkStep {
  label: string
  order: number
}

export interface ScopeOfWorkItem {
  label: string
  qtyPerCycle: number
  // Only meaningful for 'duration' (recurring monthly) templates — when
  // true, qtyPerCycle is "count per day" and multiplied by the number of
  // days in the cycle rather than used as a flat monthly total.
  perDay?: boolean
}

export interface ScopeOfWorkSection {
  name: string
  items: ScopeOfWorkItem[]
  steps: ScopeOfWorkStep[]
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
  scopeOfWork: ScopeOfWorkSection[]
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

export async function updateScopeOfWork(
  id: string,
  scopeOfWork: ScopeOfWorkSection[]
): Promise<QuotationTemplate> {
  const { data } = await apiClient.patch<{ template: QuotationTemplate }>(`/quotation-templates/${id}/scope-of-work`, {
    scopeOfWork,
  })
  return data.template
}

export function quotationTemplatePdfUrl(id: string): string {
  return `${API_BASE_URL}/quotation-templates/${id}/pdf`
}
