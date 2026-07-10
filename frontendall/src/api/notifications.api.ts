import { apiClient } from './client'

export type NotificationType =
  | 'interview_scheduled'
  | 'interview_reminder'
  | 'birthday_upcoming'
  | 'birthday_today'

export interface AppNotification {
  _id: string
  type: NotificationType
  title: string
  message: string
  applicant?: string
  interview?: string
  employee?: string
  isRead: boolean
  createdAt: string
}

export async function listNotifications(): Promise<{ notifications: AppNotification[] }> {
  const { data } = await apiClient.get('/notifications')
  return data
}

export async function unreadNotificationCount(): Promise<{ count: number }> {
  const { data } = await apiClient.get('/notifications/unread-count')
  return data
}

export async function markNotificationRead(id: string): Promise<{ notification: AppNotification }> {
  const { data } = await apiClient.patch(`/notifications/${id}/read`)
  return data
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch('/notifications/read-all')
}
