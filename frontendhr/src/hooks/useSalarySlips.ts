import { useMutation } from '@tanstack/react-query'
import * as salarySlipsApi from '@/api/salarySlips.api'

export function useGenerateBulkSalarySlips() {
  return useMutation({
    mutationFn: (input: { month: number; year: number }) => salarySlipsApi.generateBulkSalarySlips(input),
  })
}

export function useDownloadBulkSalarySlipZip() {
  return useMutation({
    mutationFn: (input: { slipIds: string[]; filename?: string }) => salarySlipsApi.downloadBulkSalarySlipZip(input),
  })
}
