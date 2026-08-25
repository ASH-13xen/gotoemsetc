import { apiClient } from './client'
import type { Availability, ExperienceLevel, Resume, WorkStyle } from './applicants.api'

export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'intern' | 'hybrid'
export type EmployeeStatus = 'draft' | 'active' | 'offboarded'

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

export interface Address {
  line1?: string
  line2?: string
  city?: string
  state?: string
  pincode?: string
  country?: string
}

export interface SalaryComponent {
  label: string
  monthlyAmount: number
}

export interface ExtraDetail {
  key: string
  value?: string
}

export type MobileOS = 'android' | 'ios' | ''

export interface Inventory {
  // Original fields — kept exactly as-is, the Hardware Consent Form's
  // Equipment Inventory section auto-fills from these by name.
  deviceName?: string
  imeiOrSerialNumber?: string
  deviceColor?: string
  simProvider?: string
  simPhoneNumber?: string
  screenGuard?: boolean
  backCover?: boolean
  powerAdapter?: boolean
  cable?: boolean

  // Mobile — only shown/relevant once hasMobile is checked.
  hasMobile?: boolean
  mobileOS?: MobileOS
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

  // Laptop — a separate set mirroring the mobile fields, since one employee
  // can be issued both at once. Distinct from the top-level Employee.hasLaptop
  // (carried over from the Applicant record at hire time).
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

  // General — apply once, regardless of which device(s) are checked above.
  consentFormLink?: string
  gotofriendLoggedIn?: boolean
  employeeMailLoggedIn?: boolean
  clientMailLoggedIn?: boolean
  goToDataTransfer?: boolean
  podcastDataTransfer?: boolean
}

export interface EmployeeFlag {
  _id: string
  color: 'red' | 'green'
  note?: string
  date: string
  addedBy?: string
}

export interface Employee {
  _id: string
  // The employee's one and only code — also the biometric device enrollment
  // PIN, admin-only to edit.
  employeeCode: string
  firstName: string
  lastName?: string
  personalEmail?: string
  phone?: string
  instagramId?: string
  permanentAddress?: Address
  localAddress?: Address
  dob?: string
  bloodGroup?: string
  gender?: string
  fatherName?: string
  designation: string
  department?: string
  dateOfJoining?: string
  dateOfHiring?: string
  employmentType: EmploymentType
  reportingManager?: string
  // Real relational link to another Employee — distinct from
  // reportingManager above (free text, used only on the Promotion Letter).
  // Source of truth for who can complete this employee's Personal tasks.
  manager?: { _id: string; firstName: string; lastName?: string; designation?: string } | string | null
  workLocation?: string
  // "HH:mm" 24h — drives the attendance classifier's arrival/departure
  // boundaries for this employee. Defaults to '09:30'/'18:30'.
  workingHoursStart?: string
  workingHoursEnd?: string
  ctcAnnual?: number
  monthlyPay?: number
  salaryComponents?: SalaryComponent[]
  bankAccountNumber?: string
  bankIFSC?: string
  bankName?: string
  payDate?: number
  panNumber?: string
  aadharNumber?: string
  extraDetails?: ExtraDetail[]
  inventory?: Inventory

  biometricVerificationAdded?: boolean
  companyLoginAdded?: boolean
  officePhoneAdded?: boolean
  personalPhoneAdded?: boolean
  assetAccessAdded?: boolean
  updatedIn12345?: boolean

  // Offboarding-only — meaningful once status is 'offboarded'.
  endDate?: string
  reasonForLeaving?: string
  removedFromGroupsAndReels?: boolean
  mailDeactivated?: boolean

  // Carried over from the application at hire time — present only on
  // employees created by hiring an applicant (sourceApplicant set).
  sourceApplicant?: string
  experienceLevel?: ExperienceLevel
  hasLaptop?: boolean
  willingToRelocate?: boolean
  availability?: Availability
  howDidYouFindUs?: string
  whyJoinCompany?: string
  workStylePreference?: WorkStyle
  whyHireYou?: string
  currentSalary?: string
  expectedSalary?: string
  resumes?: Resume[]
  selectionNotes?: string

  status: EmployeeStatus
  flags?: EmployeeFlag[]
  createdAt: string
  updatedAt: string
}

export interface ListEmployeesParams {
  search?: string
  status?: EmployeeStatus
  page?: number
  limit?: number
}

export interface ListEmployeesResponse {
  items: Employee[]
  total: number
  page: number
  limit: number
}

export type CreateEmployeeInput = Partial<Employee> &
  Pick<Employee, 'firstName' | 'designation'>

export type UpdateEmployeeInput = Partial<Employee>

export async function listEmployees(params: ListEmployeesParams): Promise<ListEmployeesResponse> {
  const { data } = await apiClient.get('/employees', { params })
  return data
}

export async function getEmployee(id: string): Promise<{ employee: Employee }> {
  const { data } = await apiClient.get(`/employees/${id}`)
  return data
}

export async function createEmployee(input: CreateEmployeeInput): Promise<{ employee: Employee }> {
  const { data } = await apiClient.post('/employees', input)
  return data
}

export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput
): Promise<{ employee: Employee }> {
  const { data } = await apiClient.patch(`/employees/${id}`, input)
  return data
}

export async function deleteEmployee(id: string): Promise<void> {
  await apiClient.delete(`/employees/${id}`)
}

export async function addFlag(
  employeeId: string,
  input: { color: 'red' | 'green'; note: string; date?: string }
): Promise<{ employee: Employee }> {
  const { data } = await apiClient.post(`/employees/${employeeId}/flags`, input)
  return data
}

export async function removeFlag(employeeId: string, flagId: string): Promise<{ employee: Employee }> {
  const { data } = await apiClient.delete(`/employees/${employeeId}/flags/${flagId}`)
  return data
}

export interface EmployeeBirthday {
  _id: string
  firstName: string
  lastName?: string
  employeeCode: string
  dob: string
}

export async function listBirthdays(): Promise<{ employees: EmployeeBirthday[] }> {
  const { data } = await apiClient.get('/employees/birthdays')
  return data
}
