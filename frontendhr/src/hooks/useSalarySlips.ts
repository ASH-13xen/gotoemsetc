import { useMutation, useQuery } from '@tanstack/react-query'
import * as salarySlipsApi from '@/api/salarySlips.api'

export function useBulkSalarySlipPreview(input: { month: number; year: number }, enabled: boolean) {
  return useQuery({
    queryKey: ['salary-slips', 'bulk-preview', input.month, input.year],
    queryFn: () => salarySlipsApi.getBulkSalarySlipPreview(input),
    enabled,
    // Fetched fresh each time the dialog opens and never behind its back —
    // a refetch would reset the amounts being typed in.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })
}

export function useGenerateBulkSalarySlips() {
  return useMutation({
    mutationFn: (input: Parameters<typeof salarySlipsApi.generateBulkSalarySlips>[0]) =>
      salarySlipsApi.generateBulkSalarySlips(input),
  })
}

export function useDownloadMasterSalarySheet() {
  return useMutation({
    mutationFn: (input: { month: number; year: number }) => salarySlipsApi.downloadMasterSalarySheet(input),
  })
}

export function useDownloadBulkSalarySlipZip() {
  return useMutation({
    mutationFn: (input: Parameters<typeof salarySlipsApi.downloadBulkSalarySlipZip>[0]) =>
      salarySlipsApi.downloadBulkSalarySlipZip(input),
  })
}
