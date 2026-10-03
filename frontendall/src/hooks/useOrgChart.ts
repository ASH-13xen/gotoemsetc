import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as orgChartApi from '@/api/orgChart.api'

const KEY = ['org-chart']

export function useOrgChart(enabled = true) {
  return useQuery({ queryKey: KEY, queryFn: orgChartApi.getOrgChart, enabled })
}

// Every write refetches the whole chart (it's small) — and the work teams,
// since team-role changes are mirrored onto them server-side.
function useOrgMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY })
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

export function useCreateOrgNode() {
  return useOrgMutation((input: orgChartApi.CreateOrgNodeInput) => orgChartApi.createOrgNode(input))
}

export function useUpdateOrgNode() {
  return useOrgMutation(({ id, ...input }: { id: string } & Parameters<typeof orgChartApi.updateOrgNode>[1]) =>
    orgChartApi.updateOrgNode(id, input)
  )
}

export function useMoveOrgNode() {
  return useOrgMutation(({ id, ...input }: { id: string; parent?: string; order?: number }) =>
    orgChartApi.moveOrgNode(id, input)
  )
}

export function useSetOrgNodeAssignees() {
  return useOrgMutation(({ id, employeeIds }: { id: string; employeeIds: string[] }) =>
    orgChartApi.setOrgNodeAssignees(id, employeeIds)
  )
}

export function useDeleteOrgNode() {
  return useOrgMutation(({ id, mode }: { id: string; mode: 'lift' | 'branch' }) => orgChartApi.deleteOrgNode(id, mode))
}
