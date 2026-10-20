import { toast } from 'sonner'
import { Check, UserMinus, UserPlus } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { apiClient } from '@/api/client'
import { cn } from '@/lib/utils'
import { useAckScope } from '@/components/layout/ActionAck'

// Whenever someone is onboarded or offboarded, the CEO and admin see it here
// until they acknowledge it. Only they are sent these, so for everyone else
// this shows nothing.

interface PeopleAlert {
  _id: string
  type: 'employee_onboarded' | 'employee_offboarded'
  title: string
  message: string
  createdAt: string
}

const KEY = ['people-alerts']

export function PeopleChangeAlerts() {
  const queryClient = useQueryClient()
  const { data: alerts = [] } = useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiClient.get<{ notifications: PeopleAlert[] }>('/notifications/alerts')).data.notifications,
    refetchInterval: 60_000,
  })
  const dismiss = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => apiClient.patch(`/notifications/${id}/read`)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: () => toast.error('Could not acknowledge'),
  })
  const { notices } = useAckScope()

  if (!notices || alerts.length === 0) return null

  return (
    <div className="dashboard-card grid gap-2">
      {alerts.map((a) => {
        const joined = a.type === 'employee_onboarded'
        return (
          <div
            key={a._id}
            role="alert"
            className={cn(
              'flex items-start gap-3 rounded-2xl border px-4 py-3',
              joined ? 'border-emerald-500/40 bg-emerald-500/[0.07]' : 'border-rose-500/40 bg-rose-500/[0.07]'
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl text-white',
                joined ? 'bg-emerald-600' : 'bg-rose-600'
              )}
            >
              {joined ? <UserPlus className="size-4" /> : <UserMinus className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {a.message} · {new Date(a.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={dismiss.isPending}
              onClick={() => dismiss.mutate([a._id])}
              className="h-8 shrink-0 gap-1 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <Check className="size-3.5" /> Acknowledge
            </Button>
          </div>
        )
      })}
      {alerts.length > 1 && (
        <Button size="sm" variant="ghost" className="justify-self-end" disabled={dismiss.isPending} onClick={() => dismiss.mutate(alerts.map((a) => a._id))}>
          Acknowledge all
        </Button>
      )}
    </div>
  )
}
