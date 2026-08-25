import { apiClient } from './client'

export interface AnnouncementEmployee {
  _id: string
  firstName: string
  lastName?: string
  employeeCode?: string
}

// Admin-side management view — includes ack progress.
export interface Announcement {
  _id: string
  title: string
  message: string
  createdBy: { _id: string; username: string } | null
  createdAt: string
  recipients: AnnouncementEmployee[]
  acknowledgedCount: number
  totalRecipients: number
}

// What a recipient sees in their own "pending" queue — no ack-progress
// fields, since those aren't this employee's business.
export interface PendingAnnouncement {
  _id: string
  title: string
  message: string
  createdAt: string
}

export interface CreateAnnouncementInput {
  title: string
  message: string
  sendToAll?: boolean
  employeeIds?: string[]
}

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<{ announcement: Announcement }> {
  const { data } = await apiClient.post('/announcements', input)
  return data
}

export async function listAnnouncements(): Promise<{ announcements: Announcement[] }> {
  const { data } = await apiClient.get('/announcements')
  return data
}

export async function listMyPendingAnnouncements(): Promise<{ announcements: PendingAnnouncement[] }> {
  const { data } = await apiClient.get('/announcements/mine/pending')
  return data
}

export async function acknowledgeAnnouncement(id: string): Promise<void> {
  await apiClient.post(`/announcements/${id}/acknowledge`)
}
