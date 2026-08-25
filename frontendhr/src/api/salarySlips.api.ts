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

export async function generateBulkSalarySlips(input: {
  month: number
  year: number
}): Promise<{ results: BulkSlipResult[] }> {
  const { data } = await apiClient.post('/salary-slips/generate-bulk', input)
  return data
}

// Bundles the given slips' PDFs into one zip, streamed straight back as a
// blob — used right after a bulk-generate to auto-download everything
// generated in one action.
export async function downloadBulkSalarySlipZip(input: { slipIds: string[]; filename?: string }): Promise<Blob> {
  const { data } = await apiClient.post('/salary-slips/bulk-zip', input, { responseType: 'blob' })
  return data
}
