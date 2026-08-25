import { useQuery } from '@tanstack/react-query'
import * as documentsApi from '@/api/documents.api'

export function useActiveTemplates() {
  return useQuery({
    queryKey: ['document-templates-active'],
    queryFn: () => documentsApi.listActiveTemplates(),
  })
}

export function useDocumentsOverview(templateKey: string | undefined) {
  return useQuery({
    queryKey: ['documents-overview', templateKey],
    queryFn: () => documentsApi.getDocumentsOverview(templateKey as string),
    enabled: Boolean(templateKey),
  })
}
