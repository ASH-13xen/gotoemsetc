import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as tasksApi from '@/api/tasks.api'

export function useTasksForClient(clientId: string | undefined, cycleId?: string) {
  return useQuery({
    queryKey: ['tasks', clientId, cycleId],
    queryFn: () => tasksApi.listTasksForClient(clientId as string, cycleId),
    enabled: Boolean(clientId),
  })
}

export function useSyncClientCycle(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => tasksApi.syncClientCycle(clientId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', clientId] }),
  })
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => tasksApi.getTask(id as string),
    enabled: Boolean(id),
  })
}

function invalidateTask(queryClient: ReturnType<typeof useQueryClient>, clientId: string | undefined) {
  queryClient.invalidateQueries({ queryKey: ['task'] })
  queryClient.invalidateQueries({ queryKey: ['tasks', clientId] })
}

export function useUpdateTaskAssignment(taskId: string, clientId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof tasksApi.updateTaskAssignment>[1]) =>
      tasksApi.updateTaskAssignment(taskId, input),
    onSuccess: () => invalidateTask(queryClient, clientId),
  })
}

export function useUpdateStepAssignment(taskId: string, clientId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stepId, input }: { stepId: string; input: Parameters<typeof tasksApi.updateStepAssignment>[2] }) =>
      tasksApi.updateStepAssignment(taskId, stepId, input),
    onSuccess: () => invalidateTask(queryClient, clientId),
  })
}

export function useUpdateStepStatus(taskId: string, clientId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stepId, status }: { stepId: string; status: tasksApi.StepStatus }) =>
      tasksApi.updateStepStatus(taskId, stepId, status),
    onSuccess: () => invalidateTask(queryClient, clientId),
  })
}

export function useDecideStepApproval(taskId: string, clientId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stepId, approved }: { stepId: string; approved: boolean }) =>
      tasksApi.decideStepApproval(taskId, stepId, approved),
    onSuccess: () => invalidateTask(queryClient, clientId),
  })
}

export function useAddAttachment(taskId: string, clientId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ label, url }: { label: string; url: string }) => tasksApi.addAttachment(taskId, label, url),
    onSuccess: () => invalidateTask(queryClient, clientId),
  })
}

export function useRemoveAttachment(taskId: string, clientId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (index: number) => tasksApi.removeAttachment(taskId, index),
    onSuccess: () => invalidateTask(queryClient, clientId),
  })
}

export function useRolloverTask(clientId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.rolloverTask(taskId),
    onSuccess: () => invalidateTask(queryClient, clientId),
  })
}

export function useTaskMessages(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-messages', taskId],
    queryFn: () => tasksApi.listMessages(taskId as string),
    enabled: Boolean(taskId),
  })
}

export function usePostMessage(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => tasksApi.postMessage(taskId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-messages', taskId] }),
  })
}
