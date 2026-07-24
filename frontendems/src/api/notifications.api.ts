import { apiClient } from './client'

export interface Notification {
  _id: string
  type: string
  title: string
  message: string
  employee?: string
  client?: string
  applicant?: string
  interview?: string
  task?: string
  isRead: boolean
  createdAt: string
}

export async function listNotifications(unreadOnly?: boolean): Promise<{ notifications: Notification[] }> {
  const { data } = await apiClient.get('/notifications', { params: { unreadOnly } })
  return data
}

export async function getUnreadCount(): Promise<{ count: number }> {
  const { data } = await apiClient.get('/notifications/unread-count')
  return data
}

export async function markNotificationRead(id: string): Promise<{ notification: Notification }> {
  const { data } = await apiClient.patch(`/notifications/${id}/read`)
  return data
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch('/notifications/read-all')
}
