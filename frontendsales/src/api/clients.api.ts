import { apiClient } from './client'

export type ClientStatus = 'lead' | 'onboarded' | 'offboarded'

export interface Contact {
  _id: string
  name: string
  role?: string
  email?: string
  phone?: string
  createdAt: string
}

export interface AssignedEmployee {
  _id: string
  firstName: string
  lastName?: string
  designation?: string
  employeeCode?: string
}

export interface ExtraDetail {
  key: string
  value?: string
}

export interface SalesClient {
  _id: string
  clientName: string
  brandName: string
  dateRegistered: string
  logoUrl?: string
  contacts: Contact[]
  status: ClientStatus
  currentQuotation?: string
  assignedEmployees: AssignedEmployee[]
  mainEmployee?: AssignedEmployee
  extraDetails: ExtraDetail[]
  createdAt: string
  updatedAt: string
}

export interface ListClientsParams {
  search?: string
  status?: ClientStatus
  page?: number
  limit?: number
}

export interface ListClientsResponse {
  items: SalesClient[]
  total: number
  page: number
  limit: number
}

export interface RegisterClientInput {
  clientName: string
  brandName: string
  dateRegistered: string
}

export interface ContactInput {
  name: string
  role?: string
  email?: string
  phone?: string
}

export async function listClients(params: ListClientsParams): Promise<ListClientsResponse> {
  const { data } = await apiClient.get('/clients', { params })
  return data
}

export async function getClient(id: string): Promise<{ client: SalesClient }> {
  const { data } = await apiClient.get(`/clients/${id}`)
  return data
}

export async function registerClient(input: RegisterClientInput): Promise<{ client: SalesClient }> {
  const { data } = await apiClient.post('/clients', input)
  return data
}

export async function addContact(id: string, input: ContactInput): Promise<{ client: SalesClient }> {
  const { data } = await apiClient.post(`/clients/${id}/contacts`, input)
  return data
}

export async function removeContact(id: string, contactId: string): Promise<{ client: SalesClient }> {
  const { data } = await apiClient.delete(`/clients/${id}/contacts/${contactId}`)
  return data
}

export async function offboardClient(id: string): Promise<{ client: SalesClient }> {
  const { data } = await apiClient.post(`/clients/${id}/offboard`)
  return data
}

export async function uploadClientLogo(id: string, file: File): Promise<{ client: SalesClient }> {
  const formData = new FormData()
  formData.append('logo', file)
  const { data } = await apiClient.post(`/clients/${id}/logo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function assignEmployees(
  id: string,
  assignedEmployees: string[],
  mainEmployee: string | null
): Promise<{ client: SalesClient }> {
  const { data } = await apiClient.patch(`/clients/${id}`, { assignedEmployees, mainEmployee })
  return data
}

export async function updateExtraDetails(id: string, extraDetails: ExtraDetail[]): Promise<{ client: SalesClient }> {
  const { data } = await apiClient.patch(`/clients/${id}`, { extraDetails })
  return data
}
