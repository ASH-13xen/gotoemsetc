import { apiClient } from './client'

export interface DocType {
  key: string
  label: string
  // Attached by HR as part of an action (probation, promotion) — never requested from the employee.
  internal?: boolean
}

export interface AppConfig {
  docTypes: DocType[]
  emailEnabled: boolean
  companyName: string
}

export async function getConfig(): Promise<AppConfig> {
  const { data } = await apiClient.get('/config')
  return data
}
