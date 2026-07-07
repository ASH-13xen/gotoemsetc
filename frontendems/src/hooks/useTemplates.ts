import { useQuery } from '@tanstack/react-query'
import * as templatesApi from '@/api/templates.api'

export function useTemplates() {
  return useQuery({
    queryKey: ['templates', { active: true }],
    queryFn: () => templatesApi.listTemplates(true),
  })
}
