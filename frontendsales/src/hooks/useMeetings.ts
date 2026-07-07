import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as meetingsApi from '@/api/meetings.api'
import type { CreateMeetingInput } from '@/api/meetings.api'

export function useMeetings(clientId: string | undefined) {
  return useQuery({
    queryKey: ['meetings', clientId],
    queryFn: () => meetingsApi.listMeetings(clientId as string),
    enabled: Boolean(clientId),
  })
}

export function useCreateMeeting(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMeetingInput) => meetingsApi.createMeeting(clientId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings', clientId] }),
  })
}
