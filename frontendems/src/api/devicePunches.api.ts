import { apiClient } from './client'

export interface DevicePunch {
  _id: string
  employeeCode: string
  employee?: {
    _id: string
    firstName: string
    lastName?: string
    employeeCode: string
    designation?: string
  } | null
  timestamp: string
  deviceSerial?: string
}

export async function listDevicePunches(params?: {
  limit?: number
  employeeId?: string
}): Promise<{ punches: DevicePunch[] }> {
  const { data } = await apiClient.get('/device-punches', { params })
  return data
}
