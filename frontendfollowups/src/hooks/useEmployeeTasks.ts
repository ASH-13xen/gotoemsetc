import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/employeeTasks.api'
import type {
  AdminTaskFilter,
  CreateContinuationInput,
  CreateSubtaskInput,
  CreateTaskInput,
  EmployeeTaskType,
  FollowUpInput,
  RejectTaskInput,
  UpdateTaskInput,
} from '@/api/employeeTasks.api'

const TASKS_KEY = ['employee-tasks']

// No type filter — the task list page shows every type in one page, split
// into sections client-side, with filter chips toggling which sections show.
export function useMyTasks(type?: EmployeeTaskType) {
  return useQuery({ queryKey: [...TASKS_KEY, 'mine', type], queryFn: () => api.listMyTasks(type) })
}

export function useUpcomingTasks() {
  return useQuery({ queryKey: [...TASKS_KEY, 'upcoming'], queryFn: () => api.listUpcomingTasks() })
}

export function useReviewTasks() {
  return useQuery({ queryKey: [...TASKS_KEY, 'review'], queryFn: () => api.listReviewTasks() })
}

export function useAdminFilteredTasks(filter: AdminTaskFilter) {
  const active = Boolean(filter.clientId || filter.teamId || filter.employeeId || filter.dateFrom || filter.dateTo)
  return useQuery({
    queryKey: [...TASKS_KEY, 'admin-filter', filter.clientId, filter.teamId, filter.employeeId, filter.dateFrom, filter.dateTo],
    queryFn: () => api.listAdminFilteredTasks(filter),
    enabled: active,
  })
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: [...TASKS_KEY, id],
    queryFn: () => api.getTask(id as string),
    enabled: Boolean(id),
  })
}

export function useSubtasks(id: string | undefined) {
  return useQuery({
    queryKey: [...TASKS_KEY, id, 'subtasks'],
    queryFn: () => api.listSubtasks(id as string),
    enabled: Boolean(id),
  })
}

export function useTaskChain(id: string | undefined) {
  return useQuery({
    queryKey: [...TASKS_KEY, id, 'chain'],
    queryFn: () => api.getChain(id as string),
    enabled: Boolean(id),
  })
}

function useInvalidateTasks() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: TASKS_KEY })
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.createTask(input),
    onSuccess: invalidate,
  })
}

export function useUpdateTask(id: string) {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => api.updateTask(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: invalidate,
  })
}

export function useCreateSubtask(id: string) {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: CreateSubtaskInput) => api.createSubtask(id, input),
    onSuccess: invalidate,
  })
}

export function useAddFollowUp(id: string) {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: FollowUpInput) => api.addFollowUp(id, input),
    onSuccess: invalidate,
  })
}

export function useToggleFollowUp(id: string) {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({ followUpId, isDone }: { followUpId: string; isDone: boolean }) =>
      api.toggleFollowUp(id, followUpId, isDone),
    onSuccess: invalidate,
  })
}

export function useMarkForReview(id: string) {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: () => api.markForReview(id),
    onSuccess: invalidate,
  })
}

export function useMarkCompleted(id: string) {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: () => api.markCompleted(id),
    onSuccess: invalidate,
  })
}

export function useMarkCompletedDirect(id: string) {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: () => api.markCompletedDirect(id),
    onSuccess: invalidate,
  })
}

export function useRejectTask(id: string) {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: RejectTaskInput) => api.rejectTask(id, input),
    onSuccess: invalidate,
  })
}

export function useCreateContinuation(id: string) {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: CreateContinuationInput) => api.createContinuation(id, input),
    onSuccess: invalidate,
  })
}

// MOM-pipeline actions — only meaningful on a task carrying momPipeline
// (spawned from a meeting's MOM). Per-step authorisation happens server
// side; momPipelineView.canAct (from useTask) is what drives whether these
// buttons show at all.
export function useMomPipelineAdvance(id: string) {
  const invalidate = useInvalidateTasks()
  return useMutation({ mutationFn: () => api.momPipelineAdvance(id), onSuccess: invalidate })
}

export function useMomPipelineSendBack(id: string) {
  const invalidate = useInvalidateTasks()
  return useMutation({ mutationFn: () => api.momPipelineSendBack(id), onSuccess: invalidate })
}

export function useMomPipelineReject(id: string) {
  const invalidate = useInvalidateTasks()
  return useMutation({ mutationFn: (reason: string) => api.momPipelineReject(id, reason), onSuccess: invalidate })
}
