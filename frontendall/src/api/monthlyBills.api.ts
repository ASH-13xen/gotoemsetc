import { apiClient } from './client'

export interface PendingBillReminder {
  notificationId: string
  monthlyBill?: string
  title: string
  message: string
  createdAt: string
}

export async function getPendingBillReminders(): Promise<{ reminders: PendingBillReminder[] }> {
  const { data } = await apiClient.get('/monthly-bills/reminders/mine')
  return data
}
