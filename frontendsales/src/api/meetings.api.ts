import { apiClient } from './client'

export interface MeetingAttendee {
  _id: string
  firstName: string
  lastName?: string
  designation?: string
  employeeCode?: string
}

export interface Meeting {
  _id: string
  client: string
  mom: string
  meetingDate: string
  attendees: MeetingAttendee[]
  createdAt: string
}

export interface CreateMeetingInput {
  mom: string
  meetingDate: string
  attendees?: string[]
}

export async function listMeetings(clientId: string): Promise<{ meetings: Meeting[] }> {
  const { data } = await apiClient.get(`/clients/${clientId}/meetings`)
  return data
}

export async function createMeeting(
  clientId: string,
  input: CreateMeetingInput
): Promise<{ meeting: Meeting }> {
  const { data } = await apiClient.post(`/clients/${clientId}/meetings`, input)
  return data
}
