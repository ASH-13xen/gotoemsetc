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

export interface SalesClient {
  _id: string
  clientName: string
  brandName: string
  dateRegistered: string
  contacts: Contact[]
  status: ClientStatus
  currentQuotation?: string
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
