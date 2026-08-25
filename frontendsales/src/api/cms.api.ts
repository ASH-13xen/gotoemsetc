import { apiClient } from './client'

export type CmsPlan = 'gold' | 'platinum' | 'diamond'
export type ContentType = 'post' | 'reel' | 'story' | 'festive_story'
// Only meaningful when type === 'festive_story' — which literal pipeline it follows.
export type FestiveWorkflow = 'post' | 'reel'
export type PipelineKind = 'story' | 'post' | 'reel'

// Every step key across all three pipelines — which ones are actually legal
// for a given item depends on its pipeline kind (type, or festiveWorkflow
// when type is festive_story). See backend/src/config/cmsPipelines.js, the
// single source of truth this mirrors.
export type StepKey =
  | 'created'
  | 'smm_done'
  | 'lead_done'
  | 'lead_approved'
  | 'sent_to_client'
  | 'client_approved'
  | 'done'
  | 'videographer_done'
  | 'editor_done'
  | 'content_manager_done'

// The 9 fixed tags a team member can hold, any number at once. Mirrors
// backend/src/config/constants.js#TEAM_MEMBER_ROLE.
export const TEAM_MEMBER_ROLES = [
  'videographer',
  'editor',
  'social_media_manager',
  'content_manager',
  'graphic_designer',
  'event_manager',
  'podcast_manager',
  'podcast_sales',
  'marketing_sales',
] as const
export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number]

export const TEAM_MEMBER_ROLE_LABEL: Record<TeamMemberRole, string> = {
  videographer: 'Videographer',
  editor: 'Editor',
  social_media_manager: 'Social Media Manager',
  content_manager: 'Content Manager',
  graphic_designer: 'Graphic Designer',
  event_manager: 'Event Manager',
  podcast_manager: 'Podcast Manager',
  podcast_sales: 'Podcast Sales',
  marketing_sales: 'Marketing Sales',
}

export interface EmployeeRef {
  _id: string
  firstName: string
  lastName?: string
  designation?: string
}

export interface MemberRole {
  employee: EmployeeRef
  roles: TeamMemberRole[]
}

export interface TeamRef {
  _id: string
  name: string
  // Displayed as "Team Main" — kept as `leader` to match the backend field
  // and its existing local authority. The company-wide Team Leader (the
  // team_lead login role) is a separate concept, not tied to any team.
  leader?: EmployeeRef
  members?: EmployeeRef[]
  memberRoles?: MemberRole[]
}

export interface ClientContact {
  name: string
  role?: string
  email?: string
  phone?: string
  isPrimary?: boolean
}

export interface ClientLocation {
  addressLine?: string
  city?: string
  state?: string
  country?: string
  pincode?: string
}

export interface TeamHistoryEntry {
  team?: TeamRef
  startedAt: string
  endedAt?: string | null
  changedBy?: string
}

export interface Client {
  _id: string
  name: string
  brandName?: string
  logoUrl?: string
  contacts?: ClientContact[]
  location?: ClientLocation
  instagramHandle?: string
  website?: string
  // The client manual's page 2 / page 1 long-form fields.
  aboutBrand?: string
  aboutClient?: string
  expectations?: string
  defaultTeam?: TeamRef | null
  teamHistory?: TeamHistoryEntry[]
  currentPlan?: CmsPlan | null
}

// `label` is shown verbatim as the counter's denominator — several plan tiers
// are ranges ("6-8"), so it is deliberately a string and never resolved to a
// single number. min/max exist only for the report's fulfilment maths.
export interface Quota {
  label: string
  min: number
  max: number
}

export interface Calendar {
  _id: string
  client: Client
  year: number
  month: number
  plan: CmsPlan
  quotas: { posts: Quota; reels: Quota; dailyStoriesPerDay: Quota; festiveStories: Quota }
  team: TeamRef
  closedAt?: string | null
}

export interface TaskRef {
  _id: string
  title: string
  status: 'pending' | 'for_review' | 'completed'
  endAt: string
}

// One entry per step of whichever pipeline this item follows, colour and
// reached/current state resolved server-side — never recomputed here, so
// the calendar and the Task Management stepper can't draw it differently.
export interface StepTrailEntry {
  key: StepKey
  terminal: boolean
  color: string
  reached: boolean
  current: boolean
}

export interface CalendarItem {
  _id: string
  calendar: string
  client: string
  type: ContentType
  festiveWorkflow?: FestiveWorkflow | null
  index: number
  scheduledDate: string
  brief: {
    postingName?: string
    postingLink?: string
    collabsAndTags?: string
    caption?: string
    uploadDestination?: string
    deliverableLink?: string
  }
  assignments: { designer?: EmployeeRef; shooter?: EmployeeRef; editor?: EmployeeRef; contentManager?: EmployeeRef }
  task?: TaskRef
  subtaskRefs?: { design?: TaskRef; shoot?: TaskRef; edit?: TaskRef; contentManager?: TaskRef }
  stage: StepKey
  // Pink — sent back one step, transient (clears on the next forward
  // completion of that step). Red — terminal, closes the item for everyone.
  isSentBack: boolean
  isRejected: boolean
  lastRejection?: { fromStage?: string; reason?: string; at?: string }
  stageHistory?: Array<{
    from?: string
    to: string
    action: string
    onBehalfOf?: string
    note?: string
    at: string
  }>
  publishedAt?: string | null
  // Resolved server-side so the heading, colour, and step trail can't drift
  // between the calendar grid, the day modal, and Task Management's stepper.
  label: string
  color: string
  trail: StepTrailEntry[]
  dateKey: string
}

export interface Counter {
  scheduled: number
  delivered: number
  denominator: string
  unit: 'items' | 'days'
  perDayLabel?: string
}

export interface CalendarView {
  calendar: Calendar
  items: CalendarItem[]
  byDate: Record<string, CalendarItem[]>
  counters: Record<ContentType, Counter>
  daysInMonth: number
}

// ---- Clients (shared registry with Task Management) ----
export async function listClients(): Promise<Client[]> {
  const { data } = await apiClient.get('/task-clients')
  return data.clients ?? []
}

export async function getClient(id: string): Promise<Client> {
  const { data } = await apiClient.get(`/task-clients/${id}`)
  return data.client
}

// Reads come back with defaultTeam populated; writes send its id. Keeping
// them as one type would force a cast at every call site.
export type ClientInput = Omit<Partial<Client>, 'defaultTeam'> & { defaultTeam?: string | null }

export async function createClient(input: ClientInput & { name: string }): Promise<Client> {
  const { data } = await apiClient.post('/task-clients', input)
  return data.client
}

export async function updateClient(id: string, input: ClientInput): Promise<Client> {
  const { data } = await apiClient.patch(`/task-clients/${id}`, input)
  return data.client
}

export async function listTeams(): Promise<TeamRef[]> {
  const { data } = await apiClient.get('/work-teams')
  return data.teams ?? []
}

// ---- Calendars ----
export async function listCalendars(clientId: string): Promise<Calendar[]> {
  const { data } = await apiClient.get('/cms/calendars', { params: { client: clientId } })
  return data.calendars ?? []
}

export async function createCalendar(input: {
  client: string
  year: number
  month: number
  plan?: CmsPlan
  team?: string
  generateDailyStories?: boolean
}): Promise<Calendar> {
  const { data } = await apiClient.post('/cms/calendars', input)
  return data.calendar
}

export async function getCalendarView(id: string): Promise<CalendarView> {
  const { data } = await apiClient.get(`/cms/calendars/${id}`)
  return data
}

export async function deleteCalendar(id: string): Promise<void> {
  await apiClient.delete(`/cms/calendars/${id}`)
}

// ---- Items ----
export async function scheduleItem(
  calendarId: string,
  input: {
    type: ContentType
    festiveWorkflow?: FestiveWorkflow
    scheduledDate: string
    assignments: { designer?: string; shooter?: string; editor?: string; contentManager?: string }
    brief?: CalendarItem['brief']
  }
): Promise<CalendarItem> {
  const { data } = await apiClient.post(`/cms/calendars/${calendarId}/items`, input)
  return data.item
}

// Decorated (label/colour/step-trail resolved server-side) — the same shape
// Task Management fetches for a client task's linked item.
export async function getItem(id: string): Promise<CalendarItem> {
  const { data } = await apiClient.get(`/cms/items/${id}`)
  return data.item
}

export async function updateBrief(id: string, brief: CalendarItem['brief']): Promise<CalendarItem> {
  const { data } = await apiClient.patch(`/cms/items/${id}/brief`, brief)
  return data.item
}

export async function rescheduleItem(id: string, scheduledDate: string): Promise<CalendarItem> {
  const { data } = await apiClient.post(`/cms/items/${id}/reschedule`, { scheduledDate })
  return data.item
}

export async function reassignItem(
  id: string,
  input: { designer?: string; shooter?: string; editor?: string; contentManager?: string }
): Promise<CalendarItem> {
  const { data } = await apiClient.post(`/cms/items/${id}/reassign`, input)
  return data.item
}

export async function deleteItem(id: string): Promise<void> {
  await apiClient.delete(`/cms/items/${id}`)
}

// The current step's actor marks it done — drives the whole pipeline.
export async function advanceItem(id: string, note?: string): Promise<CalendarItem> {
  const { data } = await apiClient.post(`/cms/items/${id}/advance`, { note })
  return data.item
}

// Pink — sends the item back one step.
export async function sendBackItem(id: string, note?: string): Promise<CalendarItem> {
  const { data } = await apiClient.post(`/cms/items/${id}/send-back`, { note })
  return data.item
}

// Red — terminal, closes the item for everyone. Confirm client-side first.
export async function rejectItem(id: string, reason: string): Promise<CalendarItem> {
  const { data } = await apiClient.post(`/cms/items/${id}/reject`, { reason })
  return data.item
}

// ---- Report ----
export interface MonthReport {
  frozen: boolean
  generatedAt: string
  perType: Array<{
    type: ContentType
    committedLabel: string
    scheduled: number
    published: number
    onTime: number
    late: number
    unpublished: number
  }>
  rejectionsByStage: Record<string, number>
  avgApprovalHours: number | null
  neverPublished: string[]
}

export async function getReport(calendarId: string): Promise<MonthReport> {
  const { data } = await apiClient.get(`/cms/calendars/${calendarId}/report`)
  return data.report
}

export async function closeMonth(calendarId: string): Promise<Calendar> {
  const { data } = await apiClient.post(`/cms/calendars/${calendarId}/close`)
  return data.calendar
}
