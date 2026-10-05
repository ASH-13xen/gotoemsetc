import { apiClient } from './client'

export type BulkSlipOutcome = 'generated' | 'skipped' | 'failed'

export interface BulkSlipResult {
  employeeId: string
  employeeName: string
  employeeCode: string
  outcome: BulkSlipOutcome
  slipId?: string
  netPayable?: number
  message?: string
}

// The amounts HR types in on a slip — everything else is calculated.
export const MANUAL_AMOUNT_FIELDS = [
  { key: 'otherEarning1', label: 'Other Earning', group: 'earning' },
  { key: 'incentives', label: 'Incentives', group: 'earning' },
  { key: 'travelAllowance', label: 'Travel Allowance', group: 'earning' },
  { key: 'compensationOff', label: 'Compensation Off', group: 'earning' },
  { key: 'reimbursement1', label: 'Reimbursement 1', group: 'earning' },
  { key: 'reimbursement2', label: 'Reimbursement 2', group: 'earning' },
  { key: 'otherDeduction3', label: 'Other Deduction 3', group: 'deduction' },
  { key: 'incomeTaxDeduction', label: 'Income Tax Deduction', group: 'deduction' },
  { key: 'professionTax', label: 'Profession Tax', group: 'deduction' },
  { key: 'pf', label: 'P.F.', group: 'deduction' },
] as const

export type ManualAmountKey = (typeof MANUAL_AMOUNT_FIELDS)[number]['key']
export type ManualAmounts = Partial<Record<ManualAmountKey, number>>

// One person a bulk run for the month would produce a slip for.
export interface BulkCandidate {
  _id: string
  name: string
  employeeCode: string
  designation: string
  monthlyPay: number
  // Their own slip — the person generating can't produce it.
  skipped: boolean
  // A slip for this month already exists; `previous` is what was typed in on it.
  hasSlip: boolean
  previous: ManualAmounts
  notes: string[]
}

export interface BulkSlipPreview {
  employees: BulkCandidate[]
  // Overtime requests for the month nobody has decided yet — unapproved
  // overtime isn't paid, so it's flagged before generating.
  pendingOvertime: number
}

export async function getBulkSalarySlipPreview(input: { month: number; year: number }): Promise<BulkSlipPreview> {
  const { data } = await apiClient.get<BulkSlipPreview>('/salary-slips/bulk-preview', { params: input })
  return { employees: data.employees, pendingOvertime: data.pendingOvertime ?? 0 }
}

export async function generateBulkSalarySlips(input: {
  month: number
  year: number
  // Per-employee amounts entered before generating, keyed by employee id.
  adjustments?: Record<string, ManualAmounts>
}): Promise<{ results: BulkSlipResult[] }> {
  const { data } = await apiClient.post('/salary-slips/generate-bulk', input)
  return data
}

// Master Salary Sheet — one PDF for every active employee for a calendar
// month (current salary, attendance, overtime, net payable).
export async function downloadMasterSalarySheet(input: { month: number; year: number }): Promise<Blob> {
  const { data } = await apiClient.get('/salary-slips/master-sheet', { params: input, responseType: 'blob' })
  return data
}

// Bundles the given slips' PDFs into one zip, streamed straight back as a
// blob — used right after a bulk-generate to auto-download everything
// generated in one action. With `month` and `year` the zip also carries
// that month's Master Salary Sheet.
export async function downloadBulkSalarySlipZip(input: {
  slipIds: string[]
  filename?: string
  month?: number
  year?: number
}): Promise<Blob> {
  const { data } = await apiClient.post('/salary-slips/bulk-zip', input, { responseType: 'blob' })
  return data
}
