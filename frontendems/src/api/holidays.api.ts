import { apiClient } from './client'

export interface Holiday {
  _id: string
  date: string
  label: string
}

export async function listHolidays(month: number, year: number): Promise<{ holidays: Holiday[] }> {
  const { data } = await apiClient.get('/holidays', { params: { month, year } })
  return data
}

export async function createHoliday(date: string, label: string): Promise<{ holiday: Holiday }> {
  const { data } = await apiClient.post('/holidays', { date, label })
  return data
}

export async function deleteHoliday(id: string): Promise<void> {
  await apiClient.delete(`/holidays/${id}`)
}
