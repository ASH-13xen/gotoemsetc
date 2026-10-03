import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/weeklyCalendar.api'

// Every key starts with 'weekly' so one invalidation refreshes the grid,
// the busy map, the invites tray and any open event at once.
const ROOT = ['weekly']

export function useWeek(start: string, user?: string) {
  return useQuery({
    queryKey: [...ROOT, 'week', start, user ?? 'me'],
    queryFn: () => api.getWeek(start, user),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  })
}

export function useCalendarPeople() {
  return useQuery({ queryKey: [...ROOT, 'people'], queryFn: api.getPeople, staleTime: 5 * 60_000 })
}

// Busy maps for several weeks at once (an event repeated weekly spans many).
export function useBusyWeeks(starts: string[], users?: string[], enabled = true) {
  const results = useQueries({
    queries: starts.map((start) => ({
      queryKey: [...ROOT, 'busy', start, users?.join(',') ?? 'all'],
      queryFn: () => api.getBusy(start, users),
      enabled,
      staleTime: 15_000,
    })),
  })
  const busy: Record<string, api.BusyInterval[]> = {}
  for (const r of results) {
    for (const [id, list] of Object.entries(r.data?.busy ?? {})) busy[id] = [...(busy[id] ?? []), ...list]
  }
  return { busy, isLoading: results.some((r) => r.isLoading) }
}

export function useInvites() {
  return useQuery({ queryKey: [...ROOT, 'invites'], queryFn: api.getInvites, refetchInterval: 60_000 })
}

export function useCalEvent(id: string | null) {
  return useQuery({ queryKey: [...ROOT, 'event', id], queryFn: () => api.getEvent(id as string), enabled: Boolean(id) })
}

function useWeeklyMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      // Writes that return the updated event show it straight away, before
      // the wider refresh below lands.
      const event = data as unknown as api.CalEvent
      if (event && typeof event === 'object' && '_id' in event && 'day' in event) {
        queryClient.setQueryData([...ROOT, 'event', event._id], event)
      }
      queryClient.invalidateQueries({ queryKey: ROOT })
      // Action items can turn into tasks.
      queryClient.invalidateQueries({ queryKey: ['employee-tasks'] })
    },
  })
}

export const useCreateCalEvent = () => useWeeklyMutation(api.createEvent)
export const useUpdateCalEvent = () =>
  useWeeklyMutation(({ id, ...input }: { id: string } & Parameters<typeof api.updateEvent>[1]) => api.updateEvent(id, input))
export const useCancelCalEvent = () =>
  useWeeklyMutation(({ id, ...input }: { id: string; scope?: api.Scope; reason?: string }) => api.cancelEvent(id, input))
export const useInviteMore = () =>
  useWeeklyMutation(({ id, ...input }: { id: string; userIds: string[]; scope?: api.Scope }) => api.inviteMore(id, input))
export const useRemoveAttendee = () =>
  useWeeklyMutation(({ id, userId, scope }: { id: string; userId: string; scope?: api.Scope }) => api.removeAttendee(id, userId, scope))
export const useRespond = () =>
  useWeeklyMutation(({ id, ...input }: { id: string; response: 'accept' | 'decline'; reason?: string; scope?: api.Scope }) =>
    api.respond(id, input)
  )
export const useJoin = () => useWeeklyMutation((id: string) => api.join(id))
export const useSetSegments = () =>
  useWeeklyMutation(({ id, segments }: { id: string; segments: Parameters<typeof api.setSegments>[1] }) => api.setSegments(id, segments))
export const useAddNote = () =>
  useWeeklyMutation(({ id, ...input }: { id: string } & Parameters<typeof api.addNote>[1]) => api.addNote(id, input))
export const useUpdateNote = () =>
  useWeeklyMutation(({ id, noteId, ...input }: { id: string; noteId: string } & Parameters<typeof api.updateNote>[2]) =>
    api.updateNote(id, noteId, input)
  )
export const useDeleteNote = () => useWeeklyMutation(({ id, noteId }: { id: string; noteId: string }) => api.deleteNote(id, noteId))
export const useNoteToTask = () => useWeeklyMutation(({ id, noteId }: { id: string; noteId: string }) => api.noteToTask(id, noteId))
export const useCopyWeek = () => useWeeklyMutation(api.copyWeek)
