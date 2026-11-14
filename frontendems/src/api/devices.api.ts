import { apiClient } from './client'

// The company devices someone holds (HR Work → Devices), as their profile
// shows them — no serials, IMEI, SIM ids, accounts or values.
export interface HeldDevice {
  _id: string
  code: string
  kind: 'phone' | 'laptop' | 'tablet' | 'other'
  brand: string
  model: string
  color: string
  assignedAt: string | null
  acceptedAt: string | null
  accessories: string[]
  monthCheck: { status: 'submitted' | 'verified' | 'rejected'; createdAt: string } | null
  // Checked this month — by HR, or the holder's check once verified: nothing more is due.
  checkedThisMonth?: { createdAt: string; byHolder: boolean } | null
  // Handed over this month: the first monthly check is next month's.
  newThisMonth?: boolean
  checkOverdue?: boolean
  openIssues: number
}

export async function getHeldDevices(employeeId: string): Promise<{ canManage: boolean; checkDueDay?: number; devices: HeldDevice[] }> {
  const { data } = await apiClient.get(`/devices/held/${employeeId}`)
  return data
}
