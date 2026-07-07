import { apiClient } from './client'

export type ApplicantStatus = 'applied' | 'hired' | 'rejected'

export interface Resume {
  url: string
  originalFilename?: string
}

export interface Applicant {
  _id: string
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  positionAppliedFor?: string
  dateApplied: string
  resume?: Resume
  status: ApplicantStatus
  decisionDate?: string
  selectionNotes?: string
  rejectionReason?: string
  linkedEmployee?: string
  createdAt: string
}

export interface ListApplicantsParams {
  search?: string
  status?: ApplicantStatus
  page?: number
  limit?: number
}

export interface ListApplicantsResponse {
  items: Applicant[]
  total: number
  page: number
  limit: number
}

export interface CreateApplicantInput {
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  positionAppliedFor?: string
  dateApplied: string
  resume?: File
}

export async function listApplicants(params: ListApplicantsParams): Promise<ListApplicantsResponse> {
  const { data } = await apiClient.get('/applicants', { params })
  return data
}

export async function getApplicant(id: string): Promise<{ applicant: Applicant }> {
  const { data } = await apiClient.get(`/applicants/${id}`)
  return data
}

export async function createApplicant(input: CreateApplicantInput): Promise<{ applicant: Applicant }> {
  const formData = new FormData()
  formData.append('firstName', input.firstName)
  if (input.lastName) formData.append('lastName', input.lastName)
  if (input.email) formData.append('email', input.email)
  if (input.phone) formData.append('phone', input.phone)
  if (input.positionAppliedFor) formData.append('positionAppliedFor', input.positionAppliedFor)
  formData.append('dateApplied', input.dateApplied)
  if (input.resume) formData.append('resume', input.resume)

  const { data } = await apiClient.post('/applicants', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function hireApplicant(
  id: string,
  selectionNotes: string,
  decisionDate: string
): Promise<{ applicant: Applicant; employee: { _id: string } }> {
  const { data } = await apiClient.post(`/applicants/${id}/hire`, { selectionNotes, decisionDate })
  return data
}

export async function rejectApplicant(
  id: string,
  rejectionReason: string,
  decisionDate: string
): Promise<{ applicant: Applicant }> {
  const { data } = await apiClient.post(`/applicants/${id}/reject`, { rejectionReason, decisionDate })
  return data
}

export async function deleteApplicant(id: string): Promise<void> {
  await apiClient.delete(`/applicants/${id}`)
}
