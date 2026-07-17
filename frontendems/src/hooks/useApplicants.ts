import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as applicantsApi from '@/api/applicants.api'
import type { CreateApplicantInput, ListApplicantsParams, ScheduleInterviewInput } from '@/api/applicants.api'

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
      hiredPosition,
    }: {
      selectionNotes: string
      decisionDate: string
      startDate: string
      hiredPosition?: string
    }) => applicantsApi.hireApplicant(id, selectionNotes, decisionDate, startDate, hiredPosition),
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
    mutationFn: (input: ScheduleInterviewInput) => applicantsApi.scheduleInterview(applicantId, input),
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
