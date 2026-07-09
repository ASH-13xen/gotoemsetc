import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as applicantsApi from '@/api/applicants.api'
import type { CreateApplicantInput, ListApplicantsParams } from '@/api/applicants.api'

const APPLICANTS_KEY = ['applicants']

export function useApplicants(params: ListApplicantsParams) {
  return useQuery({
    queryKey: [...APPLICANTS_KEY, params],
    queryFn: () => applicantsApi.listApplicants(params),
    placeholderData: (prev) => prev,
  })
}

export function useApplicant(id: string | undefined) {
  return useQuery({
    queryKey: [...APPLICANTS_KEY, id],
    queryFn: () => applicantsApi.getApplicant(id as string),
    enabled: Boolean(id),
    // The schedule/reschedule email + WhatsApp sends resolve in the
    // background after the request returns — poll briefly while either
    // channel is still `pending` so the status badges update live instead
    // of needing a manual refresh.
    refetchInterval: (query) => {
      const interview = query.state.data?.activeInterview
      const stillPending = interview?.email?.status === 'pending' || interview?.whatsapp?.status === 'pending'
      return stillPending ? 2500 : false
    },
  })
}

export function useCreateApplicant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateApplicantInput) => applicantsApi.createApplicant(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPLICANTS_KEY }),
  })
}

export function useHireApplicant(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      selectionNotes,
      decisionDate,
      startDate,
    }: {
      selectionNotes: string
      decisionDate: string
      startDate: string
    }) => applicantsApi.hireApplicant(id, selectionNotes, decisionDate, startDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPLICANTS_KEY })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useRejectApplicant(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ rejectionReason, decisionDate }: { rejectionReason: string; decisionDate: string }) =>
      applicantsApi.rejectApplicant(id, rejectionReason, decisionDate),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPLICANTS_KEY }),
  })
}

export function useDeleteApplicant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => applicantsApi.deleteApplicant(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPLICANTS_KEY }),
  })
}

export function useScheduleInterview(applicantId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ scheduledAt, notes }: { scheduledAt: string; notes?: string }) =>
      applicantsApi.scheduleInterview(applicantId, scheduledAt, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPLICANTS_KEY }),
  })
}

export function useCancelInterview(applicantId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (interviewId: string) => applicantsApi.cancelInterview(applicantId, interviewId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPLICANTS_KEY }),
  })
}
