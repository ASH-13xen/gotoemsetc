import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as cms from '@/api/cms.api'

const CLIENTS = ['cms', 'clients'] as const
const calendarKey = (id: string) => ['cms', 'calendar', id]

// Errors from this API are almost always a rule the user needs to read
// ("this task isn't completed yet", "a reason is required"), so the server's
// message is surfaced verbatim rather than replaced with a generic one.
function errorMessage(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message || fallback
}

export function useClients() {
  return useQuery({ queryKey: CLIENTS, queryFn: cms.listClients })
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['cms', 'client', id],
    queryFn: () => cms.getClient(id as string),
    enabled: Boolean(id),
  })
}

export function useTeams() {
  return useQuery({ queryKey: ['cms', 'teams'], queryFn: cms.listTeams, staleTime: 60_000 })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cms.createClient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLIENTS })
      toast.success('Client registered')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not register client')),
  })
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: cms.ClientInput) => cms.updateClient(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cms', 'client', id] })
      qc.invalidateQueries({ queryKey: CLIENTS })
      toast.success('Client updated')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not update client')),
  })
}

export function useCalendars(clientId: string | undefined) {
  return useQuery({
    queryKey: ['cms', 'calendars', clientId],
    queryFn: () => cms.listCalendars(clientId as string),
    enabled: Boolean(clientId),
  })
}

export function useCalendarView(calendarId: string | undefined) {
  return useQuery({
    queryKey: calendarKey(calendarId as string),
    queryFn: () => cms.getCalendarView(calendarId as string),
    enabled: Boolean(calendarId),
  })
}

export function useCreateCalendar(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cms.createCalendar,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cms', 'calendars', clientId] })
      toast.success('Calendar created')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not create calendar')),
  })
}

// Every item mutation invalidates the whole calendar view rather than
// patching one item in place: a single action can move the stage, reopen
// tasks, and shift the counters at once, and re-reading is both simpler and
// guaranteed to agree with the server.
function useCalendarMutation<TArgs>(
  calendarId: string,
  fn: (args: TArgs) => Promise<unknown>,
  successMessage: string,
  fallbackError: string
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKey(calendarId) })
      if (successMessage) toast.success(successMessage)
    },
    onError: (err) => toast.error(errorMessage(err, fallbackError)),
  })
}

export function useScheduleItem(calendarId: string) {
  return useCalendarMutation(
    calendarId,
    (input: Parameters<typeof cms.scheduleItem>[1]) => cms.scheduleItem(calendarId, input),
    'Scheduled',
    'Could not schedule this item'
  )
}

export function useUpdateBrief(calendarId: string) {
  return useCalendarMutation(
    calendarId,
    ({ id, brief }: { id: string; brief: cms.CalendarItem['brief'] }) => cms.updateBrief(id, brief),
    'Details saved',
    'Could not save details'
  )
}

export function useRescheduleItem(calendarId: string) {
  return useCalendarMutation(
    calendarId,
    ({ id, scheduledDate }: { id: string; scheduledDate: string }) => cms.rescheduleItem(id, scheduledDate),
    'Rescheduled',
    'Could not reschedule'
  )
}

export function useReassignItem(calendarId: string) {
  return useCalendarMutation(
    calendarId,
    ({ id, ...rest }: { id: string; designer?: string; shooter?: string; editor?: string }) =>
      cms.reassignItem(id, rest),
    'Reassigned',
    'Could not reassign'
  )
}

export function useDeleteItem(calendarId: string) {
  return useCalendarMutation(calendarId, (id: string) => cms.deleteItem(id), 'Removed', 'Could not remove this item')
}

// The current step's actor marks it done — drives the whole pipeline.
export function useAdvanceItem(calendarId: string) {
  return useCalendarMutation(
    calendarId,
    ({ id, note }: { id: string; note?: string }) => cms.advanceItem(id, note),
    'Marked done',
    'Could not complete this step'
  )
}

// Pink — sends the item back one step.
export function useSendBackItem(calendarId: string) {
  return useCalendarMutation(
    calendarId,
    ({ id, note }: { id: string; note?: string }) => cms.sendBackItem(id, note),
    'Sent back',
    'Could not send this back'
  )
}

// Red — terminal, closes the item for everyone.
export function useRejectItem(calendarId: string) {
  return useCalendarMutation(
    calendarId,
    ({ id, reason }: { id: string; reason: string }) => cms.rejectItem(id, reason),
    'Rejected',
    'Could not reject this item'
  )
}

export function useReport(calendarId: string | undefined) {
  return useQuery({
    queryKey: ['cms', 'report', calendarId],
    queryFn: () => cms.getReport(calendarId as string),
    enabled: Boolean(calendarId),
  })
}

export function useCloseMonth(calendarId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => cms.closeMonth(calendarId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cms', 'report', calendarId] })
      qc.invalidateQueries({ queryKey: calendarKey(calendarId) })
      toast.success('Month closed — the report is now frozen')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not close the month')),
  })
}
