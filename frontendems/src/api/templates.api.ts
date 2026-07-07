import { apiClient } from './client'

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'currency' | 'boolean'
export type FieldSource = 'employee' | 'computed' | 'manual'

export interface TemplateField {
  key: string
  label: string
  type: FieldType
  required: boolean
  source: FieldSource
  mapsTo?: string
  options?: string[]
  defaultValue?: string
  group: string
  order: number
  helpText?: string
}

export interface LoopItemField {
  key: string
  label: string
  type: FieldType
}

export interface TemplateLoop {
  key: string
  label?: string
  itemFields: LoopItemField[]
}

export interface DocumentTemplate {
  _id: string
  key: string
  title: string
  description?: string
  category: 'onboarding' | 'compliance' | 'policy' | 'offboarding' | 'other'
  docxFilePath: string
  version: number
  isActive: boolean
  fields: TemplateField[]
  loops: TemplateLoop[]
}

export async function listTemplates(active = true): Promise<{ templates: DocumentTemplate[] }> {
  const { data } = await apiClient.get('/templates', { params: { active } })
  return data
}
