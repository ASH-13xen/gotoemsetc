import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { acknowledgeActions, getActionAcks, restoreActions } from '@/api/actionCentre.api'
import { useAuth } from '@/hooks/useAuth'

const KEY = ['action-acks']

// Everything this person acknowledged in the Action centre.
export function useActionAcks() {
  const { user } = useAuth()
  const { data, isSuccess } = useQuery({ queryKey: KEY, queryFn: getActionAcks, enabled: Boolean(user), staleTime: 30_000 })
  const acked = useMemo(() => new Set(data ?? []), [data])
  return { acked, loaded: isSuccess }
}

// Acknowledge (or bring back) at once on screen, then save.
function useAckChange(save: (keys: string[]) => Promise<void>, apply: (old: string[], keys: string[]) => string[], failed: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: save,
    onMutate: async (keys: string[]) => {
      await qc.cancelQueries({ queryKey: KEY })
      const before = qc.getQueryData<string[]>(KEY)
      qc.setQueryData<string[]>(KEY, (old) => apply(old ?? [], keys))
      return { before }
    },
    onError: (_err, _keys, ctx) => {
      qc.setQueryData(KEY, ctx?.before)
      toast.error(failed)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export const useAcknowledgeAction = () =>
  useAckChange(acknowledgeActions, (old, keys) => [...new Set([...old, ...keys])], 'Could not acknowledge it')

export const useRestoreAction = () =>
  useAckChange(restoreActions, (old, keys) => old.filter((k) => !keys.includes(k)), 'Could not bring it back')
