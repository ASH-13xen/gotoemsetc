import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as api from '@/api/meetings.api'

const listKey = (clientId: string) => ['meetings', 'client', clientId]
const detailKey = (id: string) => ['meetings', id]

function errorMessage(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message || fallback
}

export function useMeetingsForClient(clientId: string) {
  return useQuery({ queryKey: listKey(clientId), queryFn: () => api.listMeetingsForClient(clientId) })
}

export function useMeeting(id: string | undefined) {
  return useQuery({
    queryKey: detailKey(id as string),
    queryFn: () => api.getMeeting(id as string),
    enabled: Boolean(id),
  })
}

// Every mutation invalidates both the list and the one detail view — a
// single action (reschedule, MOM, a spawned task) can change several
// things at once, and re-reading is simpler than patching in place.
function useMeetingMutation<TArgs>(
  clientId: string,
  meetingId: string | undefined,
  fn: (args: TArgs) => Promise<unknown>,
  successMessage: string,
  fallbackError: string
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listKey(clientId) })
      if (meetingId) qc.invalidateQueries({ queryKey: detailKey(meetingId) })
      if (successMessage) toast.success(successMessage)
    },
    onError: (err) => toast.error(errorMessage(err, fallbackError)),
  })
}

export function useScheduleMeeting(clientId: string) {
  return useMeetingMutation(clientId, undefined, api.scheduleMeeting, 'Meeting scheduled', 'Could not schedule this meeting')
}

export function useLogMeeting(clientId: string) {
  return useMeetingMutation(clientId, undefined, api.logMeeting, 'Meeting logged', 'Could not log this meeting')
}

export function useRescheduleMeeting(clientId: string, meetingId: string) {
  return useMeetingMutation(
    clientId,
    meetingId,
    (scheduledAt: string) => api.rescheduleMeeting(meetingId, scheduledAt),
    'Meeting rescheduled',
    'Could not reschedule'
  )
}

export function useCancelMeeting(clientId: string, meetingId: string) {
  return useMeetingMutation<void>(clientId, meetingId, () => api.cancelMeeting(meetingId), 'Meeting cancelled', 'Could not cancel')
}

export function useSubmitMom(clientId: string, meetingId: string) {
  return useMeetingMutation(
    clientId,
    meetingId,
    (input: api.SubmitMomInput) => api.submitMom(meetingId, input),
    'MOM saved',
    'Could not save the MOM'
  )
}

export function useAddTaskFromMom(clientId: string, meetingId: string) {
  return useMeetingMutation(
    clientId,
    meetingId,
    (input: api.AddTaskInput) => api.addTaskFromMom(meetingId, input),
    'Task created',
    'Could not create this task'
  )
}
