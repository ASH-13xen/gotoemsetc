import { apiClient } from './client'

export interface DocType {
  key: string
  label: string
}

export interface AppConfig {
  docTypes: DocType[]
  emailEnabled: boolean
}

export async function getConfig(): Promise<AppConfig> {
  const { data } = await apiClient.get('/config')
  return data
}
