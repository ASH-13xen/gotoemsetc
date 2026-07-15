import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as quotationsApi from '@/api/quotations.api'
import type { GenerateQuotationInput } from '@/api/quotations.api'

const QUOTATIONS_KEY = ['quotations']
const CLIENTS_KEY = ['clients']

export function useQuotations(clientId: string | undefined) {
  return useQuery({
    queryKey: [...QUOTATIONS_KEY, clientId],
    queryFn: () => quotationsApi.listQuotations(clientId as string),
    enabled: Boolean(clientId),
  })
}

export function useGenerateQuotation(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GenerateQuotationInput) => quotationsApi.generateQuotation(clientId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUOTATIONS_KEY, clientId] })
      queryClient.invalidateQueries({ queryKey: [...CLIENTS_KEY, clientId] })
    },
  })
}

export function useAdminSignQuotation(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ quotationId, signatureDataUrl }: { quotationId: string; signatureDataUrl: string }) =>
      quotationsApi.adminSignQuotation(quotationId, signatureDataUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUOTATIONS_KEY, clientId] })
    },
  })
}

export function useRegenerateShareLink(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (quotationId: string) => quotationsApi.regenerateQuotationShareLink(quotationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUOTATIONS_KEY, clientId] })
    },
  })
}
