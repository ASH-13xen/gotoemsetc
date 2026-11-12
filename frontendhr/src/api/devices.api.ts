import { apiClient } from './client'

// HR Work → Devices — backend services/device.service.js and
// deviceAccess.service.js (routes/device.routes.js).

export type DeviceKind = 'phone' | 'laptop' | 'tablet' | 'other'
export type DeviceStatus = 'available' | 'assigned' | 'repair' | 'lost' | 'retired'
export type PartState = 'ok' | 'worn' | 'damaged' | 'missing'
export type Grade = 'A' | 'B' | 'C' | 'D'

export const KIND_LABEL: Record<DeviceKind, string> = { phone: 'Phone', laptop: 'Laptop', tablet: 'Tablet', other: 'Other' }
export const STATUS_LABEL: Record<DeviceStatus, string> = {
  available: 'Available',
  assigned: 'With someone',
  repair: 'Under repair',
  lost: 'Lost',
  retired: 'Retired',
}
export const GRADE_LABEL: Record<Grade, string> = { A: 'A — Like new', B: 'B — Minor wear', C: 'C — Visible damage', D: 'D — Needs repair' }
export const FLAG_LABEL: Record<string, string> = {
  low_storage: 'Low storage',
  battery_low: 'Weak battery',
  damaged: 'Damage',
  security_off: 'Security off',
  apps_missing: 'Apps missing',
  needs_repair: 'Needs repair',
  unknown_part: 'Non-genuine part',
  location_off: 'Location off',
}

// The same lists as backend utils/deviceCatalog.js.
export const PARTS: Record<DeviceKind, { key: string; label: string }[]> = {
  phone: [
    { key: 'screen', label: 'Screen' },
    { key: 'backGlass', label: 'Back glass / body' },
    { key: 'frame', label: 'Frame & buttons' },
    { key: 'frontCamera', label: 'Front camera' },
    { key: 'backCamera', label: 'Back camera' },
    { key: 'speakerMic', label: 'Speaker & mic' },
    { key: 'chargingPort', label: 'Charging port' },
    { key: 'screenGuard', label: 'Screen guard' },
    { key: 'backCover', label: 'Back cover' },
  ],
  laptop: [
    { key: 'screen', label: 'Screen' },
    { key: 'body', label: 'Body & hinges' },
    { key: 'keyboard', label: 'Keyboard & trackpad' },
    { key: 'ports', label: 'Ports' },
    { key: 'webcam', label: 'Webcam' },
    { key: 'speakerMic', label: 'Speaker & mic' },
  ],
  tablet: [],
  other: [{ key: 'body', label: 'Body' }],
}
PARTS.tablet = PARTS.phone

export const SECURITY_ITEMS: { key: string; label: string; kinds: DeviceKind[] }[] = [
  { key: 'screenLock', label: 'Screen lock on (PIN plus fingerprint or face)', kinds: ['phone', 'tablet', 'laptop'] },
  { key: 'theftProtection', label: 'Theft protection on (Android Theft Protection / iPhone Stolen Device Protection)', kinds: ['phone', 'tablet'] },
  { key: 'accountTwoFactor', label: '2-step verification on the company Google / Apple account, codes to a company number', kinds: ['phone', 'tablet', 'laptop'] },
  { key: 'whatsappTwoStep', label: 'WhatsApp two-step verification PIN set', kinds: ['phone'] },
  { key: 'companyMail', label: "The holder's company mail added", kinds: ['phone', 'tablet', 'laptop'] },
  { key: 'contactsSync', label: 'Contacts syncing with the company Gmail (on iPhone: Gmail is the default contacts account)', kinds: ['phone'] },
  { key: 'photosBackup', label: 'Google Photos backing up to the company account', kinds: ['phone', 'tablet'] },
]
export const securityItemsFor = (kind: DeviceKind) => SECURITY_ITEMS.filter((s) => s.kinds.includes(kind))

// iPhone: Settings → General → About → "Parts and Service History" lists a
// replaced part as a genuine Apple part or an unknown part; a part never
// replaced isn't listed.
export type GenuineState = 'not_listed' | 'genuine' | 'unknown'
export const GENUINE_PARTS: { key: string; label: string }[] = [
  { key: 'display', label: 'Display' },
  { key: 'battery', label: 'Battery' },
  { key: 'camera', label: 'Camera' },
]
export const GENUINE_LABEL: Record<GenuineState, string> = { not_listed: 'Not listed', genuine: 'Genuine Apple part', unknown: 'Unknown part' }

// Short names for a device's condition lists (which keep the keys).
const SECURITY_SHORT: Record<string, string> = {
  screenLock: 'Screen lock',
  theftProtection: 'Theft protection',
  accountTwoFactor: 'Account 2-step',
  whatsappTwoStep: 'WhatsApp two-step PIN',
  companyMail: 'Company mail',
  contactsSync: 'Contacts sync',
  photosBackup: 'Photos backup',
}
// Where the device is (backend utils/deviceCatalog.js LOCATION_ITEMS): its
// own Find My, and its live location shared from Google Maps with the company
// account, which HR then verifies on the map.
export const LOCATION_ITEMS: { key: string; label: string; short: string; kinds: DeviceKind[] }[] = [
  { key: 'findMy', label: 'Find My (iPhone) / Find My Device (Android) on, signed in to the company account', short: 'Find My', kinds: ['phone', 'tablet', 'laptop'] },
  { key: 'mapsSharing', label: 'Google Maps location sharing on — shared with the company account, "Until you turn this off"', short: 'Maps location sharing', kinds: ['phone', 'tablet'] },
  { key: 'locationAlways', label: 'Location on, Google Maps allowed "Always" / "All the time" with precise location', short: 'Location always on', kinds: ['phone', 'tablet'] },
]
export const locationItemsFor = (kind: DeviceKind) => LOCATION_ITEMS.filter((i) => i.kinds.includes(kind))
export const locationLabel = (key: string) => LOCATION_ITEMS.find((i) => i.key === key)?.short ?? key

export const partLabel = (kind: DeviceKind, key: string) => PARTS[kind]?.find((p) => p.key === key)?.label ?? key
export const securityLabel = (key: string) => SECURITY_SHORT[key] ?? key
export const appLabel = (apps: { key: string; label: string }[] | undefined, key: string) => apps?.find((a) => a.key === key)?.label ?? key

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
export const ACCOUNT_LABEL: Record<string, string> = {
  apple_id: 'Apple ID',
  google: 'Google account (Gmail)',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  google_business: 'Google Business Profile',
  truecaller: 'Truecaller',
  other: 'Other',
}
export const ACCESS_DEVICE_LABEL: Record<string, string> = {
  company_phone: 'Company phone',
  personal_phone: 'Personal phone',
  office_laptop: 'Office laptop',
  personal_laptop: 'Personal laptop',
}
export const ACCESS_KIND_LABEL: Record<string, string> = { app: 'App / login', account: 'Account', group: 'Group', other: 'Other' }
export const ACCESSORY_KIND_LABEL: Record<string, string> = {
  charger: 'Charger',
  cable: 'Cable',
  cover: 'Back cover',
  guard: 'Screen guard',
  earphones: 'Earphones',
  mouse: 'Mouse',
  other: 'Other',
}

export interface PersonRef {
  _id: string
  firstName: string
  lastName?: string
  employeeCode?: string
  designation?: string
  status?: string
}
export const personName = (p?: PersonRef | null) => (p ? `${p.firstName} ${p.lastName ?? ''}`.trim() : '—')

export interface AppState {
  key: string
  installed?: boolean
  loggedIn?: boolean
  account?: string
}

export interface Device {
  _id: string
  code: string
  kind: DeviceKind
  brand?: string
  model?: string
  modelNumber?: string
  os?: string | null
  osVersion?: string
  color?: string
  imei1?: string
  imei2?: string
  meid?: string
  iccid?: string
  eid?: string
  serialNumber?: string
  storageGb?: number
  simNumber?: string
  simProvider?: string
  purchaseDate?: string
  purchasePrice?: number
  recoveryValue?: number
  vendor?: string
  warrantyUntil?: string
  notes?: string
  status: DeviceStatus
  holder?: PersonRef | null
  assignment?: string | null
  condition?: {
    grade?: Grade | null
    storageFreePct?: number
    batteryHealth?: number
    damaged?: string[]
    securityOff?: string[]
    appsMissing?: string[]
    unknownParts?: string[]
    locationOff?: string[]
    at?: string
  }
  // HR saw it on the map (Google Maps location sharing / Find My).
  locationVerified?: {
    at?: string
    by?: { username: string } | string
    note?: string
  }
  apps?: AppState[]
  monthCheck?: 'submitted' | 'verified' | null
  // Handed over this month: the handover check covers it, the first monthly check is next month's.
  newThisMonth?: boolean
  checkOverdue?: boolean
  createdAt: string
}
export const deviceName = (d: { brand?: string; model?: string; code?: string }) => [d.brand, d.model].filter(Boolean).join(' ') || d.code || ''

export interface CheckInput {
  grade?: Grade
  parts: Record<string, PartState>
  storageTotalGb?: number | string
  storageFreeGb?: number | string
  batteryHealth?: number | string
  security: Record<string, boolean>
  location?: Record<string, boolean>
  genuine?: Record<string, GenuineState>
  apps: AppState[]
  galleryBackedUp?: boolean
  remarks?: string
}

export interface DeviceCheck {
  _id: string
  device: { _id: string; code: string; kind: DeviceKind; brand?: string; model?: string } | string
  employee?: PersonRef | null
  kind: 'handover' | 'return' | 'monthly' | 'adhoc'
  status: 'submitted' | 'verified' | 'rejected'
  byHolder?: boolean
  by?: { username: string }
  reviewedBy?: { username: string }
  reviewNote?: string
  grade?: Grade
  parts?: Record<string, PartState>
  storageTotalGb?: number
  storageFreeGb?: number
  batteryHealth?: number
  security?: Record<string, boolean>
  location?: Record<string, boolean>
  genuine?: Record<string, GenuineState>
  apps?: AppState[]
  galleryBackedUp?: boolean
  photos?: string[]
  remarks?: string
  flags?: string[]
  month?: string
  createdAt: string
}

export interface Assignment {
  _id: string
  device: string
  employee: PersonRef
  status: 'active' | 'returned' | 'lost'
  assignedAt: string
  assignedBy?: { username: string }
  acceptedAt?: string
  accessories: { accessory: string; label: string; qty: number; returnedQty?: number }[]
  setupSteps: { key: string; label: string; doneAt?: string }[]
  signedAgreement?: string | null
  signedReceipt?: string | null
  returnedAt?: string
  returnedTo?: { username: string }
  returnNote?: string
  lostAt?: string
  recoveryAmount?: number
  recoverySettledIn?: string | null
  recoveryWaivedAt?: string
  recoveryNote?: string
}

export interface Issue {
  _id: string
  device: { _id: string; code: string; brand?: string; model?: string }
  employee?: PersonRef | null
  category: string
  description?: string
  status: 'open' | 'resolved'
  resolution?: string
  resolvedBy?: { username: string }
  resolvedAt?: string
  createdAt: string
}

export interface Account {
  _id: string
  kind: string
  label?: string
  identifier: string
  recoveryEmail?: string
  recoveryPhone?: string
  twoFactorOn?: boolean
  codesGoTo?: string
  devices: { _id: string; code: string; brand?: string; model?: string; status: DeviceStatus }[]
  employee?: PersonRef | null
  notes?: string
  hasPassword?: boolean
  hasPin?: boolean
  passwordChangedAt?: string
  passwordChangedBy?: { username: string }
}

export interface Accessory {
  _id: string
  name: string
  kind: string
  totalQty: number
  unitValue: number
  notes?: string
  out: number
  inStock: number
}

export interface RunbookStep {
  _id: string
  key: string
  label: string
  detail?: string
  done: boolean
  doneAt?: string
  doneBy?: { username: string }
  note?: string
  file?: string | null
}
export interface Runbook {
  _id: string
  kind: 'lost' | 'revoke'
  device?: { _id: string; code: string; brand?: string; model?: string } | null
  employee?: PersonRef | null
  reason?: string
  status: 'open' | 'closed'
  steps: RunbookStep[]
  startedBy?: { username: string }
  createdAt: string
  closedAt?: string
}

export interface Footage {
  _id: string
  device?: { _id: string; code: string; brand?: string; model?: string } | null
  // Who logged it, and who uploaded it (a colleague, or themselves).
  employee?: PersonRef | null
  uploadedBy?: PersonRef | null
  // createdAt is when it was logged; the shoot's own date is optional.
  createdAt: string
  shootDate?: string | null
  driveAccount?: { _id: string; label?: string; identifier: string } | null
  driveName?: string
  verifiedAt?: string | null
  verifiedBy?: { username: string } | null
  client?: { name: string } | null
  clientName?: string
  driveLink: string
  files?: number
  sizeGb?: number
  clearedFromPhone?: boolean
  note?: string
}

export interface AccessTemplate {
  designation: string
  deviceType: string
  items: { key?: string; kind: string; label: string; detail?: string }[]
}
export interface Settings {
  apps: { key: string; label: string; required: boolean }[]
  brand: { whatsappName?: string; bio?: string; website?: string; address?: string; logo?: string | null; brochure?: string | null }
  accessTemplates: AccessTemplate[]
  checkDueDay: number
  lowStoragePct: number
  lowBatteryPct: number
  // The company Google account every phone shares its location with.
  locationAccount?: string
}

export interface Summary {
  counts: Record<DeviceStatus, number>
  total: number
  kinds: Record<string, { total: number; available: number; assigned: number }>
  accessories: Accessory[]
  checksToVerify: number
  checksOverdue: number
  openIssues: number
  openRunbooks: number
  flagged: number
  footageToVerify: number
}

export interface AccessItem {
  _id: string
  key: string
  deviceType: string
  kind: string
  label: string
  detail?: string
  fromTemplate: boolean
  status: 'pending' | 'done' | 'na' | 'revoked'
  doneAt?: string
  note?: string
}
export interface EmployeeAccess {
  employee: { _id: string; name: string; designation?: string; status: string; companyEmail: string | null }
  items: AccessItem[]
  devices: { _id: string; code: string; kind: DeviceKind; brand?: string; model?: string }[]
  accounts: { _id: string; kind: string; identifier: string }[]
  runbooks: Runbook[]
}

export interface DeviceDetail {
  device: Device
  assignments: Assignment[]
  checks: DeviceCheck[]
  issues: Issue[]
  accounts: Account[]
  runbooks: Runbook[]
  footage: Footage[]
  apps: Settings['apps']
}

// A form with a photo or two: the fields go as JSON beside the files.
function withPhotos(data: unknown, photos: File[] = []) {
  const form = new FormData()
  form.append('data', JSON.stringify(data))
  for (const p of photos) form.append('photos', p)
  return form
}

export const devicesApi = {
  summary: async () => (await apiClient.get<Summary>('/devices/summary')).data,
  list: async (params: { status?: string; kind?: string; q?: string } = {}) => (await apiClient.get<{ devices: Device[] }>('/devices', { params })).data.devices,
  detail: async (id: string) => (await apiClient.get<DeviceDetail>(`/devices/${id}`)).data,
  create: async (input: Partial<Device>) => (await apiClient.post<{ device: Device }>('/devices', input)).data.device,
  update: async (id: string, input: Partial<Device>) => (await apiClient.patch<{ device: Device }>(`/devices/${id}`, input)).data.device,
  assign: async (id: string, input: { employeeId: string; accessories: { accessory: string; qty: number }[]; check: CheckInput }, photos?: File[]) =>
    (await apiClient.post(`/devices/${id}/assign`, withPhotos(input, photos))).data,
  returnDevice: async (id: string, input: { check: CheckInput; accessoriesReturned: { accessory: string; qty: number }[]; note?: string; toRepair?: boolean }, photos?: File[]) =>
    (await apiClient.post(`/devices/${id}/return`, withPhotos(input, photos))).data,
  lost: async (id: string, note: string) => (await apiClient.post(`/devices/${id}/lost`, { note })).data,
  found: async (id: string) => (await apiClient.post(`/devices/${id}/found`, {})).data,
  repair: async (id: string, done: boolean) => (await apiClient.post(`/devices/${id}/repair`, { done })).data,
  retire: async (id: string) => (await apiClient.post(`/devices/${id}/retire`, {})).data,
  remove: async (id: string) => (await apiClient.delete(`/devices/${id}`)).data,
  check: async (id: string, input: CheckInput, photos?: File[]) => (await apiClient.post(`/devices/${id}/checks`, withPhotos(input, photos))).data,
  reportIssue: async (id: string, input: { category: string; description?: string }) => (await apiClient.post(`/devices/${id}/issues`, input)).data,

  document: async (assignmentId: string, which: 'agreement' | 'receipt') =>
    (await apiClient.get(`/devices/assignments/${assignmentId}/${which}`, { responseType: 'blob' })).data as Blob,
  uploadSigned: async (assignmentId: string, which: 'agreement' | 'receipt', file: File) => {
    const form = new FormData()
    form.append('file', file)
    return (await apiClient.post(`/devices/assignments/${assignmentId}/signed/${which}`, form)).data
  },
  setStep: async (assignmentId: string, key: string, done: boolean) => (await apiClient.post(`/devices/assignments/${assignmentId}/steps/${key}`, { done })).data,
  waive: async (assignmentId: string, note: string) => (await apiClient.post(`/devices/assignments/${assignmentId}/waive`, { note })).data,
  file: async (id: string) => (await apiClient.get(`/devices/files/${id}`, { responseType: 'blob' })).data as Blob,

  checks: async (params: { status?: string; device?: string } = {}) => (await apiClient.get<{ checks: DeviceCheck[] }>('/devices/checks', { params })).data.checks,
  reviewCheck: async (id: string, ok: boolean, note?: string, locationSeen?: boolean) =>
    (await apiClient.post(`/devices/checks/${id}/review`, { ok, note, locationSeen })).data,
  verifyLocation: async (id: string, note?: string) => (await apiClient.post(`/devices/${id}/location-verified`, { note })).data,
  issues: async (status?: string) => (await apiClient.get<{ issues: Issue[] }>('/devices/issues', { params: { status } })).data.issues,
  resolveIssue: async (id: string, resolution: string) => (await apiClient.post(`/devices/issues/${id}/resolve`, { resolution })).data,

  accessories: async () => (await apiClient.get<{ accessories: Accessory[] }>('/devices/accessories')).data.accessories,
  createAccessory: async (input: Partial<Accessory>) => (await apiClient.post('/devices/accessories', input)).data,
  updateAccessory: async (id: string, input: Partial<Accessory>) => (await apiClient.patch(`/devices/accessories/${id}`, input)).data,

  accounts: async () => (await apiClient.get<{ accounts: Account[] }>('/devices/accounts')).data.accounts,
  createAccount: async (input: Record<string, unknown>) => (await apiClient.post('/devices/accounts', input)).data,
  updateAccount: async (id: string, input: Record<string, unknown>) => (await apiClient.patch(`/devices/accounts/${id}`, input)).data,
  deleteAccount: async (id: string) => (await apiClient.delete(`/devices/accounts/${id}`)).data,
  reveal: async (id: string) => (await apiClient.post<{ password: string | null; pin: string | null }>(`/devices/accounts/${id}/reveal`, {})).data,

  settings: async () => (await apiClient.get<{ settings: Settings }>('/devices/settings')).data.settings,
  saveSettings: async (input: Partial<Settings>) => (await apiClient.put<{ settings: Settings }>('/devices/settings', input)).data.settings,
  brandFile: async (which: 'logo' | 'brochure', file: File) => {
    const form = new FormData()
    form.append('file', file)
    return (await apiClient.post(`/devices/settings/brand/${which}`, form)).data
  },

  access: async (employeeId: string) => (await apiClient.get<EmployeeAccess>(`/devices/access/${employeeId}`)).data,
  addAccessItem: async (employeeId: string, input: { deviceType: string; kind: string; label: string; detail?: string }) =>
    (await apiClient.post<EmployeeAccess>(`/devices/access/${employeeId}/items`, input)).data,
  setAccessItem: async (employeeId: string, itemId: string, input: { status?: string; note?: string }) =>
    (await apiClient.patch<EmployeeAccess>(`/devices/access/${employeeId}/items/${itemId}`, input)).data,
  removeAccessItem: async (employeeId: string, itemId: string) => (await apiClient.delete<EmployeeAccess>(`/devices/access/${employeeId}/items/${itemId}`)).data,
  revoke: async (employeeId: string, reason: string) => (await apiClient.post<{ runbook: Runbook }>(`/devices/access/${employeeId}/revoke`, { reason })).data,

  runbooks: async (status?: string) => (await apiClient.get<{ runbooks: Runbook[] }>('/devices/runbooks', { params: { status } })).data.runbooks,
  tickStep: async (runbookId: string, stepId: string, input: { done?: boolean; note?: string }, file?: File) => {
    const form = new FormData()
    if (input.done !== undefined) form.append('done', String(input.done))
    if (input.note !== undefined) form.append('note', input.note)
    if (file) form.append('file', file)
    return (await apiClient.post(`/devices/runbooks/${runbookId}/steps/${stepId}`, form)).data
  },

  footage: async (toVerify?: boolean) => (await apiClient.get<{ uploads: Footage[] }>('/devices/footage', { params: toVerify ? { toVerify: true } : {} })).data.uploads,
  verifyFootage: async (id: string, verified: boolean) => (await apiClient.post(`/devices/footage/${id}/verify`, { verified })).data,
  setFootageCleared: async (id: string, clearedFromPhone: boolean) => (await apiClient.patch(`/devices/footage/${id}`, { clearedFromPhone })).data,

  employees: async () =>
    (await apiClient.get<{ items: PersonRef[] }>('/employees', { params: { status: 'active', limit: 100 } })).data.items,
}

// Opens a file the API returns (PDF, photo) in a new tab.
export async function openBlob(load: () => Promise<Blob>) {
  const url = URL.createObjectURL(await load())
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export const apiMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
