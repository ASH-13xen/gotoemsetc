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
  openIssues: number
}

export async function getHeldDevices(employeeId: string): Promise<{ canManage: boolean; devices: HeldDevice[] }> {
  const { data } = await apiClient.get(`/devices/held/${employeeId}`)
  return data
}
