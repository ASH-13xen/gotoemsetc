import { apiClient } from './client'

export type InventoryItemCategory = 'office_phone' | 'personal_phone' | 'office_laptop' | 'personal_laptop'

export const INVENTORY_ITEM_CATEGORY_LABEL: Record<InventoryItemCategory, string> = {
  office_phone: 'Office Phone',
  personal_phone: 'Personal Phone',
  office_laptop: 'Office Laptop',
  personal_laptop: 'Personal Laptop',
}

// One row per categorized inventory item — an employee with 2 phones and a
// laptop appears 3 times here, once per item. See
// backend/src/services/inventoryReport.service.js.
export interface InventoryItemRow {
  itemId?: string
  employeeId: string
  employeeName: string
  employeeCode: string
  designation?: string
  category: InventoryItemCategory
  deviceName?: string
  serialNumber?: string
  color?: string
  condition?: string
  password?: string
  theftProtection?: boolean
  findMyDevice?: boolean
  thumbOrFace?: boolean
  simProvider?: string
  simPhoneNumber?: string
  screenGuard?: boolean
  backCover?: boolean
  powerAdapter?: boolean
  cable?: boolean
  mobileOS?: string
  appleId?: string
  whatsappTwoFactor?: boolean
  whatsappTwoFactorBackupMail?: string
  whatsappTwoFactorPin?: string
  whatsappNameUpdated?: boolean
  whatsappProfiling?: boolean
  whatsappBackupInEmployeeMail?: boolean
  galleryBackupInEmployeeMail?: boolean
  trueCallerUpdated?: boolean
  mouse?: boolean
}

export async function listInventoryReport(): Promise<{ items: InventoryItemRow[] }> {
  const { data } = await apiClient.get('/inventory-report')
  return data
}
