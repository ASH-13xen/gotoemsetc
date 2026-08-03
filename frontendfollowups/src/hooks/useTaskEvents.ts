import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as taskEventsApi from '@/api/taskEvents.api'
import type { TaskEventInput } from '@/api/taskEvents.api'

const KEY = ['task-events']

export function useTaskEvents() {
  return useQuery({ queryKey: KEY, queryFn: () => taskEventsApi.listTaskEvents() })
}

export function useCreateTaskEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskEventInput) => taskEventsApi.createTaskEvent(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateTaskEvent(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<TaskEventInput>) => taskEventsApi.updateTaskEvent(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteTaskEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => taskEventsApi.deleteTaskEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
