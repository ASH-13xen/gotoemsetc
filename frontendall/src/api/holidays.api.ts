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
