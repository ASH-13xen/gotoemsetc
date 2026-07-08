import { apiClient } from './client'

export interface Credential {
  _id: string
  username: string
  role: string
  isActive: boolean
}

export async function getCredentialForEmployee(employeeId: string): Promise<{ credential: Credential | null }> {
  const { data } = await apiClient.get(`/users/by-employee/${employeeId}`)
  return data
}

export async function createCredential(
  employeeId: string,
  input: { username: string; password: string }
): Promise<{ credential: Credential }> {
  const { data } = await apiClient.post(`/users/by-employee/${employeeId}`, input)
  return data
}

export async function updateCredential(
  userId: string,
  input: { username?: string; password?: string }
): Promise<{ credential: Credential }> {
  const { data } = await apiClient.patch(`/users/${userId}`, input)
  return data
}

export async function deleteCredential(userId: string): Promise<{ credential: Credential }> {
  const { data } = await apiClient.delete(`/users/${userId}`)
  return data
}
