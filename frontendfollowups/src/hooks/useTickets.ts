import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/tickets.api'

const KEY = ['tickets']

export const useTicketMeta = () => useQuery({ queryKey: [...KEY, 'meta'], queryFn: api.getMeta, staleTime: 60_000 })

export const useTickets = (scope: api.Scope, status?: string, q?: string, enabled = true) =>
  useQuery({ queryKey: [...KEY, 'list', scope, status, q], queryFn: () => api.listTickets({ scope, status, q }), enabled, refetchInterval: 60_000 })

export const useTicket = (id: string | undefined) =>
  useQuery({ queryKey: [...KEY, 'one', id], queryFn: () => api.getTicket(id!), enabled: Boolean(id) })

export const useTicketSummary = () => useQuery({ queryKey: [...KEY, 'summary'], queryFn: api.getSummary, refetchInterval: 60_000 })

export const useAnalysis = (params: Record<string, string | undefined>, enabled = true) =>
  useQuery({ queryKey: [...KEY, 'analysis', params], queryFn: () => api.getAnalysis(params), enabled })

export const useCalendarTickets = (scope: 'mine' | 'team' | 'all', status?: string, enabled = true) =>
  useQuery({ queryKey: [...KEY, 'calendar', scope, status], queryFn: () => api.listCalendarTickets({ scope, status }), enabled, refetchInterval: 60_000 })

export const useCalendarItem = (id: string | undefined) =>
  useQuery({ queryKey: [...KEY, 'calendar-item', id], queryFn: () => api.getCalendarItem(id!), enabled: Boolean(id) })

export const useStories = (id: string | undefined) =>
  useQuery({ queryKey: [...KEY, 'stories', id], queryFn: () => api.getStories(id!), enabled: Boolean(id) })

// Every change refreshes every ticket view — lists, counts and the open ticket.
export function useTicketMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
