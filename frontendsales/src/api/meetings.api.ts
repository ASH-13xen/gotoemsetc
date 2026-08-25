import { apiClient } from './client'
import type { EmployeeRef } from './cms.api'

export type MeetingType = 'online' | 'offline'
export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled'
export type MomTaskKind = 'personal' | 'team' | 'pipeline'
export type MomPipelineKind = 'post' | 'reel' | 'custom'

export interface UserRef {
  _id: string
  username: string
  role: string
}

export interface Mom {
  summary?: string
  attendeesPresent: EmployeeRef[]
  attendeesAbsent: EmployeeRef[]
  decisions: string[]
  actionItems: string[]
  writtenBy?: UserRef
  writtenAt?: string
}

export interface RescheduleEntry {
  from: string
  to: string
  at: string
  by?: UserRef
}

export interface SpawnedTask {
  task?: { _id: string; title: string; status: string }
  titleSnapshot: string
  descriptionSnapshot?: string
  kind: MomTaskKind
}

export interface TaskEditEntry {
  task: string
  changedFields: string[]
  changedAt: string
  changedBy?: UserRef
}

export interface Meeting {
  _id: string
  client: { _id: string; name: string; brandName?: string }
  scheduledAt: string
  status: MeetingStatus
  isLogged: boolean
  meetingType: MeetingType
  location?: string
  meetingLink?: string
  participants: EmployeeRef[]
  rescheduledAt?: string | null
  rescheduleHistory: RescheduleEntry[]
  cancelledAt?: string | null
  cancelledBy?: UserRef
  lateFlaggedAt?: string | null
  mom?: Mom
  spawnedTasks: SpawnedTask[]
  taskEdits: TaskEditEntry[]
  createdAt: string
}

export interface MeetingInput {
  clientId: string
  scheduledAt: string
  meetingType: MeetingType
  location?: string
  meetingLink?: string
  participants: string[]
}

export async function listMeetingsForClient(clientId: string): Promise<Meeting[]> {
  const { data } = await apiClient.get(`/meetings/client/${clientId}`)
  return data.meetings ?? []
}

export async function getMeeting(id: string): Promise<Meeting> {
  const { data } = await apiClient.get(`/meetings/${id}`)
  return data.meeting
}

export async function scheduleMeeting(input: MeetingInput): Promise<Meeting> {
  const { data } = await apiClient.post('/meetings', input)
  return data.meeting
}

export async function logMeeting(input: MeetingInput): Promise<Meeting> {
  const { data } = await apiClient.post('/meetings/log', input)
  return data.meeting
}

export async function rescheduleMeeting(id: string, scheduledAt: string): Promise<Meeting> {
  const { data } = await apiClient.post(`/meetings/${id}/reschedule`, { scheduledAt })
  return data.meeting
}

export async function cancelMeeting(id: string): Promise<Meeting> {
  const { data } = await apiClient.post(`/meetings/${id}/cancel`)
  return data.meeting
}

export interface SubmitMomInput {
  summary?: string
  attendeesPresent?: string[]
  attendeesAbsent?: string[]
  decisions?: string[]
  actionItems?: string[]
}

export async function submitMom(id: string, input: SubmitMomInput): Promise<Meeting> {
  const { data } = await apiClient.post(`/meetings/${id}/mom`, input)
  return data.meeting
}

export interface AddTaskInput {
  kind: MomTaskKind
  title: string
  description?: string
  startAt: string
  endAt: string
  reviewMandatory?: boolean
  assigneeId?: string // personal
  extraMembers?: string[] // team
  pipeline?: {
    kind: MomPipelineKind
    assignments?: { designer?: string; shooter?: string; editor?: string; contentManager?: string }
    customSteps?: Array<{ label: string; color: string; assignee: string }>
  }
}

export async function addTaskFromMom(meetingId: string, input: AddTaskInput): Promise<{ _id: string; title: string }> {
  const { data } = await apiClient.post(`/meetings/${meetingId}/tasks`, input)
  return data.task
}
