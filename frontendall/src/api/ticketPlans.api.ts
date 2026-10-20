import { apiClient } from './client'

// Planning ticket work on the Weekly Calendar — backend ticketPlan.service.js.
// The tray is everything waiting on you: tickets at your step, and the
// content calendar's posts, reels and daily stories at your step.

export type PlanKind = 'ticket' | 'calendar' | 'stories'

export interface TrayItem {
  kind: PlanKind
  _id: string
  code: string
  title: string
  color: string
  stageLabel: string | null
  nextStepLabel: string | null
  dueAt: string
  isOverdue: boolean
  // Where it opens (the Tickets app, inside this shell).
  link: string
  // Its step can be marked from the calendar (tickets and calendar posts/reels).
  canMark: boolean
}

export interface TicketPlan {
  _id: string
  kind: PlanKind
  ref: string
  code: string
  title: string
  day: string
  startMin: number
  endMin: number
}

export const planKey = (kind: PlanKind, ref: string) => `${kind}:${ref}`

interface RawTicket {
  _id: string
  code: string
  title: string
  color: string
  stageLabel: string
  nextStepLabel: string | null
  dueAt: string
  isOverdue: boolean
  can?: { act: boolean }
}
interface RawCalendarTicket extends Omit<RawTicket, 'stageLabel'> {
  kind: 'calendar' | 'stories'
  stageLabel?: string
}

export async function listTray(): Promise<TrayItem[]> {
  const [tickets, calendar] = await Promise.all([
    apiClient.get<{ tickets: RawTicket[] }>('/tickets', { params: { scope: 'mine' } }).then((r) => r.data.tickets),
    apiClient.get<{ tickets: RawCalendarTicket[] }>('/tickets/calendar', { params: { scope: 'mine', status: 'open' } }).then((r) => r.data.tickets),
  ])
  const items: TrayItem[] = [
    ...tickets.map((t) => ({
      kind: 'ticket' as const,
      _id: t._id,
      code: t.code,
      title: t.title,
      color: t.color,
      stageLabel: t.stageLabel,
      nextStepLabel: t.nextStepLabel,
      dueAt: t.dueAt,
      isOverdue: t.isOverdue,
      link: `/followups/tickets/${t._id}`,
      canMark: true,
    })),
    ...calendar.map((t) => ({
      kind: t.kind,
      _id: t._id,
      code: t.code,
      title: t.title,
      color: t.color,
      stageLabel: t.stageLabel ?? null,
      nextStepLabel: t.nextStepLabel ?? null,
      dueAt: t.dueAt,
      isOverdue: t.isOverdue,
      link: t.kind === 'stories' ? `/followups/calendar/stories/${t._id}` : `/followups/calendar/items/${t._id}`,
      canMark: t.kind === 'calendar',
    })),
  ]
  // Overdue first, then whatever is due soonest.
  return items.sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || Date.parse(a.dueAt) - Date.parse(b.dueAt))
}

export async function listPlans(from: string, to: string) {
  const { data } = await apiClient.get<{ plans: TicketPlan[] }>('/tickets/plans', { params: { from, to } })
  return data.plans
}

export async function createPlan(input: { kind: PlanKind; ref: string; day: string; startMin: number; endMin: number }) {
  const { data } = await apiClient.post<{ plan: TicketPlan }>('/tickets/plans', input)
  return data.plan
}

export async function updatePlan(id: string, input: { day?: string; startMin?: number; endMin?: number }) {
  const { data } = await apiClient.patch<{ plan: TicketPlan }>(`/tickets/plans/${id}`, input)
  return data.plan
}

export async function deletePlan(id: string) {
  await apiClient.delete(`/tickets/plans/${id}`)
}

// Marks the step it's waiting on you for — the ticket's own "Mark …" button.
export async function markStep(item: Pick<TrayItem, 'kind' | '_id'>) {
  const path = item.kind === 'ticket' ? `/tickets/${item._id}/advance` : `/tickets/calendar/items/${item._id}/advance`
  await apiClient.post(path, {})
}
