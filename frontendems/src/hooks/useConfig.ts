import { useQuery } from '@tanstack/react-query'
import * as configApi from '@/api/config.api'

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: configApi.getConfig,
    staleTime: Infinity,
  })
}
