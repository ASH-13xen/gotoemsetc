import { apiClient } from './client'
import type { Availability, ExperienceLevel, Resume, WorkStyle } from './applicants.api'

export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'intern'
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

export interface Employee {
  _id: string
  employeeCode: string
  // Biometric device enrollment PIN — admin-only, set manually.
  ecoId?: string
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
  workLocation?: string
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

  biometricVerificationAdded?: boolean
  companyLoginAdded?: boolean
  officePhoneAdded?: boolean
  personalPhoneAdded?: boolean

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
