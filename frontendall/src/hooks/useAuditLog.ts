import { useQuery } from '@tanstack/react-query'
import { listAuditLog, type ListAuditLogParams } from '@/api/auditLog.api'

export function useAuditLog(params: ListAuditLogParams) {
  return useQuery({
    queryKey: ['audit-log', params],
    queryFn: () => listAuditLog(params),
    placeholderData: (prev) => prev,
  })
}
