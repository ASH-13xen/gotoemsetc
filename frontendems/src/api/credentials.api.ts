import { apiClient } from './client'

// Keep in sync with backend/src/config/constants.js#PERMISSIONS — an admin
// always has every one of these implicitly, a worker only what's listed here.
export type Permission =
  | 'view_applicants'
  | 'add_employee'
  | 'generate_documents'
  | 'request_documents'
  | 'add_credentials'
  | 'view_salary_slip'
  | 'edit_employee_details'
  | 'mark_attendance'

export const PERMISSION_OPTIONS: { value: Permission; label: string }[] = [
  { value: 'view_applicants', label: 'View recruitment / applicants' },
  { value: 'add_employee', label: 'Add employee' },
  { value: 'generate_documents', label: 'Generate documents' },
  { value: 'request_documents', label: 'Request documents (HR collection)' },
  { value: 'add_credentials', label: 'Add credentials' },
  { value: 'view_salary_slip', label: 'View / generate salary slip' },
  { value: 'edit_employee_details', label: "Edit employees' details" },
  { value: 'mark_attendance', label: "Mark employees' attendance" },
]

export interface Credential {
  _id: string
  username: string
  role: string
  isActive: boolean
  permissions: Permission[]
}

export async function getCredentialForEmployee(employeeId: string): Promise<{ credential: Credential | null }> {
  const { data } = await apiClient.get(`/users/by-employee/${employeeId}`)
  return data
}

export async function createCredential(
  employeeId: string,
  input: { username: string; password: string; permissions?: Permission[] }
): Promise<{ credential: Credential }> {
  const { data } = await apiClient.post(`/users/by-employee/${employeeId}`, input)
  return data
}

export async function updateCredential(
  userId: string,
  input: { username?: string; password?: string; permissions?: Permission[] }
): Promise<{ credential: Credential }> {
  const { data } = await apiClient.patch(`/users/${userId}`, input)
  return data
}

export async function deleteCredential(userId: string): Promise<{ credential: Credential }> {
  const { data } = await apiClient.delete(`/users/${userId}`)
  return data
}
