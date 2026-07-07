import { apiClient } from './client'

export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'intern'
export type EmployeeStatus = 'draft' | 'active' | 'offboarded'

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
  firstName: string
  lastName?: string
  personalEmail?: string
  phone?: string
  address?: Address
  dob?: string
  gender?: string
  fatherName?: string
  designation: string
  department?: string
  dateOfJoining?: string
  employmentType: EmploymentType
  reportingManager?: string
  workLocation?: string
  ctcAnnual?: number
  monthlyPay?: number
  salaryComponents?: SalaryComponent[]
  bankAccountNumber?: string
  bankIFSC?: string
  panNumber?: string
  aadharNumber?: string
  extraDetails?: ExtraDetail[]
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
