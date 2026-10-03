import { apiClient } from './client'

export interface SalarySlip {
  _id: string
  employee: string
  startDate: string
  endDate: string
  basicMaster: number
  basicEarnings: number
  otMaster: number
  otEarnings: number
  halfDayDeductions: number
  unpaidOffDeductions: number
  grossEarnings: number
  totalDeductions: number
  totalReimbursements: number
  netPayable: number
  netPayableWords?: string
  createdAt: string
}

export interface GenerateSalarySlipInput {
  startDate: string
  endDate: string
  incomeTaxDeduction?: number
  professionTax?: number
  pf?: number
  otherDeduction3?: number
  compensationOff?: number
  incentives?: number
  travelAllowance?: number
  otherEarning1?: number
  reimbursement1?: number
  reimbursement2?: number
}

export async function generateSalarySlip(
  employeeId: string,
  input: GenerateSalarySlipInput
): Promise<{ slip: SalarySlip }> {
  const { data } = await apiClient.post(`/employees/${employeeId}/salary-slips/generate`, input)
  return data
}

export async function listSalarySlips(employeeId: string): Promise<{ slips: SalarySlip[] }> {
  const { data } = await apiClient.get(`/employees/${employeeId}/salary-slips`)
  return data
}

// The download route is admin-gated (needs the Bearer token), so a plain
// <a href> can't be used — fetch it as a blob through the authenticated
// axios instance and trigger the browser download manually.
export async function downloadSalarySlip(slipId: string, filename: string): Promise<void> {
  const { data } = await apiClient.get(`/salary-slips/${slipId}/file`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

// Nested-under-employee equivalent of downloadSalarySlip above — same file,
// but through the self-or-permission route (GET
// /employees/:id/salary-slips/:slipId/file) instead of the flat admin-only
// one, so this also works when the viewer is looking at their own record
// without holding view_salary_slip themselves.
export async function downloadEmployeeSalarySlip(
  employeeId: string,
  slipId: string,
  filename: string
): Promise<void> {
  const { data } = await apiClient.get(`/employees/${employeeId}/salary-slips/${slipId}/file`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
