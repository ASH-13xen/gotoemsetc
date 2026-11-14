import { apiClient } from './client'
import type { Person } from './tickets.api'

// Client work: each client's monthly plan and the tickets it makes, the work
// timer and time entries, shoots, and the client value report — see backend
// routes/clientWork.routes.js.

export type ContentType = 'reels' | 'posts' | 'stories' | 'festiveStories'
export interface ContentTypeInfo {
  key: ContentType
  label: string
  plural: string
  pipeline: string
}
export type Counts = Record<ContentType, number>

// ---- clients and months -------------------------------------------------------------

export interface ClientCard {
  client: { _id: string; name: string; brandName: string; logoUrl: string; workPaused: boolean }
  planned: boolean
  team: { _id: string; title: string } | null
  smm: Person | null
  generatedAt: string | null
  progress: Record<ContentType, { committed: number; made: number; toStart: number; done: number }>
  carriedOver: number
  hoursLogged: number
  revenue?: { amount: number; source: 'invoice' | 'fee' } | null
}
export interface ClientCards {
  month: string
  monthLabel: string
  types: ContentTypeInfo[]
  canPlan: boolean
  canSeeMoney: boolean
  cards: ClientCard[]
}

export interface MonthTicket {
  _id: string
  code: string
  title: string
  type: ContentType
  index: number
  month: string
  dueAt: string
  status: 'open' | 'completed' | 'rejected'
  removed: boolean
  locked: boolean
  parkedIn: string | null
  carriedOver: boolean
  stageLabel: string
  color: string
  minutes: number
}
export interface MonthPlan {
  fromMonth: string
  isSuggestion: boolean
  counts: Counts
  team: string | null
  teamName: string
  smm: Person | null
  designer: Person | null
  shooter: Person | null
  editor: Person | null
  contentManager: Person | null
  fee?: number | null
  generatedAt: string | null
}
export interface ClientMonthDetail {
  client: { _id: string; name: string; workPaused: boolean }
  month: string
  monthLabel: string
  canPlan: boolean
  canSeeMoney: boolean
  types: ContentTypeInfo[]
  plan: MonthPlan | null
  invoice?: { amount: number; status: string; number: string } | null
  tickets: MonthTicket[]
  carriedOver: MonthTicket[]
  result?: { created: number; removed: number }
}
export interface SaveMonthInput {
  counts: Counts
  team?: string | null
  smm?: string | null
  designer?: string | null
  shooter?: string | null
  editor?: string | null
  contentManager?: string | null
  fee?: number | null
}

export const getClientCards = async (month?: string) => (await apiClient.get<ClientCards>('/client-work/cards', { params: { month } })).data
export const getClientMonth = async (clientId: string, month: string) => (await apiClient.get<ClientMonthDetail>(`/client-work/clients/${clientId}/months/${month}`)).data
export const saveClientMonth = async (clientId: string, month: string, input: SaveMonthInput) =>
  (await apiClient.put<ClientMonthDetail>(`/client-work/clients/${clientId}/months/${month}`, input)).data
export const generateClientMonth = async (clientId: string, month: string) =>
  (await apiClient.post<ClientMonthDetail>(`/client-work/clients/${clientId}/months/${month}/generate`)).data
export const setClientPaused = async (clientId: string, paused: boolean) => (await apiClient.patch(`/client-work/clients/${clientId}/paused`, { paused })).data

// ---- the work timer and time entries ------------------------------------------------

export type OtherWork = 'meeting' | 'internal' | 'training' | 'other'
export const OTHER_WORK: Record<OtherWork, string> = { meeting: 'Meeting', internal: 'Internal work', training: 'Training', other: 'Other' }

export interface TimeEntry {
  _id: string
  employee?: string
  kind: 'ticket' | 'other'
  ticket: { _id: string; code: string; title: string; clientName: string } | null
  otherKind: OtherWork | null
  otherLabel: string | null
  note: string
  startedAt: string
  endedAt: string | null
  minutes: number
  overtimeMinutes: number
  stopReason: string | null
  source: 'timer' | 'manual' | 'confirmed' | 'shoot' | 'meeting'
  step?: string | null
  estimateMinutes?: number | null
  changed?: boolean
  reason?: string
  pending?: boolean
  autoConfirmed?: boolean
  edited?: boolean
  edits?: { byName: string; at: string; note: string }[]
}
export interface TimerNow {
  running: TimeEntry | null
  todayMinutes: number
}
export interface TimeDay {
  employee: { _id: string; name: string; designation: string }
  date: string
  entries: TimeEntry[]
  totalMinutes: number
  canEdit: boolean
}
export interface TimeTeam {
  date: string
  people: { _id: string; name: string; designation: string; minutes: number; running: boolean }[]
}
export interface TicketTime {
  totalMinutes: number
  people: { _id: string; name: string; minutes: number }[]
}

export const getTimer = async () => (await apiClient.get<TimerNow>('/client-work/time/current')).data
export const startTimer = async (input: { ticketId?: string; otherKind?: OtherWork; note?: string }) => (await apiClient.post<TimerNow>('/client-work/time/start', input)).data
export const stopTimer = async () => (await apiClient.post<TimerNow>('/client-work/time/stop')).data
export const getTimeDay = async (params: { date?: string; employee?: string }) => (await apiClient.get<TimeDay>('/client-work/time/day', { params })).data
export const getTimeTeam = async (date?: string) => (await apiClient.get<TimeTeam>('/client-work/time/team', { params: { date } })).data
export const getTicketTime = async (id: string) => (await apiClient.get<TicketTime>(`/client-work/time/tickets/${id}`)).data
export interface EntryInput {
  employee?: string
  ticketId?: string
  otherKind?: OtherWork
  startedAt: string
  endedAt: string
  note?: string
  reason?: string
}
export const addTimeEntry = async (input: EntryInput) => (await apiClient.post<{ entry: TimeEntry }>('/client-work/time/entries', input)).data.entry
export const editTimeEntry = async (id: string, input: Partial<EntryInput>) => (await apiClient.patch<{ entry: TimeEntry }>(`/client-work/time/entries/${id}`, input)).data.entry
export const removeTimeEntry = async (id: string, reason: string) => (await apiClient.delete(`/client-work/time/entries/${id}`, { data: { reason } })).data

// ---- shoots ---------------------------------------------------------------------------

export interface Shoot {
  _id: string
  day: string
  startMin: number
  endMin: number
  location: string
  note: string
  status: 'planned' | 'done' | 'cancelled'
  people: Person[]
  reels: { ticket: string; code: string; title: string; clientName: string; stageLabel: string; weight: number; status: 'planned' | 'shot' | 'not_shot' | 'removed'; reason: string }[]
  hours: { employee: string; name: string | null; minutes: number }[]
  weeklyEvent: string | null
  doneAt: string | null
  cancelledAt: string | null
  cancelReason: string
}
export interface ShootInput {
  day: string
  startMin: number
  endMin: number
  location?: string
  note?: string
  people?: string[]
  ticketIds: string[]
  weights?: Record<string, number>
}
export interface CompleteShootInput {
  shot: string[]
  notShot: { ticket: string; reason: string }[]
  hours: { employee: string; minutes: number }[]
  weights?: Record<string, number>
}

export const listShoots = async (params: { from?: string; to?: string; status?: string } = {}) => (await apiClient.get<{ shoots: Shoot[] }>('/client-work/shoots', { params })).data.shoots
export const getShoot = async (id: string) => (await apiClient.get<{ shoot: Shoot }>(`/client-work/shoots/${id}`)).data.shoot
export const createShoot = async (input: ShootInput) => (await apiClient.post<{ shoot: Shoot }>('/client-work/shoots', input)).data.shoot
export const completeShoot = async (id: string, input: CompleteShootInput) => (await apiClient.post<{ shoot: Shoot }>(`/client-work/shoots/${id}/complete`, input)).data.shoot
export const cancelShoot = async (id: string, reason: string) => (await apiClient.post<{ shoot: Shoot }>(`/client-work/shoots/${id}/cancel`, { reason })).data.shoot

// ---- the client value report ------------------------------------------------------------

export interface ValueClientRow {
  client: { _id: string; name: string }
  revenue: number | null
  revenueSource: 'invoice' | 'fee' | null
  hours: number
  cost: number
  estimatedHours: number
  estimatedCost: number
  margin: number | null
  marginPct: number | null
  worthIt: boolean | null
  unconfirmedHours: number
  changedHours: number
  deliverables: Record<ContentType, { committed: number; done: number; minutes: number; cost: number; costPerDone: number | null }>
  people: { _id: string; name: string; hours: number; cost: number }[]
}
export interface ValuePersonRow {
  _id: string
  name: string
  designation: string
  hourlyCost: number
  noSalary: boolean
  paidHours: number
  loggedHours: number
  clientHours: number
  otherHours: number
  overtimeHours: number
  utilizationPct: number | null
}
export interface ValueReport {
  month: string
  monthLabel: string
  workingDays: number
  workingDaysSoFar?: number
  hoursPerDay: number
  targetMarginPct: number
  clients: ValueClientRow[]
  byType: Record<ContentType, { label: string; cost: number; done: number; hours: number; costPerDone: number | null }>
  people: ValuePersonRow[]
  overhead: {
    other: { label: string; hours: number; cost: number }[]
    nonClientTickets: { hours: number; cost: number }
    unlogged: { hours: number; cost: number }
    cost: number
  }
  totals: { revenue: number; clientCost: number; costOfClientsWithRevenue: number; overheadCost: number; salaryCost: number; loggedHours: number }
  generatedAt: string
  closed: { at: string; by: string | null } | null
}

export const getValueReport = async (month?: string) => (await apiClient.get<ValueReport>('/client-work/value', { params: { month } })).data
export const setTargetMargin = async (targetMarginPct: number) => (await apiClient.put('/client-work/value/settings', { targetMarginPct })).data
export const closeValueMonth = async (month: string) => (await apiClient.post<ValueReport>(`/client-work/value/${month}/close`)).data
export const reopenValueMonth = async (month: string) => (await apiClient.delete<ValueReport>(`/client-work/value/${month}/close`)).data

// ---- small helpers ------------------------------------------------------------------------

export const hm = (minutes: number | null | undefined) => {
  const m = Math.max(0, Math.round(minutes || 0))
  const h = Math.floor(m / 60)
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`
}
export const clock = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}
export const rupees = (n: number | null | undefined) => (n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`)
export const monthKeyOf = (d = new Date()) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(d)
  return `${p.find((x) => x.type === 'year')!.value}-${p.find((x) => x.type === 'month')!.value}`
}
export const addMonth = (key: string, n: number) => {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
export const monthName = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
export const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
