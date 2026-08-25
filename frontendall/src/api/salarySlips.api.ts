import { apiClient } from './client'

export interface RecentSalaryMonth {
  month: number
  year: number
  // `null` means HR hasn't generated an official slip covering this month
  // yet — the self-service dashboard never computes or stores one of its
  // own to fill the gap, it just says so.
  slip: {
    _id: string
    startDate: string
    endDate: string
    netPayable: number
  } | null
}

export async function listMyRecentSalaryMonths(employeeId: string): Promise<{ months: RecentSalaryMonth[] }> {
  const { data } = await apiClient.get(`/employees/${employeeId}/salary-slips/recent-months`)
  return data
}

export async function downloadMySalarySlip(employeeId: string, slipId: string): Promise<void> {
  const { data } = await apiClient.get(`/employees/${employeeId}/salary-slips/${slipId}/file`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(data as Blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `salary-slip-${slipId}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
