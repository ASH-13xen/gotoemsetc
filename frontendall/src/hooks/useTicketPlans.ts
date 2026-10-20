import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as api from '@/api/ticketPlans.api'
import type { TicketPlan } from '@/api/ticketPlans.api'
import { addDays, apiError } from '@/components/weeklyCalendar/calendarUtils'

const TRAY = ['ticket-tray']
const PLANS = ['ticket-plans']

// Everything waiting on you, for the Weekly Calendar's tray.
export const useTicketTray = (enabled: boolean) =>
  useQuery({ queryKey: TRAY, queryFn: api.listTray, enabled, refetchInterval: 60_000, staleTime: 20_000 })

// Your planned ticket work in one week (Monday to Sunday).
export const useTicketPlans = (weekStart: string, enabled: boolean) =>
  useQuery({ queryKey: [...PLANS, weekStart], queryFn: () => api.listPlans(weekStart, addDays(weekStart, 6)), enabled })

// Every change shows at once, then the server catches up.
function usePlanChange<TArgs>(save: (args: TArgs) => Promise<unknown>, apply: (plans: TicketPlan[], args: TArgs) => TicketPlan[], failed: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: save,
    onMutate: async (args: TArgs) => {
      await qc.cancelQueries({ queryKey: PLANS })
      const before = qc.getQueriesData<TicketPlan[]>({ queryKey: PLANS })
      before.forEach(([key, plans]) => plans && qc.setQueryData(key, apply(plans, args)))
      return { before }
    },
    onError: (err, _args, ctx) => {
      ctx?.before.forEach(([key, plans]) => qc.setQueryData(key, plans))
      toast.error(apiError(err, failed))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: PLANS }),
  })
}

export const useCreatePlan = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createPlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: PLANS }),
  })
}

export const useUpdatePlan = () =>
  usePlanChange(
    ({ id, ...change }: { id: string; day: string; startMin: number; endMin: number }) => api.updatePlan(id, change),
    // A move to another week leaves this one at once.
    (plans, { id, ...change }) => plans.map((p) => (p._id === id ? { ...p, ...change } : p)),
    'Could not move it'
  )

export const useDeletePlan = () =>
  usePlanChange((id: string) => api.deletePlan(id), (plans, id) => plans.filter((p) => p._id !== id), 'Could not remove it')

export const useMarkStep = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.markStep,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRAY })
      qc.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}
