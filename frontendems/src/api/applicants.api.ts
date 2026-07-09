import { apiClient } from './client'

export type ApplicantStatus = 'pending' | 'interview_scheduled' | 'hired' | 'rejected'
export type ExperienceLevel = 'fresher' | '0-1' | '1-2' | '2-3' | '3-4' | '4+'
export type Availability = 'immediately' | '15_days' | '30_days' | '60_days'
export type WorkStyle = 'alone' | 'team'

export const POSITION_OPTIONS = [
  'Content Writer/ Script Writing (Podcast)',
  'Content Manager',
  'Social Media Manager (Podcast)',
  'Social Media Manager (Digital Marketing)',
  'Digital Marketer',
  'Performance Marketer',
  'Videographer + Video Editor (Both)',
  'Videographer',
  'Video Editor',
  'Graphic Designer',
  'Sales Executive',
  'Social Media Manager',
  'Operation Manager',
  'Event Manager',
  'Executive Assistant',
  'Finance Executive',
  'HR Executive',
] as const

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
  instagramId?: string
  experienceLevel?: ExperienceLevel
  hasLaptop?: boolean
  willingToRelocate?: boolean
  positionAppliedFor?: string
  availability?: Availability
  howDidYouFindUs?: string
  whyJoinCompany?: string
  workStylePreference?: WorkStyle
  whyHireYou?: string
  currentSalary?: string
  expectedSalary?: string
  dateApplied: string
  resumes?: Resume[]
  source: 'manual' | 'google_form'
  status: ApplicantStatus
  decisionDate?: string
  selectionNotes?: string
  rejectionReason?: string
  linkedEmployee?: string
  createdAt: string
}

export interface Interview {
  _id: string
  applicant: string
  scheduledBy: string
  scheduledAt: string
  status: 'scheduled' | 'completed' | 'cancelled'
  notes?: string
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
  instagramId?: string
  experienceLevel?: ExperienceLevel
  hasLaptop?: boolean
  willingToRelocate?: boolean
  positionAppliedFor?: string
  availability?: Availability
  howDidYouFindUs?: string
  whyJoinCompany?: string
  workStylePreference?: WorkStyle
  whyHireYou?: string
  currentSalary?: string
  expectedSalary?: string
  dateApplied: string
  resumes?: File[]
}

export async function listApplicants(params: ListApplicantsParams): Promise<ListApplicantsResponse> {
  const { data } = await apiClient.get('/applicants', { params })
  return data
}

export async function getApplicant(id: string): Promise<{ applicant: Applicant; activeInterview: Interview | null }> {
  const { data } = await apiClient.get(`/applicants/${id}`)
  return data
}

export async function createApplicant(input: CreateApplicantInput): Promise<{ applicant: Applicant }> {
  const formData = new FormData()
  for (const [key, value] of Object.entries(input)) {
    if (key === 'resumes' || value === undefined || value === null || value === '') continue
    formData.append(key, String(value))
  }
  for (const file of input.resumes ?? []) {
    formData.append('resumes', file)
  }

  const { data } = await apiClient.post('/applicants', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function hireApplicant(
  id: string,
  selectionNotes: string,
  decisionDate: string,
  startDate: string
): Promise<{ applicant: Applicant; employee: { _id: string } }> {
  const { data } = await apiClient.post(`/applicants/${id}/hire`, { selectionNotes, decisionDate, startDate })
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

export async function scheduleInterview(
  applicantId: string,
  scheduledAt: string,
  notes?: string
): Promise<{ applicant: Applicant; interview: Interview }> {
  const { data } = await apiClient.post(`/applicants/${applicantId}/interviews`, { scheduledAt, notes })
  return data
}

export async function cancelInterview(
  applicantId: string,
  interviewId: string
): Promise<{ applicant: Applicant; interview: Interview }> {
  const { data } = await apiClient.post(`/applicants/${applicantId}/interviews/${interviewId}/cancel`)
  return data
}
