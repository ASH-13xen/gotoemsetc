import { apiClient } from './client'

export interface StepLibraryEntry {
  _id: string
  label: string
}

export async function listSteps(): Promise<{ steps: StepLibraryEntry[] }> {
  const { data } = await apiClient.get('/step-library')
  return data
}

export async function createStep(label: string): Promise<{ step: StepLibraryEntry }> {
  const { data } = await apiClient.post('/step-library', { label })
  return data
}

export async function updateStep(id: string, label: string): Promise<{ step: StepLibraryEntry }> {
  const { data } = await apiClient.patch(`/step-library/${id}`, { label })
  return data
}

export async function deleteStep(id: string): Promise<void> {
  await apiClient.delete(`/step-library/${id}`)
}
