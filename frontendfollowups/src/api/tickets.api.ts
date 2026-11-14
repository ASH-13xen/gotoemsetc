import { apiClient } from './client'

// Task Management, as tickets — see backend services/ticket.service.js. Every
// colour comes from the server (the content calendar's own palette), never
// from here.

// The work pipelines (General, Reel, Post, Story) are what new tickets use;
// 'simple' and the old story/post/reel only show tickets made on them.
export type Pipeline = 'general' | 'reel_v2' | 'post_v2' | 'story_v2' | 'custom' | 'simple' | 'story' | 'post' | 'reel'
export const WORK_PIPELINES: Pipeline[] = ['general', 'reel_v2', 'post_v2', 'story_v2']
export type Lineup = 'shoot' | 'editing' | 'calendar' | 'posting' | 'shoot_day' | 'hold'
export type WorkRole = 'designer' | 'shooter' | 'editor' | 'contentManager' | 'smm'
export interface Person {
  _id: string
  name: string | null
}
export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'completed' | 'rejected'

export interface TrailStep {
  key: string
  label: string
  color: string
  actorLabel: string | null
  terminal: boolean
  reached: boolean
  current: boolean
  people?: string[]
  vacantFor?: string | null
}

export interface RecordEntry {
  _id: string
  type:
    | 'raised'
    | 'seen'
    | 'advanced'
    | 'restarted'
    | 'sent_back'
    | 'rejected'
    | 'edited'
    | 'due_changed'
    | 'reassigned'
    | 'commented'
    | 'link_added'
    | 'overdue'
    | 'completed'
    | 'submitted_to_ceo'
    | 'ceo_reviewed'
    | 'repeat_stopped'
    | 'started'
    | 'parked'
    | 'unparked'
    | 'hours'
  at: string
  byName: string
  actingAs: string | null
  onBehalfOf: string | null
  fromStage: string | null
  toStage: string | null
  fromLabel: string | null
  toLabel: string | null
  fromColor: string | null
  toColor: string | null
  note: string
  changes: { field: string; from: unknown; to: unknown }[]
  meta: Record<string, unknown> | null
}

export interface Ticket {
  _id: string
  kind?: 'ticket'
  number: number
  code: string
  title: string
  description: string
  priority: Priority
  dueAt: string
  clientName: string
  pipeline: Pipeline
  pipelineName: string
  team: { _id: string; title: string } | null
  raisedBy: { _id: string; name: string | null }
  raisedFor: { _id: string; name: string | null; designation: string }
  stage: string
  stageLabel: string
  color: string
  baseColor: string
  status: TicketStatus
  isSentBack: boolean
  isRejected: boolean
  isOverdue: boolean
  trail: TrailStep[]
  waitingOn: string[]
  waitingOnLabel: string | null
  nextStepLabel: string | null
  links: { _id: string; url: string; label: string; at: string; by: string | null }[]
  completedAt: string | null
  rejectedAt: string | null
  submittedToCeoAt: string | null
  ceoReviewedAt: string | null
  ceoReviewedBy: string | null
  ceoReviewNote: string
  metrics: { stepMs: Record<string, number>; reverts: number }
  createdAt: string
  updatedAt: string
  assignments: Record<string, string | undefined>
  smm: { _id: string; name: string | null } | null
  customSteps: { key: string; label: string; color: string; assignee: string }[]
  can: {
    act: boolean
    sendBack: boolean
    edit: boolean
    review: boolean
    comment: boolean
    start?: boolean
    pickUp?: boolean
    schedule?: boolean
    hold?: boolean
    resume?: boolean
    reassign?: boolean
    setDue?: boolean
  }
  actingAs: string | null
  // Work pipelines (General, Reel, Post, Story).
  isWork?: boolean
  typeColor?: string | null
  locked?: boolean
  parkedIn?: Lineup | null
  lineupLabel?: string | null
  parkNote?: string
  scheduledFor?: string | null
  approver?: (Person & { userId?: string }) | null
  people?: Partial<Record<WorkRole, Person>>
  next?: { key: string; needsDate: boolean; needsLink: boolean; approval: boolean; viaShoot: boolean } | null
  client?: string | null
  deliverable?: { clientMonth: string | null; month: string | null; type: string | null; index: number | null; removed?: boolean } | null
  carriedOver?: boolean
  // Raised by a repeat — how it repeats, whether it still does, who may stop it.
  repeat: TicketRepeatInfo | null
  record?: RecordEntry[]
}

export type TicketRepeatKind = 'daily' | 'weekly' | 'monthly' | 'yearly'
export interface TicketRepeatInfo {
  _id: string
  repeat: TicketRepeatKind
  active: boolean
  nextAt: string | null
  raisedCount: number
  stoppedAt: string | null
  canStop: boolean
}

export const REPEAT_LABEL: Record<TicketRepeatKind, string> = {
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
}

export async function stopTicketRepeat(id: string, reason?: string) {
  const { data } = await apiClient.post<{ stopped: boolean }>(`/tickets/repeats/${id}/stop`, { reason })
  return data
}

export interface CalendarTicket {
  kind: 'calendar' | 'stories'
  _id: string
  code: string
  title: string
  clientName: string
  pipeline: string
  pipelineName: string
  team: { _id: string; title: string } | null
  dueAt: string
  stage?: string
  stageLabel?: string
  color: string
  trail: TrailStep[]
  isSentBack?: boolean
  isRejected?: boolean
  isOverdue: boolean
  status: TicketStatus
  waitingOnLabel?: string | null
  nextStepLabel?: string | null
  days?: { _id: string; date: string; stage: string; stageLabel: string; color: string }[]
  doneCount?: number
  total?: number
}

export interface CalendarItemDetail extends CalendarTicket {
  brief: Record<string, string>
  people: Record<string, string | null>
  waitingOn: string[]
  can: { act: boolean; sendBack: boolean }
  record: RecordEntry[]
}

export interface StoryDay {
  _id: string
  date: string
  stage: string
  stageLabel: string
  color: string
  isSentBack: boolean
  isRejected: boolean
  isOverdue: boolean
  waitingOnLabel: string | null
  can: { act: boolean; sendBack: boolean }
  record: RecordEntry[]
}

export interface StoriesDetail extends Omit<CalendarTicket, 'days'> {
  days: StoryDay[]
}

export interface PipelineInfo {
  key: Pipeline
  name: string
  description: string
  typeColor?: string
  phases?: { key: string; label: string; from: string; to: string }[] | null
  steps: { key: string; label: string; color: string; actorLabel: string | null; terminal: boolean; approval?: boolean; lineupAfter?: Lineup | null }[]
}

export interface PickPerson {
  _id: string
  name: string
  designation: string
  teams: string[]
  isSelf?: boolean
}

export interface TicketMeta {
  pipelines: PipelineInfo[]
  legacyPipelines?: PipelineInfo[]
  workColors?: Record<string, string>
  lineups?: Record<Lineup, { label: string; leaves: string }>
  // The Team Lead, CEO and admin pick anyone (any team) on a work ticket.
  everyone?: PickPerson[] | null
  // CEO / admin logins with no employee record — still choosable as a General ticket's approver.
  approverLogins?: { _id: string; name: string; username: string }[]
  overrides: { sent_back: string; rejected: string; overdue: string }
  customPalette: string[]
  priorities: Priority[]
  raisable: { _id: string; name: string; designation: string; teams: string[]; isSelf: boolean }[]
  teams: {
    _id: string
    title: string
    workTeam: string | null
    roles: { _id: string; parent: string; box: string; role: string; isHead: boolean; holders: { _id: string; name: string }[] }[]
    // Each Social Media Manager with the Videographers and Editors in their own boxes.
    smms: { _id: string; name: string; videographers: { _id: string; name: string }[]; editors: { _id: string; name: string }[] }[]
    // The team's Content Manager(s).
    heads: { _id: string; name: string }[]
  }[]
  me: {
    employeeId: string | null
    postLabel: string
    teams: string[]
    seesEveryone: boolean
    isCeo: boolean
    isAdmin: boolean
    hasTeam: boolean
    isTeamLead?: boolean
    picksFromAnyTeam?: boolean
    // Teams this person is the Content Manager of.
    cmOf?: string[]
  }
}

export interface TicketSummary {
  waitingCount: number
  overdueCount: number
  raisedOpen: number
  unreviewed: number
  waiting: Ticket[]
  calendarWaiting: number
  toStart?: number
}

export interface RaiseInput {
  title: string
  description?: string
  priority?: Priority
  dueAt: string
  clientName?: string
  pipeline: Pipeline
  // Raise a fresh copy every day/week/month/year until it's stopped.
  repeat?: TicketRepeatKind | 'none'
  raisedFor?: string
  team?: string
  smm?: string
  assignments?: { designer?: string; shooter?: string; editor?: string; contentManager?: string; smm?: string }
  // General: who approves and closes it (you, unless someone is chosen) —
  // an employee, or a login with no employee record (approverUser).
  approver?: string
  approverUser?: string
  customSteps?: { label: string; color: string; assignee: string }[]
}

export interface AnalysisRow {
  _id: string
  code: string
  title: string
  pipeline: string
  team: string
  clientName: string
  priority: Priority
  raisedBy: string | null
  raisedFor: string | null
  status: TicketStatus
  color: string
  stageLabel: string
  createdAt: string
  dueAt: string
  completedAt: string | null
  rejectedAt: string | null
  onTime: boolean | null
  wentOverdue: boolean
  totalMs: number
  reverts: number
  events: number
  stepTimes: { stage: string; label: string; color: string; ms: number }[]
  slowestStep: { label: string; ms: number } | null
  ceoReviewed: boolean
}

export interface Analysis {
  totals: { tickets: number; open: number; completed: number; rejected: number; onTime: number; late: number; reverts: number; avgTurnaroundMs: number | null }
  steps: { pipeline: string; step: string; color: string | null; ms: number; count: number; avgMs: number }[]
  people: { name: string; done: number; onTime: number; late: number; totalMs: number; workSentBack: number; sentBackOthers: number; steps: number; avgTurnaroundMs: number | null }[]
  rows: AnalysisRow[]
}

export type Scope = 'mine' | 'raised' | 'team' | 'all' | 'submitted' | 'to_start' | 'lineup'

export const getMeta = async () => (await apiClient.get<TicketMeta>('/tickets/meta')).data
export const listTickets = async (params: { scope: Scope; status?: string; q?: string; lineup?: Lineup }) =>
  (await apiClient.get<{ tickets: Ticket[] }>('/tickets', { params })).data.tickets
export const getTicket = async (id: string) => (await apiClient.get<{ ticket: Ticket }>(`/tickets/${id}`)).data.ticket
export const getSummary = async () => (await apiClient.get<TicketSummary>('/tickets/summary')).data
export const getAnalysis = async (params: Record<string, string | undefined>) =>
  (await apiClient.get<Analysis>('/tickets/analysis', { params })).data
export const raiseTicket = async (input: RaiseInput) => (await apiClient.post<{ ticket: Ticket }>('/tickets', input)).data.ticket
// Handing a step on: the hours (minutes) as estimated or changed with a
// reason, the posting date, the link — whatever the step asks.
export interface AdvanceInput {
  note?: string
  date?: string
  link?: string
  minutes?: number
  reason?: string
}
export const advanceTicket = async (id: string, input: AdvanceInput | string = {}) =>
  (await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/advance`, typeof input === 'string' ? { note: input || undefined } : input)).data.ticket
export const sendBackTicket = async (id: string, note: string) => (await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/send-back`, { note })).data.ticket
export const rejectTicket = async (id: string, reason: string) => (await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/reject`, { reason })).data.ticket
export const editTicket = async (id: string, input: Partial<Pick<Ticket, 'title' | 'description' | 'priority' | 'clientName' | 'dueAt'>> & { note?: string }) =>
  (await apiClient.patch<{ ticket: Ticket }>(`/tickets/${id}`, input)).data.ticket
export const reassignTicket = async (id: string, input: { field?: string; stepKey?: string; employeeId: string; note?: string }) =>
  (await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/reassign`, input)).data.ticket
export const commentTicket = async (id: string, text: string) => (await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/comments`, { text })).data.ticket
export const addTicketLink = async (id: string, url: string, label?: string) =>
  (await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/links`, { url, label })).data.ticket
export const reviewTicket = async (id: string, note?: string) => (await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/ceo-review`, { note })).data.ticket

export const listCalendarTickets = async (params: { scope: 'mine' | 'team' | 'all'; status?: string }) =>
  (await apiClient.get<{ tickets: CalendarTicket[] }>('/tickets/calendar', { params })).data.tickets
export const getCalendarItem = async (id: string) => (await apiClient.get<{ ticket: CalendarItemDetail }>(`/tickets/calendar/items/${id}`)).data.ticket
export const getStories = async (id: string) => (await apiClient.get<{ ticket: StoriesDetail }>(`/tickets/calendar/stories/${id}`)).data.ticket
export const actOnCalendarItem = async (id: string, action: 'advance' | 'send-back' | 'reject', body: { note?: string; reason?: string }) =>
  (await apiClient.post<{ ticket: CalendarItemDetail }>(`/tickets/calendar/items/${id}/${action}`, body)).data.ticket

export function errorMessage(err: unknown, fallback: string) {
  const e = err as { response?: { data?: { message?: string; details?: Record<string, string> } } }
  const details = e?.response?.data?.details
  if (details) return Object.values(details)[0] || fallback
  return e?.response?.data?.message || fallback
}

// ---- work pipelines: starting, lineups, hold, hours --------------------------------

export interface StepEstimate {
  ticket: string
  // false: nothing to ask (done for someone else — they confirm their own)
  ask: boolean
  step?: string
  stepLabel?: string
  approval?: boolean
  since?: string
  minutes?: number
  source?: 'approval' | 'timer' | 'estimate'
}
export interface PendingHours {
  _id: string
  ticket: { _id: string; code: string; title: string } | null
  stepLabel: string
  from: string | null
  to: string | null
  estimateMinutes: number | null
  createdAt: string
}

export const startTicket = async (id: string, dueAt: string, note?: string) => (await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/start`, { dueAt, note })).data.ticket
export const startTickets = async (input: { ids?: string[]; dueAt?: string; items?: { id: string; dueAt: string }[] }) =>
  (await apiClient.post<{ tickets: Ticket[] }>('/tickets/start', input)).data.tickets
export const pickUpTicket = async (id: string) => (await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/pick-up`)).data.ticket
export const holdTicket = async (id: string, reason: string) => (await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/hold`, { reason })).data.ticket
export const resumeTicket = async (id: string, note?: string) => (await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/resume`, { note })).data.ticket
export const getEstimate = async (id: string) => (await apiClient.get<StepEstimate>(`/tickets/${id}/estimate`)).data
export const getEstimates = async (ids: string[]) => (await apiClient.get<{ tickets: StepEstimate[]; totalMinutes: number }>('/tickets/estimates', { params: { ids: ids.join(',') } })).data
export const advanceTickets = async (input: { ids: string[]; minutes?: number; reason?: string; note?: string }) =>
  (await apiClient.post<{ advanced: number }>('/tickets/batch/advance', input)).data
export const getPendingHours = async () => (await apiClient.get<{ entries: PendingHours[] }>('/tickets/hours/pending')).data.entries
export const confirmHours = async (id: string, input: { minutes?: number; reason?: string }) =>
  (await apiClient.post<{ entries: PendingHours[] }>(`/tickets/hours/${id}/confirm`, input)).data.entries
