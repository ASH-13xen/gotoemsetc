import { apiClient } from './client'

export interface EmployeeInventory {
  deviceName?: string
  imeiOrSerialNumber?: string
  deviceColor?: string
  simProvider?: string
  simPhoneNumber?: string
  screenGuard?: boolean
  backCover?: boolean
  powerAdapter?: boolean
  cable?: boolean
}

export interface InventoryRow {
  employeeId: string
  employeeName: string
  employeeCode: string
  designation?: string
  inventory: EmployeeInventory
}

export async function listInventoryReport(): Promise<{ employees: InventoryRow[] }> {
  const { data } = await apiClient.get('/inventory-report')
  return data
}
