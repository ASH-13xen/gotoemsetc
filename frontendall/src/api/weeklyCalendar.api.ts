import { apiClient } from './client'

export type WeeklyCategory = 'team' | 'sales' | 'hr' | 'client' | 'event' | 'training' | 'admin' | 'other'
export type InviteStatus = 'invited' | 'accepted' | 'declined'
export type MyRole = 'host' | InviteStatus | 'open' | 'viewer'
export type Scope = 'one' | 'series'

export interface CalPerson {
  _id: string
  name: string
  subtitle: string
  role: string
  hasEmail: boolean
}

export interface PeopleGroup {
  key: string
  label: string
  userIds: string[]
}

export interface Occurrence {
  day: string // YYYY-MM-DD
  startMin: number
  endMin: number
}

export interface CalNote {
  _id: string
  kind: 'note' | 'action'
  text: string
  createdBy: CalPerson
  createdAt: string
  updatedBy: CalPerson | null
  updatedAt: string
  history: { text: string; by: CalPerson; at: string }[]
  assignee: CalPerson | null
  dueDay: string | null
  done: boolean
  task: string | null
}

export interface CalSegment {
  _id?: string
  startMin: number
  endMin: number
  label: string
  user: CalPerson | null
}

export interface CalAttendee {
  user: CalPerson
  status: InviteStatus
  invitedAt?: string
  respondedAt?: string
  reason: string
}

// A block on a week. `busy: true` means it's someone else's time the
// viewer may not see — only the time is sent.
export interface CalEvent extends Occurrence {
  _id: string
  busy: boolean
  title?: string
  description?: string
  category?: WeeklyCategory
  isPersonal?: boolean
  openForAll?: boolean
  location?: string
  link?: string
  series?: string | null
  seriesSize?: number
  host?: CalPerson
  attendees?: CalAttendee[]
  myRole?: MyRole
  canManage?: boolean
  canNote?: boolean
  segments?: CalSegment[]
  notes?: CalNote[]
  occurrences?: (Occurrence & { _id: string })[]
}

export interface WeekGridConfig {
  START: number
  END: number
  SLOT: number
  LUNCH_START: number
  LUNCH_END: number
}

export interface WeekData {
  start: string
  days: string[]
  today: string
  nowMin: number
  person: CalPerson
  events: CalEvent[]
  holidays: { day: string; label: string; type: 'holiday' | 'half_day' | 'sl_day' }[]
  leaveDays: string[]
  grid: WeekGridConfig
}

export interface BusyInterval extends Occurrence {
  kind: 'event' | 'leave' | 'tentative'
  eventId: string | null
  title: string | null
}

export interface CreateEventInput {
  title: string
  description?: string
  category: WeeklyCategory
  isPersonal?: boolean
  openForAll?: boolean
  location?: string
  link?: string
  slots: Occurrence[]
  repeatWeeks?: number
  invitees?: string[]
}

export interface PublicInvite {
  title: string
  description: string
  category: WeeklyCategory
  location: string
  link: string
  host: CalPerson
  invitee: CalPerson
  cancelled: boolean
  status: InviteStatus | null
  scope: Scope
  occurrences: (Occurrence & { status: InviteStatus | null })[]
  attendees: CalPerson[]
}

const BASE = '/weekly-calendar'

export const getPeople = async () => (await apiClient.get<{ people: CalPerson[]; groups: PeopleGroup[] }>(`${BASE}/people`)).data
export const getWeek = async (start: string, user?: string) =>
  (await apiClient.get<WeekData>(`${BASE}/week`, { params: { start, ...(user ? { user } : {}) } })).data
export const getBusy = async (start: string, users?: string[]) =>
  (
    await apiClient.get<{ start: string; busy: Record<string, BusyInterval[]> }>(`${BASE}/busy`, {
      params: { start, ...(users?.length ? { users: users.join(',') } : {}) },
    })
  ).data
export const getInvites = async () => (await apiClient.get<{ invites: CalEvent[] }>(`${BASE}/invites`)).data.invites
export const getEvent = async (id: string) => (await apiClient.get<{ event: CalEvent }>(`${BASE}/events/${id}`)).data.event

export const createEvent = async (input: CreateEventInput) =>
  (await apiClient.post<{ events: CalEvent[]; count: number }>(`${BASE}/events`, input)).data
export const updateEvent = async (id: string, input: Partial<Omit<CreateEventInput, 'slots' | 'invitees'>> & Partial<Occurrence> & { scope?: Scope }) =>
  (await apiClient.patch<{ event: CalEvent }>(`${BASE}/events/${id}`, input)).data.event
export const cancelEvent = async (id: string, input: { scope?: Scope; reason?: string }) =>
  (await apiClient.post<{ cancelled: number }>(`${BASE}/events/${id}/cancel`, input)).data
export const inviteMore = async (id: string, input: { userIds: string[]; scope?: Scope }) =>
  (await apiClient.post<{ event: CalEvent }>(`${BASE}/events/${id}/invite`, input)).data.event
export const removeAttendee = async (id: string, userId: string, scope: Scope = 'one') =>
  (await apiClient.delete<{ event: CalEvent }>(`${BASE}/events/${id}/attendees/${userId}`, { params: { scope } })).data.event
export const respond = async (id: string, input: { response: 'accept' | 'decline'; reason?: string; scope?: Scope }) =>
  (await apiClient.post<{ updated: number; skipped: string[] }>(`${BASE}/events/${id}/respond`, input)).data
export const join = async (id: string) => (await apiClient.post<{ event: CalEvent }>(`${BASE}/events/${id}/join`)).data.event
export const setSegments = async (id: string, segments: { startMin: number; endMin: number; label?: string; user?: string | null }[]) =>
  (await apiClient.put<{ event: CalEvent }>(`${BASE}/events/${id}/segments`, { segments })).data.event

export const addNote = async (id: string, input: { kind?: 'note' | 'action'; text: string; assignee?: string; dueDay?: string }) =>
  (await apiClient.post<{ event: CalEvent }>(`${BASE}/events/${id}/notes`, input)).data.event
export const updateNote = async (
  id: string,
  noteId: string,
  input: { text?: string; done?: boolean; assignee?: string | null; dueDay?: string | null }
) => (await apiClient.patch<{ event: CalEvent }>(`${BASE}/events/${id}/notes/${noteId}`, input)).data.event
export const deleteNote = async (id: string, noteId: string) =>
  (await apiClient.delete<{ event: CalEvent }>(`${BASE}/events/${id}/notes/${noteId}`)).data.event
export const noteToTask = async (id: string, noteId: string) =>
  (await apiClient.post<{ event: CalEvent }>(`${BASE}/events/${id}/notes/${noteId}/task`)).data.event

export const copyWeek = async (input: { from: string; to: string }) =>
  (await apiClient.post<{ created: number; skipped: { title: string; day: string; reason: string }[] }>(`${BASE}/copy-week`, input)).data

export async function downloadWeekPdf(start: string, user?: string) {
  const res = await apiClient.get(`${BASE}/week/pdf`, { params: { start, ...(user ? { user } : {}) }, responseType: 'blob' })
  const disposition = String(res.headers['content-disposition'] ?? '')
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `Weekly Calendar ${start}.pdf`
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const getPublicInvite = async (token: string) =>
  (await apiClient.get<{ invite: PublicInvite }>(`/public/calendar-invites/${token}`)).data.invite
export const respondPublic = async (token: string, input: { response: 'accept' | 'decline'; reason?: string }) =>
  (await apiClient.post<{ updated: number; skipped: string[] }>(`/public/calendar-invites/${token}`, input)).data
