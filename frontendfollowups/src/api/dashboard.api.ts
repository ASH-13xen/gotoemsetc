import { apiClient } from './client'
import type { MeetingAttendee } from './meetings.api'

export interface ClientStageSummary {
  _id: string
  latestStage: string
  latestStatus: string
  clientName: string
  brandName: string
}

export interface OverdueTask {
  _id: string
  title: string
  dueDate: string
  status: string
  client?: { _id: string; clientName: string; brandName: string }
  assigneeEmployees: { _id: string; firstName: string; lastName?: string }[]
}

export interface UpcomingMeeting {
  _id: string
  mom: string
  meetingDate: string
  client?: { _id: string; clientName: string; brandName: string }
  attendees: MeetingAttendee[]
}

export interface FollowupsStats {
  overdueTasks: OverdueTask[]
  upcomingMeetings: UpcomingMeeting[]
  clientsByStage: ClientStageSummary[]
}

export async function getFollowupsStats(): Promise<FollowupsStats> {
  const { data } = await apiClient.get('/dashboard/followups')
  return data
}
