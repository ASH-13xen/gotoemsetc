import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/work.api'
import * as tickets from '@/api/tickets.api'

// Client work, time, shoots and the report. Every change refreshes these and
// the tickets (a shoot or a plan moves tickets; hours show on them).
const KEY = ['work']

export const useClientCards = (month: string) => useQuery({ queryKey: [...KEY, 'cards', month], queryFn: () => api.getClientCards(month) })
export const useClientMonth = (clientId: string | undefined, month: string) =>
  useQuery({ queryKey: [...KEY, 'month', clientId, month], queryFn: () => api.getClientMonth(clientId!, month), enabled: Boolean(clientId) })

export const useTimer = () => useQuery({ queryKey: [...KEY, 'timer'], queryFn: api.getTimer, refetchInterval: 60_000 })
export const useTimeDay = (date: string, employee?: string) => useQuery({ queryKey: [...KEY, 'day', date, employee], queryFn: () => api.getTimeDay({ date, employee }) })
export const useTimeTeam = (date: string, enabled = true) => useQuery({ queryKey: [...KEY, 'team', date], queryFn: () => api.getTimeTeam(date), enabled, retry: false })
export const useTicketTime = (id: string | undefined, enabled = true) =>
  useQuery({ queryKey: [...KEY, 'ticket-time', id], queryFn: () => api.getTicketTime(id!), enabled: Boolean(id) && enabled })

export const useShoots = (params: { from?: string; to?: string; status?: string } = {}) => useQuery({ queryKey: [...KEY, 'shoots', params], queryFn: () => api.listShoots(params) })

export const usePendingHours = () => useQuery({ queryKey: [...KEY, 'pending'], queryFn: tickets.getPendingHours, refetchInterval: 120_000 })

export const useValueReport = (month: string, enabled = true) => useQuery({ queryKey: [...KEY, 'value', month], queryFn: () => api.getValueReport(month), enabled, retry: false })

export function useWorkMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}
