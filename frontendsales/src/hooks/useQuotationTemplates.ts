import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as templatesApi from '@/api/quotationTemplates.api'
import type { QuotationTemplateFields, ScopeOfWorkSection } from '@/api/quotationTemplates.api'

const TEMPLATES_KEY = ['quotationTemplates']

export function useQuotationTemplates() {
  return useQuery({ queryKey: TEMPLATES_KEY, queryFn: templatesApi.listQuotationTemplates })
}

export function useQuotationTemplate(id: string | undefined) {
  return useQuery({
    queryKey: [...TEMPLATES_KEY, id],
    queryFn: () => templatesApi.getQuotationTemplate(id as string),
    enabled: Boolean(id),
  })
}

export function useUpdateQuotationTemplateFields(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fields: QuotationTemplateFields) => templatesApi.updateQuotationTemplateFields(id, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...TEMPLATES_KEY, id] })
      queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY })
    },
  })
}

export function useUpdateScopeOfWork(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (scopeOfWork: ScopeOfWorkSection[]) => templatesApi.updateScopeOfWork(id, scopeOfWork),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...TEMPLATES_KEY, id] })
      queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY })
    },
  })
}
