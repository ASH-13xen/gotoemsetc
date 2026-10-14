import { apiClient } from './client'

export interface BirthdayEmployee {
  _id: string
  firstName: string
  lastName?: string
  employeeCode?: string
  dob: string
}

export interface AnniversaryEmployee {
  _id: string
  firstName: string
  lastName?: string
  anniversaryDate: string
}

// Wedding anniversaries of married employees — on the calendar every year.
export async function getAnniversaries(): Promise<{ employees: AnniversaryEmployee[] }> {
  const { data } = await apiClient.get('/employees/anniversaries')
  return data
}

export async function getBirthdays(): Promise<{ employees: BirthdayEmployee[] }> {
  const { data } = await apiClient.get('/employees/birthdays')
  return data
}
