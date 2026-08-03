import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as taskClientsApi from '@/api/taskClients.api'
import type { TaskClientInput } from '@/api/taskClients.api'

const KEY = ['task-clients']

export function useTaskClients() {
  return useQuery({ queryKey: KEY, queryFn: () => taskClientsApi.listTaskClients() })
}

export function useCreateTaskClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskClientInput) => taskClientsApi.createTaskClient(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateTaskClient(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskClientInput) => taskClientsApi.updateTaskClient(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteTaskClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => taskClientsApi.deleteTaskClient(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUploadTaskClientLogo(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => taskClientsApi.uploadTaskClientLogo(id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
