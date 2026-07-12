import { apiClient } from './client'

export interface BirthdayEmployee {
  _id: string
  firstName: string
  lastName?: string
  employeeCode?: string
  dob: string
}

export async function getBirthdays(): Promise<{ employees: BirthdayEmployee[] }> {
  const { data } = await apiClient.get('/employees/birthdays')
  return data
}
