import { apiClient } from './client'

export interface AuditLogEntry {
  _id: string
  actor?: { userId: string; username: string; role: string }
  action: string
  resourceType: string
  resourceId?: string
  metadata?: unknown
  createdAt: string
}

export interface ListAuditLogParams {
  resourceType?: string
  actorUsername?: string
  page?: number
  limit?: number
}

export interface ListAuditLogResponse {
  items: AuditLogEntry[]
  total: number
  page: number
  limit: number
}

export async function listAuditLog(params: ListAuditLogParams): Promise<ListAuditLogResponse> {
  const { data } = await apiClient.get('/audit-log', { params })
  return data
}
