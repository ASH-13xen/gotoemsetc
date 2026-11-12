import { apiClient } from './client'

// A person's own company devices (backend routes/device.routes.js, /mine),
// and HR's device items for the Action centre. HR's full Devices pages live
// in the HR Work remote (frontendhr).

export type PartState = 'ok' | 'worn' | 'damaged' | 'missing'
export type Grade = 'A' | 'B' | 'C' | 'D'

export const GRADE_LABEL: Record<Grade, string> = { A: 'A — Like new', B: 'B — Minor wear', C: 'C — Visible damage', D: 'D — Needs repair' }
export const ISSUE_LABEL: Record<string, string> = {
  storage: 'Storage full',
  app_install: "An app won't install",
  apple_id: 'Apple ID not syncing',
  google_account: 'Google account / contacts not syncing',
  battery: 'Battery',
  damage: 'Damage',
  network_sim: 'Network / SIM',
  slow: 'Slow / freezing',
  other: 'Something else',
}

export interface AppState {
  key: string
  installed?: boolean
  loggedIn?: boolean
}

export interface CheckInput {
  grade?: Grade
  parts: Record<string, PartState>
  storageTotalGb?: number | string
  storageFreeGb?: number | string
  batteryHealth?: number | string
  security: Record<string, boolean>
  apps: AppState[]
  galleryBackedUp?: boolean
  remarks?: string
}

export interface MyDevice {
  _id: string
  code: string
  kind: 'phone' | 'laptop' | 'tablet' | 'other'
  brand?: string
  model?: string
  storageGb?: number
  simNumber?: string
  parts: { key: string; label: string }[]
  securityItems: { key: string; label: string }[]
  assignment?: { _id: string; assignedAt: string; acceptedAt?: string; accessories: { label: string; qty: number }[] } | null
  monthCheck: { status: 'submitted' | 'verified' | 'rejected'; reviewNote?: string; createdAt: string } | null
  checkOverdue: boolean
  openIssues: { _id: string; category: string; description?: string; createdAt: string }[]
}

export interface MyDevices {
  checkDueDay: number
  month: string
  apps: { key: string; label: string; required: boolean }[]
  brand: { whatsappName?: string; bio?: string; website?: string; address?: string; logo?: string | null; brochure?: string | null }
  devices: MyDevice[]
  footage: { _id: string; shootDate: string; client?: { name: string } | null; clientName?: string; driveLink: string; clearedFromPhone?: boolean }[]
}

export interface DeviceActionItems {
  checksToVerify: { id: string; text: string }[]
  checksOverdue: { id: string; text: string }[]
  unreturned: { id: string; text: string }[]
  issues: { id: string; text: string }[]
  runbooks: { id: string; text: string }[]
  unsigned: { id: string; text: string }[]
}

export const deviceName = (d: { brand?: string; model?: string; code?: string }) => [d.brand, d.model].filter(Boolean).join(' ') || d.code || ''

export const myDevices = async () => (await apiClient.get<MyDevices>('/devices/mine')).data
export const acceptDevice = async (assignmentId: string) => (await apiClient.post(`/devices/mine/assignments/${assignmentId}/accept`, {})).data
export async function sendMonthlyCheck(deviceId: string, input: CheckInput, photos: File[]) {
  const form = new FormData()
  form.append('data', JSON.stringify(input))
  for (const p of photos) form.append('photos', p)
  return (await apiClient.post(`/devices/mine/${deviceId}/check`, form)).data
}
export const reportDeviceIssue = async (deviceId: string, input: { category: string; description?: string }) =>
  (await apiClient.post(`/devices/mine/${deviceId}/issues`, input)).data
export const logFootage = async (input: {
  device?: string
  shootDate: string
  client?: string
  clientName?: string
  driveLink: string
  files?: number | string
  sizeGb?: number | string
  clearedFromPhone?: boolean
  note?: string
}) => (await apiClient.post('/devices/mine/footage', input)).data
export const deviceFile = async (id: string) => (await apiClient.get(`/devices/files/${id}`, { responseType: 'blob' })).data as Blob

export const deviceActionItems = async () => (await apiClient.get<DeviceActionItems>('/devices/action-items')).data

export const apiMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
