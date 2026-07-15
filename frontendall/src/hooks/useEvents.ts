import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as eventsApi from '@/api/events.api'
import type { EventFormInput, ResponsibilityFormInput, ResponsibilityStatus } from '@/api/events.api'

const EVENTS_KEY = ['events']
const MY_RESPONSIBILITIES_KEY = ['events', 'my-responsibilities']

export function useEvents() {
  return useQuery({ queryKey: EVENTS_KEY, queryFn: eventsApi.listEvents })
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: ['events', id],
    queryFn: () => eventsApi.getEvent(id as string),
    enabled: Boolean(id),
  })
}

export function useMyEventResponsibilities() {
  return useQuery({ queryKey: MY_RESPONSIBILITIES_KEY, queryFn: eventsApi.listMyResponsibilities })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EventFormInput) => eventsApi.createEvent(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EVENTS_KEY }),
  })
}

function invalidateEvent(queryClient: ReturnType<typeof useQueryClient>, eventId: string) {
  queryClient.invalidateQueries({ queryKey: EVENTS_KEY })
  queryClient.invalidateQueries({ queryKey: ['events', eventId] })
  queryClient.invalidateQueries({ queryKey: MY_RESPONSIBILITIES_KEY })
}

export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<EventFormInput>) => eventsApi.updateEvent(eventId, input),
    onSuccess: () => invalidateEvent(queryClient, eventId),
  })
}

export function useRescheduleEvent(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { newStartAt: string; newEndAt?: string; note?: string }) => eventsApi.rescheduleEvent(eventId, input),
    onSuccess: () => invalidateEvent(queryClient, eventId),
  })
}

export function useCompleteEvent(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => eventsApi.completeEvent(eventId),
    onSuccess: () => invalidateEvent(queryClient, eventId),
  })
}

export function useCancelEvent(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => eventsApi.cancelEvent(eventId),
    onSuccess: () => invalidateEvent(queryClient, eventId),
  })
}

export function useFillEventSummary(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { highlights?: string; improvements?: string }) => eventsApi.fillEventSummary(eventId, input),
    onSuccess: () => invalidateEvent(queryClient, eventId),
  })
}

export function useCreateResponsibility(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ResponsibilityFormInput) => eventsApi.createResponsibility(eventId, input),
    onSuccess: () => invalidateEvent(queryClient, eventId),
  })
}

export function useUpdateResponsibility(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ResponsibilityFormInput> }) => eventsApi.updateResponsibility(id, input),
    onSuccess: () => invalidateEvent(queryClient, eventId),
  })
}

export function useSetResponsibilityStatus(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ResponsibilityStatus }) => eventsApi.setResponsibilityStatus(id, status),
    onSuccess: () => invalidateEvent(queryClient, eventId),
  })
}

export function useDeleteResponsibility(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => eventsApi.deleteResponsibility(id),
    onSuccess: () => invalidateEvent(queryClient, eventId),
  })
}
