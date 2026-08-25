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

  hasMobile?: boolean
  mobileOS?: 'android' | 'ios' | ''
  deviceCondition?: string
  whatsappTwoFactor?: boolean
  whatsappTwoFactorBackupMail?: string
  whatsappTwoFactorPin?: string
  whatsappNameUpdated?: boolean
  whatsappProfiling?: boolean
  whatsappBackupInEmployeeMail?: boolean
  galleryBackupInEmployeeMail?: boolean
  trueCallerUpdated?: boolean
  theftProtection?: boolean
  findMyDevice?: boolean
  appleId?: string
  password?: string
  thumbOrFace?: boolean

  hasLaptop?: boolean
  laptopDeviceName?: string
  laptopSerialNumber?: string
  laptopColor?: string
  laptopCondition?: string
  laptopTheftProtection?: boolean
  laptopFindMyDevice?: boolean
  laptopPassword?: string
  laptopThumbOrFace?: boolean
  laptopMouse?: boolean

  consentFormLink?: string
  gotofriendLoggedIn?: boolean
  employeeMailLoggedIn?: boolean
  clientMailLoggedIn?: boolean
  goToDataTransfer?: boolean
  podcastDataTransfer?: boolean
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
